import { Router, type IRouter } from "express";
import { eq, or, sql } from "drizzle-orm";
import { z } from "zod/v4";
import {
  db,
  requestsTable,
  jobsTable,
  trucksTable,
  profilesTable,
  bidsTable,
} from "@workspace/db";
import { getRequestProfile, requireProfile } from "../middlewares/requireAuth";
import {
  buildEmptyMarketplace,
  type MarketplaceLoad,
  type MarketplacePayload,
  type MarketplaceTruck,
  buildDemoHeatZones,
} from "../lib/demoMarketplace";
import { geocodeAddressCached } from "../lib/geocodeCache";

const router: IRouter = Router();

const QuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  radiusMiles: z.coerce.number().min(1).max(500).optional(),
});

const GeocodeBody = z.object({ address: z.string().min(3).max(500) });

const OPEN_STATUSES = ["open", "bid_received", "bidding"] as const;
const ACTIVE_JOB_STATUSES = ["active", "awarded", "accepted", "in_progress"] as const;

function haversineMiles(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }): number {
  const R = 3958.8;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

async function countLiveMarketplaceRows(): Promise<number> {
  const [[openReq], [activeJob], [truckCount]] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)` })
      .from(requestsTable)
      .where(or(
        eq(requestsTable.status, "open"),
        eq(requestsTable.status, "bid_received"),
        eq(requestsTable.status, "bidding"),
      )),
    db
      .select({ count: sql<number>`count(*)` })
      .from(jobsTable)
      .where(or(
        eq(jobsTable.status, "active"),
        eq(jobsTable.status, "awarded"),
        eq(jobsTable.status, "accepted"),
        eq(jobsTable.status, "in_progress"),
      )),
    db.select({ count: sql<number>`count(*)` }).from(trucksTable),
  ]);
  return Number(openReq?.count ?? 0) + Number(activeJob?.count ?? 0) + Number(truckCount?.count ?? 0);
}

async function buildLiveMarketplace(profile: { id: number; role: string }): Promise<MarketplacePayload> {
  const [openRequests, activeJobs, allTrucks] = await Promise.all([
    db
      .select()
      .from(requestsTable)
      .where(or(
        eq(requestsTable.status, "open"),
        eq(requestsTable.status, "bid_received"),
        eq(requestsTable.status, "bidding"),
      ))
      .orderBy(sql`${requestsTable.createdAt} desc`)
      .limit(300),
    db
      .select()
      .from(jobsTable)
      .where(or(
        eq(jobsTable.status, "active"),
        eq(jobsTable.status, "awarded"),
        eq(jobsTable.status, "accepted"),
        eq(jobsTable.status, "in_progress"),
      ))
      .orderBy(sql`${jobsTable.createdAt} desc`)
      .limit(200),
    db
      .select({
        truck: trucksTable,
        ownerCompany: profilesTable.companyName,
      })
      .from(trucksTable)
      .leftJoin(profilesTable, eq(trucksTable.ownerId, profilesTable.id))
      .limit(200),
  ]);

  const loads: MarketplaceLoad[] = [];

  for (const r of openRequests) {
    const coord = await geocodeAddressCached(r.pickupAddress);
    if (!coord) continue;
    const [bidCountRow] = await db
      .select({ count: sql<number>`count(*)` })
      .from(bidsTable)
      .where(eq(bidsTable.requestId, r.id));
    loads.push({
      id: `req-${r.id}`,
      kind: "request",
      status: r.status,
      projectName: `${r.materialType} haul — ${r.pickupAddress.split(",")[1]?.trim() ?? "Site"}`,
      material: r.materialType,
      pickupAddress: r.pickupAddress,
      deliveryAddress: r.deliveryAddress,
      budgetPerHour: r.budgetPerHour ? parseFloat(r.budgetPerHour) : 95,
      trucksNeeded: r.trucksNeeded,
      bidsCount: Number(bidCountRow?.count ?? 0),
      latitude: coord.latitude,
      longitude: coord.longitude,
      scheduledDate: r.scheduledDate.toISOString(),
    });
  }

  for (const j of activeJobs) {
    const coord = await geocodeAddressCached(j.pickupAddress);
    if (!coord) continue;
    loads.push({
      id: String(j.id),
      kind: "job",
      status: j.status === "in_progress" ? "in_progress" : "accepted",
      projectName: `${j.materialType} job — ${j.pickupAddress.split(",")[1]?.trim() ?? "Site"}`,
      material: j.materialType,
      pickupAddress: j.pickupAddress,
      deliveryAddress: j.deliveryAddress,
      budgetPerHour: parseFloat(j.ratePerHour),
      trucksNeeded: j.trucksAssigned,
      bidsCount: 0,
      latitude: coord.latitude,
      longitude: coord.longitude,
      scheduledDate: j.scheduledDate.toISOString(),
    });
  }

  const trucks: MarketplaceTruck[] = [];
  for (const row of allTrucks) {
    const owner = row.ownerCompany ?? "Carrier";
    const baseCity = owner.split(" ")[0] ?? "Dallas";
    const coord = await geocodeAddressCached(`${baseCity}, TX, USA`);
    if (!coord) continue;
    trucks.push({
      id: row.truck.id,
      label: row.truck.truckNumber ?? `Truck ${row.truck.id}`,
      truckType: row.truck.truckType,
      status: row.truck.isAvailable ? "available" : "assigned",
      latitude: coord.latitude + (row.truck.id % 7) * 0.01,
      longitude: coord.longitude + (row.truck.id % 5) * 0.01,
      ownerCompany: owner,
      headingDegrees: (row.truck.id * 41) % 360,
      speedMph: row.truck.isAvailable ? 0 : 18 + (row.truck.id % 15),
    });
  }

  const [[providerCount]] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(profilesTable).where(eq(profilesTable.role, "provider")),
  ]);

  const center =
    loads[0] != null
      ? { latitude: loads[0].latitude, longitude: loads[0].longitude }
      : trucks[0] != null
        ? { latitude: trucks[0].latitude, longitude: trucks[0].longitude }
        : { latitude: 39.8283, longitude: -98.5795 };

  return {
    demoMode: false,
    generatedAt: new Date().toISOString(),
    center,
    loads,
    trucks,
    heatZones: buildDemoHeatZones(loads),
    stats: {
      openLoads: loads.filter((l) => OPEN_STATUSES.includes(l.status as typeof OPEN_STATUSES[number])).length,
      activeJobs: loads.filter((l) => ACTIVE_JOB_STATUSES.includes(l.status as typeof ACTIVE_JOB_STATUSES[number]) || l.status === "accepted" || l.status === "in_progress").length,
      availableTrucks: trucks.filter((t) => t.status === "available").length,
      providers: Number(providerCount?.count ?? 0),
    },
  };
}

function filterByRadius(payload: MarketplacePayload, lat: number, lng: number, radiusMiles: number): MarketplacePayload {
  const origin = { latitude: lat, longitude: lng };
  return {
    ...payload,
    loads: payload.loads.filter((l) => haversineMiles(origin, l) <= radiusMiles),
    trucks: payload.trucks.filter((t) => haversineMiles(origin, t) <= radiusMiles),
  };
}

async function handleMarketplace(req: Parameters<typeof getRequestProfile>[0], res: import("express").Response): Promise<void> {
  const profile = getRequestProfile(req);
  const parsed = QuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  try {
    const liveCount = await countLiveMarketplaceRows();
    let payload: MarketplacePayload =
      liveCount === 0 ? buildEmptyMarketplace() : await buildLiveMarketplace(profile);

    if (parsed.data.lat != null && parsed.data.lng != null && parsed.data.radiusMiles != null) {
      payload = filterByRadius(payload, parsed.data.lat, parsed.data.lng, parsed.data.radiusMiles);
    }

    res.json(payload);
  } catch (err) {
    console.error("[map/marketplace]", err);
    res.status(500).json({ error: "Failed to load marketplace data" });
  }
}

/**
 * Forward-geocode a street address (Google Geocoding API when configured, else Nominatim).
 * Kept for clients that predate GET /map/marketplace server-side geocoding.
 */
router.post("/maps/geocode", requireProfile, async (req, res): Promise<void> => {
  const parsed = GeocodeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const coord = await geocodeAddressCached(parsed.data.address);
  if (!coord) {
    res.status(404).json({ error: "Address not found" });
    return;
  }
  res.json(coord);
});

/**
 * Nationwide marketplace map data — loads, trucks, heat zones from the database.
 * Returns an empty payload when no live marketplace rows exist.
 */
router.get("/map/marketplace", requireProfile, (req, res) => handleMarketplace(req, res));
router.get("/map", requireProfile, (req, res) => handleMarketplace(req, res));
router.get("/maps", requireProfile, (req, res) => handleMarketplace(req, res));

export default router;
