import { Router, type IRouter } from "express";
import { desc, eq } from "drizzle-orm";
import { z } from "zod/v4";
import { db, driverLocationsTable, routeSnapshotsTable } from "@workspace/db";
import { getRequestProfile, requireProfile } from "../middlewares/requireAuth";
import { DRIVER_SIDE, isDriverAssignedToJob, loadJobIfMember } from "../lib/access";
import { calculateRoute, geocodeAddress, placesAutocomplete, reverseGeocode } from "../lib/googleMapsService";

const router: IRouter = Router();

const LatLngSchema = z.object({ lat: z.number(), lng: z.number() });
const GeocodeBody = z.object({ address: z.string().min(3).max(500) });
const ReverseGeocodeBody = z.object({ lat: z.number(), lng: z.number() });
const PlacesBody = z.object({ input: z.string().min(2).max(300) });
const RouteBody = z.object({
  origin: z.union([z.string().min(3).max(500), LatLngSchema]),
  destination: z.union([z.string().min(3).max(500), LatLngSchema]),
  departureTime: z.string().datetime().optional(),
  jobId: z.number().int().positive().optional(),
});
const LocationBody = z.object({
  jobId: z.number().int().positive().optional(),
  truckId: z.number().int().positive().optional(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  speedMph: z.number().min(0).max(150).optional(),
  headingDegrees: z.number().min(0).max(360).optional(),
  accuracyMeters: z.number().min(0).optional(),
  status: z.string().max(64).optional(),
  recordedAt: z.string().datetime().optional(),
});

function serializeLocation(row: typeof driverLocationsTable.$inferSelect) {
  return {
    ...row,
    latitude: parseFloat(row.latitude),
    longitude: parseFloat(row.longitude),
    speedMph: row.speedMph == null ? null : parseFloat(row.speedMph),
    headingDegrees: row.headingDegrees == null ? null : parseFloat(row.headingDegrees),
    accuracyMeters: row.accuracyMeters == null ? null : parseFloat(row.accuracyMeters),
  };
}

function mapsError(res: any, err: unknown): void {
  const status = typeof (err as { status?: unknown }).status === "number" ? (err as { status: number }).status : 502;
  res.status(status).json({ error: err instanceof Error ? err.message : "Google Maps request failed." });
}

router.post("/maps/geocode", requireProfile, async (req, res): Promise<void> => {
  const parsed = GeocodeBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  try {
    res.json(await geocodeAddress(parsed.data.address));
  } catch (err) {
    mapsError(res, err);
  }
});

router.post("/maps/reverse-geocode", requireProfile, async (req, res): Promise<void> => {
  const parsed = ReverseGeocodeBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  try {
    res.json(await reverseGeocode(parsed.data.lat, parsed.data.lng));
  } catch (err) {
    mapsError(res, err);
  }
});

router.post("/maps/places/autocomplete", requireProfile, async (req, res): Promise<void> => {
  const parsed = PlacesBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  try {
    res.json(await placesAutocomplete(parsed.data.input));
  } catch (err) {
    mapsError(res, err);
  }
});

router.post("/maps/routes", requireProfile, async (req, res): Promise<void> => {
  const profile = getRequestProfile(req);
  const parsed = RouteBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  if (parsed.data.jobId) {
    const job = await loadJobIfMember(parsed.data.jobId, profile);
    if (!job) { res.status(404).json({ error: "Job not found" }); return; }
  }
  try {
    const route = await calculateRoute(parsed.data);
    if (parsed.data.jobId) {
      await db.insert(routeSnapshotsTable).values({
        jobId: parsed.data.jobId,
        requestedByProfileId: profile.id,
        originLabel: typeof parsed.data.origin === "string" ? parsed.data.origin : `${parsed.data.origin.lat},${parsed.data.origin.lng}`,
        destinationLabel: typeof parsed.data.destination === "string" ? parsed.data.destination : `${parsed.data.destination.lat},${parsed.data.destination.lng}`,
        distanceMeters: route.distanceMeters,
        durationSeconds: route.durationSeconds,
        trafficDurationSeconds: route.trafficDurationSeconds,
        eta: route.eta ? new Date(route.eta) : null,
        encodedPolyline: route.encodedPolyline,
        providerPayloadJson: JSON.stringify(route.providerPayload),
      });
    }
    res.json(route);
  } catch (err) {
    mapsError(res, err);
  }
});

router.post("/locations/me", requireProfile, async (req, res): Promise<void> => {
  const profile = getRequestProfile(req);
  if (!DRIVER_SIDE.has(profile.role)) {
    res.status(403).json({ error: "Only drivers and providers can publish locations." });
    return;
  }
  const parsed = LocationBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  if (parsed.data.jobId) {
    const job = await loadJobIfMember(parsed.data.jobId, profile);
    if (!job) { res.status(404).json({ error: "Job not found" }); return; }
    if (profile.role === "driver" && !(await isDriverAssignedToJob(parsed.data.jobId, profile.id))) {
      res.status(403).json({ error: "You are not assigned to this job." });
      return;
    }
  }

  const [row] = await db.insert(driverLocationsTable).values({
    jobId: parsed.data.jobId ?? null,
    driverProfileId: profile.id,
    truckId: parsed.data.truckId ?? null,
    latitude: String(parsed.data.latitude),
    longitude: String(parsed.data.longitude),
    speedMph: parsed.data.speedMph == null ? null : String(parsed.data.speedMph),
    headingDegrees: parsed.data.headingDegrees == null ? null : String(parsed.data.headingDegrees),
    accuracyMeters: parsed.data.accuracyMeters == null ? null : String(parsed.data.accuracyMeters),
    status: parsed.data.status ?? null,
    recordedAt: parsed.data.recordedAt ? new Date(parsed.data.recordedAt) : new Date(),
  }).returning();

  res.status(201).json(serializeLocation(row));
});

router.get("/maps/jobs/:jobId/tracking", requireProfile, async (req, res): Promise<void> => {
  const profile = getRequestProfile(req);
  const jobId = Number(req.params.jobId);
  if (!Number.isFinite(jobId)) { res.status(400).json({ error: "Invalid job id" }); return; }
  const job = await loadJobIfMember(jobId, profile);
  if (!job) { res.status(404).json({ error: "Job not found" }); return; }

  const rows = await db
    .select()
    .from(driverLocationsTable)
    .where(eq(driverLocationsTable.jobId, jobId))
    .orderBy(desc(driverLocationsTable.recordedAt))
    .limit(20);

  res.json({ jobId, locations: rows.map(serializeLocation) });
});

export default router;
