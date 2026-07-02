import { Router, type IRouter } from "express";
import { eq, and, asc, ilike, or } from "drizzle-orm";
import { z } from "zod/v4";
import {
  db,
  dumpSitesTable,
  facilityMaterialsTable,
  facilityPricingTable,
  facilityAnalyticsTable,
  customerFacilityPreferencesTable,
  jobsTable,
} from "@workspace/db";
import { getRequestProfile, requireProfile } from "../middlewares/requireAuth";
import { requireAdmin } from "../middlewares/requireAdmin";

const router: IRouter = Router();

const MATERIAL_CATALOG = [
  ["rock", "Rock"],
  ["sand", "Sand"],
  ["gravel", "Gravel"],
  ["asphalt", "Asphalt"],
  ["concrete", "Concrete"],
  ["dirt", "Dirt"],
  ["clay", "Clay"],
  ["base", "Base"],
  ["recycled_asphalt", "Recycled Asphalt"],
  ["recycled_concrete", "Recycled Concrete"],
  ["construction_debris", "Construction Debris"],
  ["green_waste", "Green Waste"],
  ["mixed_waste", "Mixed Waste"],
  ["clean_fill", "Clean Fill"],
  ["contaminated_soil", "Contaminated Soil"],
] as const;

const materialValues = MATERIAL_CATALOG.map(([value]) => value) as [string, ...string[]];

const dumpSiteTypes = [
  "landfill",
  "transfer_station",
  "recycling_center",
  "construction_debris",
  "hazardous_waste",
  "compost",
  "asphalt_plant",
  "gravel_pit",
  "concrete_crusher",
  "quarry",
  "supplier",
] as const;

const priceTypes = [
  "tipping_fee",
  "material_purchase_price",
  "minimum_fee",
  "per_ton",
  "per_load",
  "flat_rate",
  "cash_price",
  "account_price",
  "customer_contract_price",
  "fuel_surcharge",
  "environmental_fee",
] as const;

