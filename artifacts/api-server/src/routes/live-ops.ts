import { Router, type IRouter } from "express";
import { and, asc, desc, eq, gte, inArray, or } from "drizzle-orm";
import { z } from "zod/v4";
import {
  db,
  driverAvailabilityTable,
  jobGeofencesTable,
  jobsTable,
  jobStatusUpdatesTable,
  profilesTable,
  ticketsTable,
  trucksTable,
  vehicleLocationsTable,
  type JobGeofence,
  type Ticket,
} from "@workspace/db";
import { getRequestProfile, requireProfile } from "../middlewares/requireAuth";
import { DRIVER_SIDE, isOrgManager, loadJobIfMember, orgScopedActorIds } from "../lib/access";
import { recordJobTimelineEvent } from "../lib/jobTimeline";

const router: IRouter = Router();

type NormalizedLocation = {
  latitude: number;
  longitude: number;
  heading: number | null;
  speedMph: number | null;
  accuracyMeters: number | null;
  recordedAt: Date;
};

const geofenceBodySchema = z.object({
  kind: z.enum(["pickup", "delivery"]),
  latitude: z.number().min(-90).max(90).optional(),
  lat: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  lng: z.number().min(-180).max(180).optional(),
  radiusMeters: z.number().int().min(25).max(5_000).default(200),
  label: z.string().trim().max(120).optional(),
});

const availabilityBodySchema = z.object({
  isOnline: z.boolean(),
  currentTicketId: z.number().int().positive().nullable().optional(),
});

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function normalizeLocation(input: unknown): NormalizedLocation | null {
  if (!input || typeof input !== "object") return null;
  const point = input as Record<string, unknown>;
  const latitude = asNumber(point.latitude ?? point.lat);
  const longitude = asNumber(point.longitude ?? point.lng ?? point.long);
  if (latitude == null || longitude == null) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;

  const recordedAtValue = point.recordedAt;
  const recordedAt = typeof recordedAtValue === "string" || recordedAtValue instanceof Date
    ? new Date(recordedAtValue)
    : new Date();
  if (!Number.isFinite(recordedAt.getTime())) return null;

  return {
    latitude,
    longitude,
    heading: asNumber(point.heading),
    speedMph: asNumber(point.speedMph ?? point.speed),
    accuracyMeters: asNumber(point.accuracyMeters ?? point.accuracy),
    recordedAt,
  };
}

function normalizeLocations(body: unknown): NormalizedLocation[] | null {
  const maybeLocations = body && typeof body === "object"
    ? (body as Record<string, unknown>).locations
    : undefined;
  const raw: unknown[] = Array.isArray(maybeLocations) ? maybeLocations : [body];
  const locations = raw.map(normalizeLocation);
  if (locations.some((location) => !location)) return null;
  return locations as NormalizedLocation[];
}

function serializeLocation(row: typeof vehicleLocationsTable.$inferSelect) {
  return {
    id: row.id,
    jobId: row.jobId,
    ticketId: row.ticketId,
    driverProfileId: row.driverProfileId,
    truckId: row.truckId,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    heading: row.heading == null ? null : Number(row.heading),
    speedMph: row.speedMph == null ? null : Number(row.speedMph),
    accuracyMeters: row.accuracyMeters == null ? null : Number(row.accuracyMeters),
    recordedAt: row.recordedAt,
    createdAt: row.createdAt,
  };
}

