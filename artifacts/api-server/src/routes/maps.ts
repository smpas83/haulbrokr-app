import { Router, type IRouter } from "express";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod/v4";
import {
  db,
  jobsTable,
  jobRoutesTable,
  ticketsTable,
  trackingAuditLogsTable,
  tripLocationHistoryTable,
  truckLocationsTable,
  trucksTable,
  type Job,
  type Profile,
  type TruckLocation,
} from "@workspace/db";
import { getRequestProfile, requireProfile } from "../middlewares/requireAuth";
import { isAdmin } from "../middlewares/requireAdmin";
import { DRIVER_SIDE, CUSTOMER_SIDE, isDriverAssignedToJob, isOrgManager, loadJobIfMember } from "../lib/access";
import {
  assertValidLatLng,
  calculateTrafficAwareRoute,
  distanceMeters,
  geocodeAddress,
  placesAutocomplete,
  type LatLng,
  type RoutePoint,
  type RouteResult,
} from "../lib/googleMaps";

const router: IRouter = Router();

const LOCATION_STALE_MS = 5 * 60 * 1000;
const LOCATION_UPDATE_MIN_INTERVAL_MS = 5 * 1000;
const locationUpdateGate = new Map<string, number>();

const LatLngSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});
const RoutePointSchema = z.union([LatLngSchema, z.object({ address: z.string().trim().min(1) })]);
const CalculateRouteBody = z.object({
  jobId: z.number().int().positive().optional(),
  origin: RoutePointSchema.optional(),
  destination: RoutePointSchema.optional(),
});
const DriverLocationBody = z.object({
  jobId: z.number().int().positive().optional(),
  truckId: z.number().int().positive().optional(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  heading: z.number().min(0).max(360).optional(),
  speedMps: z.number().min(0).optional(),
  accuracyMeters: z.number().min(0).optional(),
  recordedAt: z.string().datetime().optional(),
});

function num(value: string | number | null | undefined): number | null {
  if (value == null) return null;
  const parsed = typeof value === "number" ? value : Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function serializeLocation(row: TruckLocation) {
  return {
    id: row.id,
    truckId: row.truckId,
    driverProfileId: row.driverProfileId,
    jobId: row.jobId,
    lat: Number(row.lat),
    lng: Number(row.lng),
    heading: num(row.heading),
    speedMps: num(row.speedMps),
    accuracyMeters: num(row.accuracyMeters),
    recordedAt: row.recordedAt,
    isStale: row.isStale === 1 || Date.now() - row.recordedAt.getTime() > LOCATION_STALE_MS,
    offRouteStatus: row.offRouteStatus,
    etaRecalculationRequestedAt: row.etaRecalculationRequestedAt,
  };
}

function serializeRoute(row: typeof jobRoutesTable.$inferSelect | null) {
  if (!row) return null;
  return {
    id: row.id,
    jobId: row.jobId,
    pickupLocation: row.pickupLat != null && row.pickupLng != null
      ? { lat: Number(row.pickupLat), lng: Number(row.pickupLng), placeId: row.pickupPlaceId }
      : null,
    dropoffLocation: row.dropoffLat != null && row.dropoffLng != null
      ? { lat: Number(row.dropoffLat), lng: Number(row.dropoffLng), placeId: row.dropoffPlaceId }
      : null,
    routePolyline: row.routePolyline,
    routeDistanceMeters: row.routeDistanceMeters,
    routeDurationSeconds: row.routeDurationSeconds,
    trafficDurationSeconds: row.trafficDurationSeconds,
    etaAt: row.etaAt,
    lastCalculatedAt: row.lastCalculatedAt,
    routeStatus: row.routeStatus,
  };
}

function routeValues(jobId: number, route: RouteResult) {
  return {
    jobId,
    pickupLat: String(route.origin.lat),
    pickupLng: String(route.origin.lng),
    dropoffLat: String(route.destination.lat),
    dropoffLng: String(route.destination.lng),
    routePolyline: route.encodedPolyline,
    routeDistanceMeters: route.distanceMeters,
    routeDurationSeconds: route.durationSeconds,
    trafficDurationSeconds: route.trafficDurationSeconds,
    etaAt: route.etaAt,
    lastCalculatedAt: route.calculatedAt,
    routeStatus: "calculated" as const,
  };
}

async function auditTracking(
  actorProfileId: number,
  eventType: string,
  opts: { jobId?: number | null; truckId?: number | null; message?: string; metadata?: unknown } = {},
): Promise<void> {
  await db.insert(trackingAuditLogsTable).values({
    actorProfileId,
    jobId: opts.jobId ?? null,
    truckId: opts.truckId ?? null,
    eventType,
    message: opts.message ?? null,
    metadataJson: opts.metadata == null ? null : JSON.stringify(opts.metadata),
  });
}

async function upsertJobRoute(jobId: number, route: RouteResult) {
  const values = routeValues(jobId, route);
  const [existing] = await db.select().from(jobRoutesTable).where(eq(jobRoutesTable.jobId, jobId));
  if (existing) {
    const [updated] = await db.update(jobRoutesTable).set(values).where(eq(jobRoutesTable.id, existing.id)).returning();
    return updated;
  }
  const [created] = await db.insert(jobRoutesTable).values(values).returning();
  return created;
}

async function assignedTickets(jobId: number) {
  return db.select().from(ticketsTable).where(eq(ticketsTable.jobId, jobId));
}

async function canSeeExactTrip(job: Job, profile: Profile, req: Parameters<typeof isAdmin>[0]): Promise<boolean> {
  if (await isAdmin(req)) return true;
  if (job.customerId === profile.id || job.providerId === profile.id) return true;
  if (profile.role === "driver") return isDriverAssignedToJob(job.id, profile.id);
  return !!(await loadJobIfMember(job.id, profile));
}

async function activeJobsForProvider(profile: Profile): Promise<Job[]> {
  const rows = await db.select().from(jobsTable).where(eq(jobsTable.providerId, profile.id));
  return rows.filter((j) => !["completed", "cancelled", "declined"].includes(j.status));
}

async function activeJobsForDispatcher(): Promise<Job[]> {
  const rows = await db.select().from(jobsTable);
  return rows.filter((j) => !["completed", "cancelled", "declined"].includes(j.status));
}

async function locationsForTickets(tickets: Array<typeof ticketsTable.$inferSelect>): Promise<TruckLocation[]> {
  const truckIds = tickets.map((t) => t.truckId).filter((id): id is number => id != null);
  const driverIds = tickets.map((t) => t.driverProfileId);
  if (truckIds.length > 0) {
    return db.select().from(truckLocationsTable).where(inArray(truckLocationsTable.truckId, truckIds));
  }
  if (driverIds.length > 0) {
    return db.select().from(truckLocationsTable).where(inArray(truckLocationsTable.driverProfileId, driverIds));
  }
  return [];
}

function latestByTruckOrDriver(rows: TruckLocation[]): TruckLocation[] {
  const byKey = new Map<string, TruckLocation>();
  for (const row of rows) {
    const key = row.truckId != null ? `truck:${row.truckId}` : `driver:${row.driverProfileId}`;
    const existing = byKey.get(key);
    if (!existing || row.recordedAt > existing.recordedAt) byKey.set(key, row);
  }
  return [...byKey.values()];
}

router.post("/maps/geocode", requireProfile, async (req, res): Promise<void> => {
  const parsed = z.object({ address: z.string().trim().min(1) }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  try {
    res.json(await geocodeAddress(parsed.data.address));
  } catch (err: any) {
    res.status(err?.status ?? 502).json({ error: err?.message ?? "Geocoding failed." });
  }
});

router.get("/maps/places/autocomplete", requireProfile, async (req, res): Promise<void> => {
  const input = typeof req.query.input === "string" ? req.query.input : "";
  const sessionToken = typeof req.query.sessionToken === "string" ? req.query.sessionToken : undefined;
  try {
    res.json({ predictions: await placesAutocomplete(input, sessionToken) });
  } catch (err: any) {
    res.status(err?.status ?? 502).json({ error: err?.message ?? "Places autocomplete failed." });
  }
});

router.post("/maps/route", requireProfile, async (req, res): Promise<void> => {
  const profile = getRequestProfile(req);
  const parsed = CalculateRouteBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  let origin: RoutePoint | undefined = parsed.data.origin;
  let destination: RoutePoint | undefined = parsed.data.destination;
  let job: Job | null = null;

  if (parsed.data.jobId) {
    job = await loadJobIfMember(parsed.data.jobId, profile);
    if (!job) {
      res.status(404).json({ error: "Job not found." });
      return;
    }
    origin ??= { address: job.pickupAddress };
    destination ??= { address: job.deliveryAddress };
  }

  if (!origin || !destination) {
    res.status(400).json({ error: "Provide origin and destination, or a jobId." });
    return;
  }

  try {
    const route = await calculateTrafficAwareRoute(origin, destination);
    const saved = job ? await upsertJobRoute(job.id, route) : null;
    if (job) await auditTracking(profile.id, "route_calculated", { jobId: job.id, message: "Route calculated." });
    res.json({ route, savedRoute: serializeRoute(saved) });
  } catch (err: any) {
    res.status(err?.status ?? 502).json({ error: err?.message ?? "Route calculation failed." });
  }
});

router.post("/tracking/driver-location", requireProfile, async (req, res): Promise<void> => {
  const profile = getRequestProfile(req);
  if (!DRIVER_SIDE.has(profile.role)) {
    res.status(403).json({ error: "Only drivers or provider fleet managers can update driver location." });
    return;
  }
  const parsed = DriverLocationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const location: LatLng = { lat: parsed.data.lat, lng: parsed.data.lng };
  try {
    assertValidLatLng(location);
  } catch (err: any) {
    res.status(err?.status ?? 400).json({ error: err?.message ?? "Invalid location." });
    return;
  }

  let job: Job | null = null;
  if (parsed.data.jobId) {
    job = await loadJobIfMember(parsed.data.jobId, profile);
    if (!job) {
      res.status(404).json({ error: "Job not found." });
      return;
    }
    if (profile.role === "driver" && !(await isDriverAssignedToJob(job.id, profile.id))) {
      res.status(403).json({ error: "Drivers can only update location for their assigned trip." });
      return;
    }
  }

  const gateKey = `${profile.id}:${parsed.data.truckId ?? "driver"}:${parsed.data.jobId ?? "none"}`;
  const nowMs = Date.now();
  const last = locationUpdateGate.get(gateKey) ?? 0;
  if (nowMs - last < LOCATION_UPDATE_MIN_INTERVAL_MS) {
    res.status(429).json({ error: "Location updates are arriving too frequently." });
    return;
  }
  locationUpdateGate.set(gateKey, nowMs);

  const recordedAt = parsed.data.recordedAt ? new Date(parsed.data.recordedAt) : new Date();
  const isStale = Date.now() - recordedAt.getTime() > LOCATION_STALE_MS ? 1 : 0;
  const etaRecalc = job ? new Date() : null;
  const values = {
    truckId: parsed.data.truckId ?? null,
    driverProfileId: profile.id,
    jobId: job?.id ?? null,
    lat: String(parsed.data.lat),
    lng: String(parsed.data.lng),
    heading: parsed.data.heading != null ? String(parsed.data.heading) : null,
    speedMps: parsed.data.speedMps != null ? String(parsed.data.speedMps) : null,
    accuracyMeters: parsed.data.accuracyMeters != null ? String(parsed.data.accuracyMeters) : null,
    recordedAt,
    isStale,
    offRouteStatus: "unknown",
    etaRecalculationRequestedAt: etaRecalc,
  };

  const existingRows = parsed.data.truckId
    ? await db.select().from(truckLocationsTable).where(eq(truckLocationsTable.truckId, parsed.data.truckId))
    : await db.select().from(truckLocationsTable).where(eq(truckLocationsTable.driverProfileId, profile.id));
  let current;
  if (existingRows[0]) {
    [current] = await db.update(truckLocationsTable).set(values).where(eq(truckLocationsTable.id, existingRows[0].id)).returning();
  } else {
    [current] = await db.insert(truckLocationsTable).values(values).returning();
  }

  await db.insert(tripLocationHistoryTable).values({
    jobId: values.jobId,
    truckId: values.truckId,
    driverProfileId: profile.id,
    lat: values.lat,
    lng: values.lng,
    heading: values.heading,
    speedMps: values.speedMps,
    accuracyMeters: values.accuracyMeters,
    recordedAt,
    offRouteStatus: "unknown",
  });
  await auditTracking(profile.id, "driver_location_updated", {
    jobId: job?.id ?? null,
    truckId: parsed.data.truckId ?? null,
    message: isStale ? "Stale driver location received." : "Driver location updated.",
    metadata: { stale: isStale === 1, offRouteStatus: "unknown" },
  });

  res.json({ location: serializeLocation(current), etaRecalculationRequested: !!etaRecalc });
});

router.get("/tracking/trips/:jobId/route", requireProfile, async (req, res): Promise<void> => {
  const profile = getRequestProfile(req);
  const jobId = Number.parseInt(String(req.params.jobId), 10);
  if (!Number.isFinite(jobId)) {
    res.status(400).json({ error: "Invalid job id." });
    return;
  }
  const job = await loadJobIfMember(jobId, profile);
  if (!job) {
    res.status(404).json({ error: "Job not found." });
    return;
  }
  const [route] = await db.select().from(jobRoutesTable).where(eq(jobRoutesTable.jobId, jobId));
  res.json({ route: serializeRoute(route ?? null) });
});

router.get("/tracking/trips/:jobId/live", requireProfile, async (req, res): Promise<void> => {
  const profile = getRequestProfile(req);
  const jobId = Number.parseInt(String(req.params.jobId), 10);
  if (!Number.isFinite(jobId)) {
    res.status(400).json({ error: "Invalid job id." });
    return;
  }
  const [job] = await db.select().from(jobsTable).where(eq(jobsTable.id, jobId));
  if (!job || !(await canSeeExactTrip(job, profile, req))) {
    res.status(404).json({ error: "Trip not found." });
    return;
  }
  const tickets = await assignedTickets(jobId);
  const locations = latestByTruckOrDriver(await locationsForTickets(tickets));
  const [route] = await db.select().from(jobRoutesTable).where(eq(jobRoutesTable.jobId, jobId));
  res.json({
    jobId,
    route: serializeRoute(route ?? null),
    assigned: tickets.map((t) => ({ ticketId: t.id, driverProfileId: t.driverProfileId, truckId: t.truckId })),
    locations: locations.map(serializeLocation),
  });
});

router.get("/maps/nearby-trucks/count", requireProfile, async (req, res): Promise<void> => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  const radiusMiles = Math.min(Math.max(Number(req.query.radiusMiles ?? 10), 1), 100);
  const center = { lat, lng };
  try {
    assertValidLatLng(center);
  } catch (err: any) {
    res.status(err?.status ?? 400).json({ error: err?.message ?? "Invalid location." });
    return;
  }

  const radiusMeters = radiusMiles * 1609.344;
  const allLocations = await db.select().from(truckLocationsTable);
  const fresh = latestByTruckOrDriver(allLocations).filter((loc) => {
    if (Date.now() - loc.recordedAt.getTime() > LOCATION_STALE_MS) return false;
    return distanceMeters(center, { lat: Number(loc.lat), lng: Number(loc.lng) }) <= radiusMeters;
  });
  res.json({ count: fresh.length, radiusMiles });
});

router.get("/maps/dispatcher/active", requireProfile, async (req, res): Promise<void> => {
  if (!(await isAdmin(req))) {
    res.status(403).json({ error: "Dispatcher map access requires staff access." });
    return;
  }
  const activeJobs = await activeJobsForDispatcher();
  const tickets = activeJobs.length
    ? await db.select().from(ticketsTable).where(inArray(ticketsTable.jobId, activeJobs.map((j) => j.id)))
    : [];
  const locations = latestByTruckOrDriver(await locationsForTickets(tickets));
  res.json({
    jobs: activeJobs.map((j) => ({ id: j.id, status: j.status, providerId: j.providerId, customerId: j.customerId })),
    trucks: locations.map(serializeLocation),
  });
});

router.get("/maps/fleet/active", requireProfile, async (req, res): Promise<void> => {
  const profile = getRequestProfile(req);
  if (profile.role !== "provider" || !isOrgManager(profile)) {
    res.status(403).json({ error: "Fleet map access requires a provider fleet owner or admin." });
    return;
  }
  const fleetTrucks = await db.select().from(trucksTable).where(eq(trucksTable.ownerId, profile.id));
  const truckIds = fleetTrucks.map((t) => t.id);
  const locations = truckIds.length
    ? latestByTruckOrDriver(await db.select().from(truckLocationsTable).where(inArray(truckLocationsTable.truckId, truckIds)))
    : [];
  const jobs = await activeJobsForProvider(profile);
  res.json({
    trucks: locations.map(serializeLocation),
    jobs: jobs.map((j) => ({ id: j.id, status: j.status, providerId: j.providerId })),
  });
});

router.get("/maps/driver/active-trip", requireProfile, async (req, res): Promise<void> => {
  const profile = getRequestProfile(req);
  if (profile.role !== "driver") {
    res.status(403).json({ error: "Only drivers can access their active trip map." });
    return;
  }
  const tickets = await db.select().from(ticketsTable).where(eq(ticketsTable.driverProfileId, profile.id));
  const activeTicket = tickets.find((t) => t.status !== "completed" && t.status !== "verified");
  if (!activeTicket) {
    res.json({ trip: null });
    return;
  }
  const [job] = await db.select().from(jobsTable).where(eq(jobsTable.id, activeTicket.jobId));
  if (!job || ["completed", "cancelled", "declined"].includes(job.status)) {
    res.json({ trip: null });
    return;
  }
  const locations = latestByTruckOrDriver(await locationsForTickets([activeTicket]));
  const [route] = await db.select().from(jobRoutesTable).where(eq(jobRoutesTable.jobId, job.id));
  res.json({
    trip: {
      jobId: job.id,
      ticketId: activeTicket.id,
      truckId: activeTicket.truckId,
      route: serializeRoute(route ?? null),
      locations: locations.map(serializeLocation),
    },
  });
});

export default router;