const listQuerySchema = z.object({
  search: z.string().trim().optional(),
  city: z.string().trim().optional(),
  state: z.string().trim().optional(),
  zip: z.string().trim().optional(),
  material: z.enum(materialValues).optional(),
  type: z.enum(dumpSiteTypes).optional(),
  openNow: z.coerce.boolean().optional(),
  latitude: z.coerce.number().optional(),
  longitude: z.coerce.number().optional(),
  distanceMiles: z.coerce.number().positive().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

const recommendationQuerySchema = z.object({
  material: z.enum(materialValues),
  latitude: z.coerce.number().optional(),
  longitude: z.coerce.number().optional(),
  customerId: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(25).default(10),
});

const pricingInputSchema = z.object({
  materialType: z.enum(materialValues).optional(),
  priceType: z.enum(priceTypes),
  amount: z.coerce.number().nonnegative(),
  currency: z.string().trim().default("USD"),
  unit: z.string().trim().optional(),
  notes: z.string().trim().optional(),
  effectiveFrom: z.coerce.date().optional(),
  effectiveTo: z.coerce.date().optional(),
});

const preferencesInputSchema = z.object({
  preferredFacilities: z.array(z.number().int().positive()).default([]),
  preferredMaterials: z.array(z.string().trim()).default([]),
  preferredRoutes: z.array(z.string().trim()).default([]),
  backupFacilities: z.array(z.number().int().positive()).default([]),
  notes: z.string().trim().optional(),
});

const importInputSchema = z.object({
  sourceType: z.enum(["csv", "excel", "json", "admin_upload"]),
  rows: z.array(z.record(z.string(), z.unknown())),
});

type DumpSiteRow = typeof dumpSitesTable.$inferSelect;
type FacilityMaterialRow = typeof facilityMaterialsTable.$inferSelect;
type FacilityPricingRow = typeof facilityPricingTable.$inferSelect;
type FacilityAnalyticsRow = typeof facilityAnalyticsTable.$inferSelect;

function numberOrNull(value: unknown): number | null {
  if (value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function serializeSite(site: DumpSiteRow, distanceMiles?: number) {
  return {
    ...site,
    latitude: numberOrNull(site.latitude),
    longitude: numberOrNull(site.longitude),
    maxWeightTons: numberOrNull(site.maxWeightTons),
    fullAddress: `${site.name}, ${site.address}, ${site.city}, ${site.state} ${site.zip}`,
    ...(distanceMiles != null ? { distanceMiles: Math.round(distanceMiles * 10) / 10 } : {}),
  };
}

function serializePricing(price: FacilityPricingRow) {
  return {
    ...price,
    amount: Number(price.amount),
  };
}

function emptyAnalytics(dumpSiteId: number) {
  return {
    dumpSiteId,
    loadsReceived: 0,
    averageWaitTimeMinutes: null,
    averageUnloadTimeMinutes: null,
    averageTons: null,
    revenue: 0,
    tippingFees: 0,
    driverRatingAverage: null,
    customerRatingAverage: null,
    completionRate: null,
    rejectedLoads: 0,
    peakHours: [],
    utilization: null,
  };
}

function serializeAnalytics(row: FacilityAnalyticsRow | undefined, dumpSiteId: number) {
  if (!row) return emptyAnalytics(dumpSiteId);
  return {
    dumpSiteId,
    loadsReceived: row.loadsReceived,
    averageWaitTimeMinutes: numberOrNull(row.averageWaitTimeMinutes),
    averageUnloadTimeMinutes: numberOrNull(row.averageUnloadTimeMinutes),
    averageTons: numberOrNull(row.averageTons),
    revenue: Number(row.revenue),
    tippingFees: Number(row.tippingFees),
    driverRatingAverage: numberOrNull(row.driverRatingAverage),
    customerRatingAverage: numberOrNull(row.customerRatingAverage),
    completionRate: numberOrNull(row.completionRate),
    rejectedLoads: row.rejectedLoads,
    peakHours: row.peakHours,
    utilization: numberOrNull(row.utilization),
  };
}

function distanceMiles(fromLat?: number, fromLng?: number, toLat?: number | null, toLng?: number | null): number | undefined {
  if (fromLat == null || fromLng == null || toLat == null || toLng == null) return undefined;
  const toRadians = (degrees: number) => degrees * Math.PI / 180;
  const earthRadiusMiles = 3958.8;
  const dLat = toRadians(toLat - fromLat);
  const dLng = toRadians(toLng - fromLng);
  const lat1 = toRadians(fromLat);
  const lat2 = toRadians(toLat);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * earthRadiusMiles * Math.asin(Math.sqrt(a));
}

async function loadFacilityParts(id: number) {
  const [site] = await db.select().from(dumpSitesTable).where(and(eq(dumpSitesTable.id, id), eq(dumpSitesTable.isActive, true)));
  if (!site) return null;
  const [materials, pricing, analyticsRows] = await Promise.all([
    db.select().from(facilityMaterialsTable).where(eq(facilityMaterialsTable.dumpSiteId, id)),
    db.select().from(facilityPricingTable).where(and(eq(facilityPricingTable.dumpSiteId, id), eq(facilityPricingTable.isActive, true))),
    db.select().from(facilityAnalyticsTable).where(eq(facilityAnalyticsTable.dumpSiteId, id)),
  ]);
  return {
    site,
    materials,
    pricing,
    analytics: analyticsRows[0],
  };
}

function publicMaterials(site: DumpSiteRow, materials: FacilityMaterialRow[]) {
  const accepted = materials.filter((m) => m.disposition === "accepted").map((m) => m.materialType);
  const rejected = materials.filter((m) => m.disposition === "rejected").map((m) => m.materialType);
  return {
    acceptedMaterials: accepted.length ? accepted : site.acceptedMaterials,
    rejectedMaterials: rejected.length ? rejected : site.rejectedMaterials,
  };
}

function mapIcon(type: DumpSiteRow["type"]) {
  if (type === "asphalt_plant") return "factory";
  if (type === "gravel_pit" || type === "quarry") return "mountain";
  if (type === "concrete_crusher" || type === "recycling_center") return "recycle";
  if (type === "transfer_station") return "shuffle";
  return "map-pin";
}

router.get("/dump-sites", async (req, res): Promise<void> => {
  const params = listQuerySchema.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const conditions = [eq(dumpSitesTable.isActive, true)];

  if (params.data.state) conditions.push(eq(dumpSitesTable.state, params.data.state.toUpperCase()));
  if (params.data.city) conditions.push(ilike(dumpSitesTable.city, params.data.city));
  if (params.data.zip) conditions.push(eq(dumpSitesTable.zip, params.data.zip));
  if (params.data.type) conditions.push(eq(dumpSitesTable.type, params.data.type as any));
  if (params.data.openNow) conditions.push(eq(dumpSitesTable.status, "open"));
  if (params.data.search) {
    const q = `%${params.data.search}%`;
    conditions.push(or(
      ilike(dumpSitesTable.name, q),
      ilike(dumpSitesTable.city, q),
      ilike(dumpSitesTable.state, q),
      ilike(dumpSitesTable.zip, q),
      ilike(dumpSitesTable.address, q),
    )!);
  }

  const sites = await db
    .select()
    .from(dumpSitesTable)
    .where(and(...conditions))
    .orderBy(asc(dumpSitesTable.state), asc(dumpSitesTable.name));

  let materialAllowedIds: Set<number> | null = null;
  if (params.data.material) {
    const materialRows = await db
      .select()
      .from(facilityMaterialsTable)
      .where(and(
        eq(facilityMaterialsTable.materialType, params.data.material as any),
        eq(facilityMaterialsTable.disposition, "accepted"),
      ));
    materialAllowedIds = new Set(materialRows.map((m) => m.dumpSiteId));
  }

  const withDistance = sites
    .filter((site) => !materialAllowedIds || materialAllowedIds.has(site.id) || site.acceptedMaterials.includes(params.data.material!))
    .map((site) => {
      const distance = distanceMiles(
        params.data.latitude,
        params.data.longitude,
        numberOrNull(site.latitude),
        numberOrNull(site.longitude),
      );
      return { site, distance };
    })
    .filter(({ distance }) => params.data.distanceMiles == null || (distance != null && distance <= params.data.distanceMiles!))
    .sort((a, b) => (a.distance ?? Number.MAX_SAFE_INTEGER) - (b.distance ?? Number.MAX_SAFE_INTEGER));

  const page = withDistance.slice(params.data.offset, params.data.offset + params.data.limit);

  res.json({
    items: page.map(({ site, distance }) => serializeSite(site, distance)),
    total: withDistance.length,
    limit: params.data.limit,
    offset: params.data.offset,
  });
});

router.get("/dump-sites/states", async (_req, res): Promise<void> => {
  const result = await db
    .selectDistinct({ state: dumpSitesTable.state })
    .from(dumpSitesTable)
    .where(eq(dumpSitesTable.isActive, true))
    .orderBy(asc(dumpSitesTable.state));

  const states = result.map((r) => r.state);
  res.json(states);
});

router.get("/dump-sites/materials", (_req, res): void => {
  res.json(MATERIAL_CATALOG.map(([value, label]) => ({ value, label })));
});

router.get("/dump-sites/recommendations", async (req, res): Promise<void> => {
  const params = recommendationQuerySchema.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [sites, acceptedRows, analyticsRows, pricingRows, preferenceRows] = await Promise.all([
    db.select().from(dumpSitesTable).where(and(eq(dumpSitesTable.isActive, true), eq(dumpSitesTable.status, "open"))),
    db.select().from(facilityMaterialsTable).where(and(
      eq(facilityMaterialsTable.materialType, params.data.material as any),
      eq(facilityMaterialsTable.disposition, "accepted"),
    )),
    db.select().from(facilityAnalyticsTable),
    db.select().from(facilityPricingTable).where(and(eq(facilityPricingTable.isActive, true), eq(facilityPricingTable.materialType, params.data.material as any))),
    params.data.customerId
      ? db.select().from(customerFacilityPreferencesTable).where(eq(customerFacilityPreferencesTable.customerId, params.data.customerId))
      : Promise.resolve([]),
  ]);

  const acceptedIds = new Set(acceptedRows.map((row) => row.dumpSiteId));
  const analyticsBySite = new Map(analyticsRows.map((row) => [row.dumpSiteId, row]));
  const pricingBySite = new Map<number, FacilityPricingRow[]>();
  for (const price of pricingRows) {
    pricingBySite.set(price.dumpSiteId, [...(pricingBySite.get(price.dumpSiteId) ?? []), price]);
  }
  const prefs = preferenceRows[0];

  const recommendations = sites
    .filter((site) => acceptedIds.has(site.id) || site.acceptedMaterials.includes(params.data.material))
    .map((site) => {
      const analytics = analyticsBySite.get(site.id);
      const distance = distanceMiles(params.data.latitude, params.data.longitude, numberOrNull(site.latitude), numberOrNull(site.longitude));
      const prices = pricingBySite.get(site.id) ?? [];
      const wait = numberOrNull(analytics?.averageWaitTimeMinutes) ?? site.estimatedWaitMinutes ?? 30;
      const completionRate = numberOrNull(analytics?.completionRate) ?? 90;
      const utilization = numberOrNull(analytics?.utilization) ?? 60;
      const lowestFee = prices.length ? Math.min(...prices.map((p) => Number(p.amount))) : 0;
      const preferred = prefs?.preferredFacilities.includes(site.id) ?? false;
      const backup = prefs?.backupFacilities.includes(site.id) ?? false;

      const scoreBreakdown = {
        distance: distance == null ? 10 : Math.max(0, 20 - distance),
        traffic: site.currentStatus === "light_traffic" ? 10 : site.currentStatus === "busy" ? -10 : 5,
        operatingHours: site.status === "open" ? 15 : -30,
        acceptedMaterials: 20,
        capacity: site.capacityLoadsPerDay ? Math.min(10, site.capacityLoadsPerDay / 10) : 5,
        customerPreference: preferred ? 15 : backup ? 7 : 0,
        historicalWaitTime: Math.max(-10, 10 - wait / 6),
        historicalPerformance: completionRate / 10,
        driverHistory: numberOrNull(analytics?.driverRatingAverage) ?? 3,
        materialPricing: lowestFee ? Math.max(-10, 10 - lowestFee / 25) : 0,
        tippingFees: prices.some((p) => p.priceType === "tipping_fee") ? -2 : 0,
      };
      const score = Object.values(scoreBreakdown).reduce((sum, value) => sum + value, 0);
      const reasons = [
        `${params.data.material.replace(/_/g, " ")} accepted`,
        site.status === "open" ? "facility open" : "facility not open",
        preferred ? "customer preferred facility" : backup ? "customer backup facility" : "broker approval required",
        distance != null ? `${Math.round(distance * 10) / 10} miles away` : "distance unavailable",
        `${Math.round(wait)} minute historical/current wait`,
      ];
      return { facility: serializeSite(site, distance), score: Math.round(score * 10) / 10, reasons, scoreBreakdown };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, params.data.limit);

  res.json({ recommendations, brokerApprovalRequired: true });
});

router.get("/dump-sites/preferences", requireProfile, async (req, res): Promise<void> => {
  const profile = getRequestProfile(req);
  const [prefs] = await db.select().from(customerFacilityPreferencesTable).where(eq(customerFacilityPreferencesTable.customerId, profile.id));
  res.json(prefs ? {
    customerId: prefs.customerId,
    preferredFacilities: prefs.preferredFacilities,
    preferredMaterials: prefs.preferredMaterials,
    preferredRoutes: prefs.preferredRoutes,
    backupFacilities: prefs.backupFacilities,
    notes: prefs.notes,
  } : {
    customerId: profile.id,
    preferredFacilities: [],
    preferredMaterials: [],
    preferredRoutes: [],
    backupFacilities: [],
    notes: null,
  });
});

router.put("/dump-sites/preferences", requireProfile, async (req, res): Promise<void> => {
  const profile = getRequestProfile(req);
  if (profile.role !== "customer" && profile.role !== "supervisor") {
    res.status(403).json({ error: "Only customer-side users can update facility preferences." });
    return;
  }
  const parsed = preferencesInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [prefs] = await db
    .insert(customerFacilityPreferencesTable)
    .values({ customerId: profile.id, ...parsed.data, notes: parsed.data.notes ?? null })
    .onConflictDoUpdate({
      target: customerFacilityPreferencesTable.customerId,
      set: { ...parsed.data, notes: parsed.data.notes ?? null },
    })
    .returning();
  res.json({
    customerId: prefs.customerId,
    preferredFacilities: prefs.preferredFacilities,
    preferredMaterials: prefs.preferredMaterials,
    preferredRoutes: prefs.preferredRoutes,
    backupFacilities: prefs.backupFacilities,
    notes: prefs.notes,
  });
});

router.post("/dump-sites/imports", requireProfile, requireAdmin, async (req, res): Promise<void> => {
  const parsed = importInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const existing = await db.select().from(dumpSitesTable);
  const existingKeys = new Set(existing.map((site) =>
    `${site.name.trim().toLowerCase()}|${site.address.trim().toLowerCase()}|${site.city.trim().toLowerCase()}|${site.state.trim().toLowerCase()}|${site.zip.trim()}`,
  ));
  const seen = new Set<string>();
  const duplicateRows: Record<string, unknown>[] = [];
  const errors: string[] = [];
  let validRows = 0;

  parsed.data.rows.forEach((row, index) => {
    const name = String(row.name ?? row.facilityName ?? "").trim();
    const address = String(row.address ?? "").trim();
    const city = String(row.city ?? "").trim();
    const state = String(row.state ?? "").trim();
    const zip = String(row.zip ?? row.postalCode ?? "").trim();
    if (!name || !address || !city || !state || !zip) {
      errors.push(`Row ${index + 1}: name, address, city, state, and zip are required.`);
      return;
    }
    const key = `${name.toLowerCase()}|${address.toLowerCase()}|${city.toLowerCase()}|${state.toLowerCase()}|${zip}`;
    if (existingKeys.has(key) || seen.has(key)) {
      duplicateRows.push(row);
      return;
    }
    seen.add(key);
    validRows += 1;
  });

  res.json({ validRows, duplicateRows, errors });
});

router.get("/dump-sites/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid facility id" });
    return;
  }
  const parts = await loadFacilityParts(id);
  if (!parts) {
    res.status(404).json({ error: "Facility not found" });
    return;
  }
  res.json({
    ...serializeSite(parts.site),
    materials: parts.materials,
    pricing: parts.pricing.map(serializePricing),
    analytics: serializeAnalytics(parts.analytics, id),
  });
});

router.get("/dump-sites/:id/pricing", requireProfile, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid facility id" });
    return;
  }
  const pricing = await db.select().from(facilityPricingTable).where(and(eq(facilityPricingTable.dumpSiteId, id), eq(facilityPricingTable.isActive, true)));
  res.json(pricing.map(serializePricing));
});