function serializeGeofence(row: JobGeofence) {
  return {
    id: row.id,
    jobId: row.jobId,
    kind: row.kind,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    radiusMeters: row.radiusMeters,
    label: row.label,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function distanceMeters(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }): number {
  const radiusMeters = 6_371_000;
  const toRad = (degrees: number) => degrees * Math.PI / 180;
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * radiusMeters * Math.asin(Math.sqrt(h));
}

function fallbackEta(
  latest: ReturnType<typeof serializeLocation> | null,
  geofences: ReturnType<typeof serializeGeofence>[],
) {
  if (!latest) return null;
  const destination = geofences.find((geofence) => geofence.kind === "delivery")
    ?? geofences.find((geofence) => geofence.kind === "pickup");
  if (!destination) return null;

  const distanceToDestinationMeters = distanceMeters(latest, destination);
  const speedMph = latest.speedMph && latest.speedMph >= 5 ? latest.speedMph : 35;
  const minutes = Math.max(1, Math.ceil((distanceToDestinationMeters / 1609.344) / speedMph * 60));
  return {
    distanceMeters: Math.round(distanceToDestinationMeters),
    minutes,
    estimatedArrivalAt: new Date(Date.now() + minutes * 60_000),
    source: "haversine_fallback",
  };
}

async function estimateEta(
  latest: ReturnType<typeof serializeLocation> | null,
  geofences: ReturnType<typeof serializeGeofence>[],
) {
  const destination = geofences.find((geofence) => geofence.kind === "delivery")
    ?? geofences.find((geofence) => geofence.kind === "pickup");
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!latest || !destination || !apiKey) return fallbackEta(latest, geofences);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1_500);
  try {
    const url = new URL("https://maps.googleapis.com/maps/api/distancematrix/json");
    url.searchParams.set("origins", `${latest.latitude},${latest.longitude}`);
    url.searchParams.set("destinations", `${destination.latitude},${destination.longitude}`);
    url.searchParams.set("units", "imperial");
    url.searchParams.set("key", apiKey);

    const response = await fetch(url, { signal: controller.signal });
    const data = await response.json() as {
      status?: string;
      rows?: Array<{ elements?: Array<{ status?: string; distance?: { value?: number }; duration?: { value?: number } }> }>;
    };
    const element = data.rows?.[0]?.elements?.[0];
    if (response.ok && data.status === "OK" && element?.status === "OK" && element.duration?.value) {
      const minutes = Math.max(1, Math.ceil(element.duration.value / 60));
      return {
        distanceMeters: Math.round(element.distance?.value ?? 0),
        minutes,
        estimatedArrivalAt: new Date(Date.now() + minutes * 60_000),
        source: "google_maps",
      };
    }
  } catch {
    // Fall back to a local estimate so live tracking keeps working without Google.
  } finally {
    clearTimeout(timeout);
  }

  return fallbackEta(latest, geofences);
}

function routeProgress(
  latest: ReturnType<typeof serializeLocation> | null,
  geofences: ReturnType<typeof serializeGeofence>[],
): number | null {
  if (!latest) return null;
  const pickup = geofences.find((geofence) => geofence.kind === "pickup");
  const delivery = geofences.find((geofence) => geofence.kind === "delivery");
  if (!pickup || !delivery) return null;
  const total = distanceMeters(pickup, delivery);
  if (total <= 0) return null;
  const remaining = distanceMeters(latest, delivery);
  return Math.max(0, Math.min(1, 1 - remaining / total));
}

async function loadTicketForWrite(ticketId: number, profile: ReturnType<typeof getRequestProfile>): Promise<{ ticket: Ticket } | null> {
  const [ticket] = await db.select().from(ticketsTable).where(eq(ticketsTable.id, ticketId)).limit(1);
  if (!ticket) return null;
  const job = await loadJobIfMember(ticket.jobId, profile);
  if (!job) return null;
  if (profile.role === "driver" && ticket.driverProfileId !== profile.id) return null;
  return { ticket };
}

async function upsertDriverAvailability(
  driverProfileId: number,
  values: {
    isOnline: boolean;
    currentTicketId?: number | null;
    latitude?: number | null;
    longitude?: number | null;
  },
) {
  const [existing] = await db
    .select()
    .from(driverAvailabilityTable)
    .where(eq(driverAvailabilityTable.driverProfileId, driverProfileId))
    .limit(1);

  const payload = {
    isOnline: values.isOnline,
    currentTicketId: values.currentTicketId,
    lastLatitude: values.latitude == null ? undefined : String(values.latitude),
    lastLongitude: values.longitude == null ? undefined : String(values.longitude),
    lastSeenAt: new Date(),
  };

  if (existing) {
    const [updated] = await db
      .update(driverAvailabilityTable)
      .set(payload)
      .where(eq(driverAvailabilityTable.id, existing.id))
      .returning();
    return updated;
  }

  const [created] = await db
    .insert(driverAvailabilityTable)
    .values({
      driverProfileId,
      isOnline: values.isOnline,
      currentTicketId: values.currentTicketId ?? null,
      lastLatitude: values.latitude == null ? null : String(values.latitude),
      lastLongitude: values.longitude == null ? null : String(values.longitude),
      lastSeenAt: new Date(),
    })
    .returning();
  return created;
}

