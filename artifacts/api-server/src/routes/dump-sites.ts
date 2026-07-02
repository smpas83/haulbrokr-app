import { Router, type IRouter } from "express";
import { eq, and, asc, sql } from "drizzle-orm";
import { z } from "zod";
import { db, dumpSitesTable } from "@workspace/db";
import { getRequestProfile, requireProfile } from "../middlewares/requireAuth";
import {
  ListDumpSitesQueryParams,
  ListDumpSitesResponse,
  ListDumpSiteStatesResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

const facilityBody = z.object({
  name: z.string().min(1),
  address: z.string().min(1),
  city: z.string().min(1),
  state: z.string().min(2),
  zip: z.string().min(3),
  type: z.enum(["landfill", "transfer_station", "recycling_center", "construction_debris", "hazardous_waste", "compost"]).optional(),
  phone: z.string().nullable().optional(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  hours: z.record(z.unknown()).optional(),
  acceptedMaterials: z.array(z.string()).optional(),
  photos: z.array(z.string()).optional(),
  weightLimits: z.string().nullable().optional(),
  truckRestrictions: z.string().nullable().optional(),
  tippingFees: z.record(z.unknown()).optional(),
  materialPurchasePrices: z.record(z.unknown()).optional(),
  notes: z.string().nullable().optional(),
  liveWaitTimeMinutes: z.number().nonnegative().nullable().optional(),
  queueEstimateTrucks: z.number().nonnegative().nullable().optional(),
  isActive: z.boolean().optional(),
});

const patchFacilityBody = facilityBody.partial();

function serializeFacility(s: typeof dumpSitesTable.$inferSelect) {
  return {
    ...s,
    latitude: s.latitude != null ? parseFloat(s.latitude) : null,
    longitude: s.longitude != null ? parseFloat(s.longitude) : null,
    liveWaitTimeMinutes: s.liveWaitTimeMinutes != null ? parseFloat(s.liveWaitTimeMinutes) : null,
    queueEstimateTrucks: s.queueEstimateTrucks != null ? parseFloat(s.queueEstimateTrucks) : null,
    fullAddress: `${s.name}, ${s.address}, ${s.city}, ${s.state} ${s.zip}`,
  };
}

function toFacilityValues(data: z.infer<typeof patchFacilityBody>): Record<string, unknown> {
  return {
    ...data,
    latitude: data.latitude != null ? String(data.latitude) : data.latitude,
    longitude: data.longitude != null ? String(data.longitude) : data.longitude,
    liveWaitTimeMinutes: data.liveWaitTimeMinutes != null ? String(data.liveWaitTimeMinutes) : data.liveWaitTimeMinutes,
    queueEstimateTrucks: data.queueEstimateTrucks != null ? String(data.queueEstimateTrucks) : data.queueEstimateTrucks,
  };
}

router.get("/dump-sites", async (req, res): Promise<void> => {
  const params = ListDumpSitesQueryParams.safeParse(req.query);

  const conditions = [eq(dumpSitesTable.isActive, true)];

  if (params.success) {
    if (params.data.state) {
      conditions.push(eq(dumpSitesTable.state, params.data.state));
    }
    if (params.data.type) {
      conditions.push(eq(dumpSitesTable.type, params.data.type as any));
    }
  }

  const sites = await db
    .select()
    .from(dumpSitesTable)
    .where(and(...conditions))
    .orderBy(asc(dumpSitesTable.state), asc(dumpSitesTable.name));

  const enriched = sites.map(serializeFacility);

  res.json(ListDumpSitesResponse.parse(enriched));
});

router.get("/facilities", async (req, res): Promise<void> => {
  const params = ListDumpSitesQueryParams.safeParse(req.query);
  const conditions = [eq(dumpSitesTable.isActive, true)];
  if (params.success) {
    if (params.data.state) conditions.push(eq(dumpSitesTable.state, params.data.state));
    if (params.data.type) conditions.push(eq(dumpSitesTable.type, params.data.type as any));
  }
  const sites = await db
    .select()
    .from(dumpSitesTable)
    .where(and(...conditions))
    .orderBy(asc(dumpSitesTable.state), asc(dumpSitesTable.name));
  res.json(sites.map(serializeFacility));
});

router.post("/facilities", requireProfile, async (req, res): Promise<void> => {
  const profile = getRequestProfile(req);
  if (!profile.staffRole) {
    res.status(403).json({ error: "Only HaulBrokr staff can create facilities." });
    return;
  }
  const parsed = facilityBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [facility] = await db.insert(dumpSitesTable).values(toFacilityValues(parsed.data) as typeof dumpSitesTable.$inferInsert).returning();
  res.status(201).json(serializeFacility(facility));
});

router.patch("/facilities/:id", requireProfile, async (req, res): Promise<void> => {
  const profile = getRequestProfile(req);
  if (!profile.staffRole) {
    res.status(403).json({ error: "Only HaulBrokr staff can update facilities." });
    return;
  }
  const id = parseInt(String(req.params.id), 10);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid facility id" }); return; }
  const parsed = patchFacilityBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [facility] = await db.update(dumpSitesTable).set(toFacilityValues(parsed.data)).where(eq(dumpSitesTable.id, id)).returning();
  if (!facility) { res.status(404).json({ error: "Facility not found" }); return; }
  res.json(serializeFacility(facility));
});

router.get("/dump-sites/states", async (_req, res): Promise<void> => {
  const result = await db
    .selectDistinct({ state: dumpSitesTable.state })
    .from(dumpSitesTable)
    .where(eq(dumpSitesTable.isActive, true))
    .orderBy(asc(dumpSitesTable.state));

  const states = result.map((r) => r.state);
  res.json(ListDumpSiteStatesResponse.parse(states));
});

export default router;