router.post("/dump-sites/:id/pricing", requireProfile, requireAdmin, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid facility id" });
    return;
  }
  const parsed = pricingInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [price] = await db.insert(facilityPricingTable).values({
    dumpSiteId: id,
    materialType: (parsed.data.materialType as any) ?? null,
    priceType: parsed.data.priceType as any,
    amount: String(parsed.data.amount),
    currency: parsed.data.currency,
    unit: parsed.data.unit ?? null,
    notes: parsed.data.notes ?? null,
    effectiveFrom: parsed.data.effectiveFrom ?? new Date(),
    effectiveTo: parsed.data.effectiveTo ?? null,
  }).returning();
  res.status(201).json(serializePricing(price));
});

router.get("/dump-sites/:id/analytics", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid facility id" });
    return;
  }
  const [analytics] = await db.select().from(facilityAnalyticsTable).where(eq(facilityAnalyticsTable.dumpSiteId, id));
  res.json(serializeAnalytics(analytics, id));
});

router.get("/dump-sites/:id/driver-view", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid facility id" });
    return;
  }
  const parts = await loadFacilityParts(id);
  if (!parts) {
    res.status(404).json({ error: "Facility not found" });
    return;
  }
  let currentJobNotes: string | null = null;
  if (req.query.jobId) {
    const jobId = Number(req.query.jobId);
    if (Number.isInteger(jobId)) {
      const [job] = await db.select({ notes: jobsTable.notes }).from(jobsTable).where(eq(jobsTable.id, jobId));
      currentJobNotes = job?.notes ?? null;
    }
  }
  res.json({
    id: parts.site.id,
    name: parts.site.name,
    directions: `${parts.site.address}, ${parts.site.city}, ${parts.site.state} ${parts.site.zip}`,
    photos: parts.site.photos,
    gateInstructions: parts.site.entranceInstructions,
    scaleInstructions: parts.site.scaleLocation || parts.site.scaleHours
      ? [parts.site.scaleLocation, parts.site.scaleHours].filter(Boolean).join(" • ")
      : null,
    unloadInstructions: parts.site.exitInstructions,
    hours: parts.site.operatingHours,
    phoneNumber: parts.site.phone,
    currentJobNotes,
    safetyWarnings: [...parts.site.safetyRules, ...parts.site.ppeRequirements, ...parts.site.truckRestrictions],
  });
});