async function triggerGeofences(ticket: Ticket, latest: NormalizedLocation): Promise<string[]> {
  const geofences = await db
    .select()
    .from(jobGeofencesTable)
    .where(eq(jobGeofencesTable.jobId, ticket.jobId));
  const triggered: string[] = [];

  for (const geofence of geofences) {
    const distance = distanceMeters(latest, {
      latitude: Number(geofence.latitude),
      longitude: Number(geofence.longitude),
    });
    if (distance > geofence.radiusMeters) continue;

    const status = geofence.kind === "pickup" ? "arrived" : "completed";
    const [existing] = await db
      .select({ id: jobStatusUpdatesTable.id })
      .from(jobStatusUpdatesTable)
      .where(and(
        eq(jobStatusUpdatesTable.jobId, ticket.jobId),
        eq(jobStatusUpdatesTable.ticketId, ticket.id),
        eq(jobStatusUpdatesTable.status, status),
      ))
      .limit(1);
    if (existing) continue;

    await recordJobTimelineEvent(ticket.jobId, ticket.driverProfileId, status, {
      ticketId: ticket.id,
      note: `${geofence.kind} geofence reached`,
    });
    triggered.push(geofence.kind);
  }

  return triggered;
}

router.post("/tickets/:id/locations", requireProfile, async (req, res): Promise<void> => {
  const profile = getRequestProfile(req);
  if (!DRIVER_SIDE.has(profile.role)) {
    res.status(403).json({ error: "Only drivers and providers can submit live locations." });
    return;
  }

  const ticketId = parseInt(String(req.params.id), 10);
  if (!Number.isFinite(ticketId)) { res.status(400).json({ error: "Invalid ticket id" }); return; }
  const found = await loadTicketForWrite(ticketId, profile);
  if (!found) { res.status(404).json({ error: "Ticket not found" }); return; }

  const locations = normalizeLocations(req.body);
  if (!locations?.length) {
    res.status(400).json({ error: "Expected a location or { locations: [...] } with latitude/longitude." });
    return;
  }

  const rows = await db
    .insert(vehicleLocationsTable)
    .values(locations.map((location) => ({
      jobId: found.ticket.jobId,
      ticketId: found.ticket.id,
      driverProfileId: found.ticket.driverProfileId,
      truckId: found.ticket.truckId,
      latitude: String(location.latitude),
      longitude: String(location.longitude),
      heading: location.heading == null ? null : String(location.heading),
      speedMph: location.speedMph == null ? null : String(location.speedMph),
      accuracyMeters: location.accuracyMeters == null ? null : String(location.accuracyMeters),
      recordedAt: location.recordedAt,
    })))
    .returning();

  const latest = locations.reduce((max, location) => (
    location.recordedAt.getTime() > max.recordedAt.getTime() ? location : max
  ), locations[0]);
  await upsertDriverAvailability(found.ticket.driverProfileId, {
    isOnline: true,
    currentTicketId: found.ticket.id,
    latitude: latest.latitude,
    longitude: latest.longitude,
  });
  const triggeredGeofences = await triggerGeofences(found.ticket, latest);

  res.status(201).json({
    locations: rows.map(serializeLocation),
    latestLocation: serializeLocation(rows[rows.length - 1]),
    triggeredGeofences,
  });
});

router.get("/jobs/:id/tracking", requireProfile, async (req, res): Promise<void> => {
  const profile = getRequestProfile(req);
  const jobId = parseInt(String(req.params.id), 10);
  if (!Number.isFinite(jobId)) { res.status(400).json({ error: "Invalid job id" }); return; }
  const job = await loadJobIfMember(jobId, profile);
  if (!job) { res.status(404).json({ error: "Job not found" }); return; }

  const [latestRow] = await db
    .select()
    .from(vehicleLocationsTable)
    .where(eq(vehicleLocationsTable.jobId, jobId))
    .orderBy(desc(vehicleLocationsTable.recordedAt))
    .limit(1);
  const latestLocation = latestRow ? serializeLocation(latestRow) : null;

  const tickets = await db
    .select()
    .from(ticketsTable)
    .where(eq(ticketsTable.jobId, jobId))
    .orderBy(asc(ticketsTable.loadNumber));
  const geofences = (await db
    .select()
    .from(jobGeofencesTable)
    .where(eq(jobGeofencesTable.jobId, jobId)))
    .map(serializeGeofence);

  res.json({
    jobId: job.id,
    status: job.status,
    pickupAddress: job.pickupAddress,
    deliveryAddress: job.deliveryAddress,
    activeTickets: tickets.filter((ticket) => ticket.status === "pending" || ticket.status === "in_progress"),
    latestLocation,
    eta: await estimateEta(latestLocation, geofences),
    routeProgress: routeProgress(latestLocation, geofences),
    geofences,
  });
});

router.get("/jobs/:id/locations", requireProfile, async (req, res): Promise<void> => {
  const profile = getRequestProfile(req);
  const jobId = parseInt(String(req.params.id), 10);
  if (!Number.isFinite(jobId)) { res.status(400).json({ error: "Invalid job id" }); return; }
  const job = await loadJobIfMember(jobId, profile);
  if (!job) { res.status(404).json({ error: "Job not found" }); return; }

  const sinceRaw = typeof req.query.since === "string" ? req.query.since : null;
  const since = sinceRaw ? new Date(sinceRaw) : null;
  if (since && !Number.isFinite(since.getTime())) {
    res.status(400).json({ error: "Invalid since timestamp" });
    return;
  }

  const ticketId = req.query.ticketId != null ? parseInt(String(req.query.ticketId), 10) : null;
  if (ticketId != null && !Number.isFinite(ticketId)) {
    res.status(400).json({ error: "Invalid ticket id" });
    return;
  }

  const conditions = [eq(vehicleLocationsTable.jobId, jobId)];
  if (since) conditions.push(gte(vehicleLocationsTable.recordedAt, since));
  if (ticketId != null) conditions.push(eq(vehicleLocationsTable.ticketId, ticketId));

  const rows = await db
    .select()
    .from(vehicleLocationsTable)
    .where(and(...conditions))
    .orderBy(asc(vehicleLocationsTable.recordedAt));
  res.json(rows.map(serializeLocation));
});

router.post("/jobs/:id/geofences", requireProfile, async (req, res): Promise<void> => {
  const profile = getRequestProfile(req);
  if (profile.role === "driver") {
    res.status(403).json({ error: "Drivers cannot configure geofences." });
    return;
  }

  const jobId = parseInt(String(req.params.id), 10);
  if (!Number.isFinite(jobId)) { res.status(400).json({ error: "Invalid job id" }); return; }
  const job = await loadJobIfMember(jobId, profile);
  if (!job) { res.status(404).json({ error: "Job not found" }); return; }

  const parsed = geofenceBodySchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const latitude = parsed.data.latitude ?? parsed.data.lat;
  const longitude = parsed.data.longitude ?? parsed.data.lng;
  if (latitude == null || longitude == null) {
    res.status(400).json({ error: "latitude/longitude are required." });
    return;
  }

  const [geofence] = await db.insert(jobGeofencesTable).values({
    jobId,
    kind: parsed.data.kind,
    latitude: String(latitude),
    longitude: String(longitude),
    radiusMeters: parsed.data.radiusMeters,
    label: parsed.data.label ?? null,
  }).returning();
  res.status(201).json(serializeGeofence(geofence));
});

router.patch("/drivers/me/availability", requireProfile, async (req, res): Promise<void> => {
  const profile = getRequestProfile(req);
  if (!DRIVER_SIDE.has(profile.role)) {
    res.status(403).json({ error: "Only drivers and providers can set availability." });
    return;
  }

  const parsed = availabilityBodySchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  if (parsed.data.currentTicketId != null) {
    const found = await loadTicketForWrite(parsed.data.currentTicketId, profile);
    if (!found) {
      res.status(400).json({ error: "Current ticket is not accessible." });
      return;
    }
  }

  const availability = await upsertDriverAvailability(profile.id, {
    isOnline: parsed.data.isOnline,
    currentTicketId: parsed.data.currentTicketId ?? null,
  });

  res.json({
    driverProfileId: availability.driverProfileId,
    isOnline: availability.isOnline,
    currentTicketId: availability.currentTicketId,
    lastLatitude: availability.lastLatitude == null ? null : Number(availability.lastLatitude),
    lastLongitude: availability.lastLongitude == null ? null : Number(availability.lastLongitude),
    lastSeenAt: availability.lastSeenAt,
    updatedAt: availability.updatedAt,
  });
});