router.get("/dump-sites/:id/broker-view", requireProfile, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid facility id" });
    return;
  }
  const profile = getRequestProfile(req);
  if (!profile.staffRole && profile.role !== "customer" && profile.role !== "supervisor") {
    res.status(403).json({ error: "Broker view requires customer-side or staff access." });
    return;
  }
  const parts = await loadFacilityParts(id);
  if (!parts) {
    res.status(404).json({ error: "Facility not found" });
    return;
  }
  res.json({
    ...serializeSite(parts.site),
    materials: parts.materials,
    pricing: parts.pricing.map(serializePricing),
    analytics: serializeAnalytics(parts.analytics, id),
    internalBrokerNotes: parts.site.brokerNotes,
  });
});

router.get("/dump-sites/:id/customer-view", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid facility id" });
    return;
  }
  const parts = await loadFacilityParts(id);
  if (!parts) {
    res.status(404).json({ error: "Facility not found" });
    return;
  }
  const materials = publicMaterials(parts.site, parts.materials);
  res.json({
    id: parts.site.id,
    name: parts.site.name,
    type: parts.site.type,
    address: parts.site.address,
    city: parts.site.city,
    state: parts.site.state,
    zip: parts.site.zip,
    ...materials,
    status: parts.site.status,
    currentStatus: parts.site.currentStatus,
    operatingHours: parts.site.operatingHours,
  });
});

router.get("/dump-sites/:id/map-view", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid facility id" });
    return;
  }
  const parts = await loadFacilityParts(id);
  if (!parts) {
    res.status(404).json({ error: "Facility not found" });
    return;
  }
  const materials = publicMaterials(parts.site, parts.materials);
  res.json({
    id: parts.site.id,
    name: parts.site.name,
    type: parts.site.type,
    latitude: numberOrNull(parts.site.latitude),
    longitude: numberOrNull(parts.site.longitude),
    status: parts.site.status,
    currentStatus: parts.site.currentStatus,
    icon: mapIcon(parts.site.type),
    acceptedMaterials: materials.acceptedMaterials,
    estimatedWaitMinutes: parts.site.estimatedWaitMinutes,
  });
});

export default router;