router.get("/fleet/live", requireProfile, async (req, res): Promise<void> => {
  const profile = getRequestProfile(req);
  if (!DRIVER_SIDE.has(profile.role) || !isOrgManager(profile)) {
    res.status(403).json({ error: "Only provider owners and admins can view live fleet operations." });
    return;
  }

  const ownerIds = await orgScopedActorIds(profile);
  const trucks = await db
    .select()
    .from(trucksTable)
    .where(inArray(trucksTable.ownerId, ownerIds));
  const truckIds = trucks.map((truck) => truck.id);
  if (!truckIds.length) {
    res.json({ trucks: [], updatedAt: new Date() });
    return;
  }

  const [tickets, locations] = await Promise.all([
    db
      .select()
      .from(ticketsTable)
      .where(and(
        inArray(ticketsTable.truckId, truckIds),
        or(eq(ticketsTable.status, "pending"), eq(ticketsTable.status, "in_progress")),
      )),
    db
      .select()
      .from(vehicleLocationsTable)
      .where(inArray(vehicleLocationsTable.truckId, truckIds))
      .orderBy(desc(vehicleLocationsTable.recordedAt)),
  ]);

  const driverIds = Array.from(new Set([
    ...trucks.map((truck) => truck.assignedDriverId).filter((id): id is number => id != null),
    ...tickets.map((ticket) => ticket.driverProfileId),
  ]));
  const [availabilityRows, driverRows, jobRows] = await Promise.all([
    driverIds.length
      ? db.select().from(driverAvailabilityTable).where(inArray(driverAvailabilityTable.driverProfileId, driverIds))
      : Promise.resolve([]),
    driverIds.length
      ? db.select().from(profilesTable).where(inArray(profilesTable.id, driverIds))
      : Promise.resolve([]),
    tickets.length
      ? db.select().from(jobsTable).where(inArray(jobsTable.id, Array.from(new Set(tickets.map((ticket) => ticket.jobId)))))
      : Promise.resolve([]),
  ]);

  const latestByTruck = new Map<number, ReturnType<typeof serializeLocation>>();
  for (const row of locations) {
    if (row.truckId != null && !latestByTruck.has(row.truckId)) {
      latestByTruck.set(row.truckId, serializeLocation(row));
    }
  }
  const activeTicketByTruck = new Map(tickets.filter((ticket) => ticket.truckId != null).map((ticket) => [ticket.truckId!, ticket]));
  const availabilityByDriver = new Map(availabilityRows.map((availability) => [availability.driverProfileId, availability]));
  const driverById = new Map(driverRows.map((driver) => [driver.id, driver]));
  const jobById = new Map(jobRows.map((job) => [job.id, job]));

  res.json({
    trucks: trucks.map((truck) => {
      const activeTicket = activeTicketByTruck.get(truck.id) ?? null;
      const driverId = activeTicket?.driverProfileId ?? truck.assignedDriverId;
      const availability = driverId == null ? null : availabilityByDriver.get(driverId) ?? null;
      const driver = driverId == null ? null : driverById.get(driverId) ?? null;
      const activeJob = activeTicket ? jobById.get(activeTicket.jobId) ?? null : null;
      return {
        truck: {
          ...truck,
          capacityTons: Number(truck.capacityTons),
          ratePerHour: Number(truck.ratePerHour),
        },
        state: activeTicket ? "on_trip" : truck.isAvailable ? "available" : "unavailable",
        driver: driver ? {
          id: driver.id,
          contactName: driver.contactName,
          companyName: driver.companyName,
          isOnline: availability?.isOnline ?? false,
          lastSeenAt: availability?.lastSeenAt ?? null,
        } : null,
        activeTrip: activeTicket ? {
          ticketId: activeTicket.id,
          jobId: activeTicket.jobId,
          status: activeTicket.status,
          pickupAddress: activeJob?.pickupAddress ?? null,
          deliveryAddress: activeJob?.deliveryAddress ?? null,
        } : null,
        latestLocation: latestByTruck.get(truck.id) ?? null,
      };
    }),
    updatedAt: new Date(),
  });
});

export default router;
