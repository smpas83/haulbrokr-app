import { Router, type IRouter } from "express";
import { eq, and, asc, sql } from "drizzle-orm";
import { z } from "zod/v4";
import { db, dumpSitesTable } from "@workspace/db";
import {
  ListDumpSitesQueryParams,
  ListDumpSitesResponse,
  ListDumpSiteStatesResponse,
} from "@workspace/api-zod";
import { requireProfile } from "../middlewares/requireAuth";
import { geocodeAddressCached } from "../lib/geocodeCache";
import { computeDrivingRoute, type LatLng } from "../lib/googleRoutes";

const router: IRouter = Router();

const FacilityRoutesQuery = z.object({
  pickupLat: z.coerce.number().min(-90).max(90),
  pickupLng: z.coerce.number().min(-180).max(180),
  pickupAddress: z.string().min(3).max(500).optional(),
  state: z.string().length(2).optional(),
  type: z.string().optional(),
  limit: z.coerce.number().min(1).max(10).optional(),
});

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

  const enriched = sites.map((s) => ({
    ...s,
    fullAddress: `${s.name}, ${s.address}, ${s.city}, ${s.state} ${s.zip}`,
  }));

  res.json(ListDumpSitesResponse.parse(enriched));
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

/**
 * Driving routes from a pickup location to nearby facilities (pickup → landfill/transfer).
 * Geocodes facility addresses on demand and ranks by driving distance.
 */
router.get("/dump-sites/routes", requireProfile, async (req, res): Promise<void> => {
  const parsed = FacilityRoutesQuery.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const pickup: LatLng = { latitude: parsed.data.pickupLat, longitude: parsed.data.pickupLng };
  const limit = parsed.data.limit ?? 5;

  const conditions = [eq(dumpSitesTable.isActive, true)];
  if (parsed.data.state) {
    conditions.push(eq(dumpSitesTable.state, parsed.data.state));
  }
  if (parsed.data.type) {
    conditions.push(eq(dumpSitesTable.type, parsed.data.type as any));
  }

  const sites = await db
    .select()
    .from(dumpSitesTable)
    .where(and(...conditions))
    .orderBy(asc(dumpSitesTable.state), asc(dumpSitesTable.name))
    .limit(50);

  const routes: {
    siteId: number;
    name: string;
    fullAddress: string;
    type: string;
    distanceMiles: number;
    durationSeconds: number;
    etaIso: string;
    polyline: LatLng[];
    encodedPolyline: string;
    source: string;
  }[] = [];

  for (const site of sites) {
    const fullAddress = `${site.address}, ${site.city}, ${site.state} ${site.zip}`;
    const facilityCoord = await geocodeAddressCached(fullAddress);
    if (!facilityCoord) continue;

    try {
      const route = await computeDrivingRoute(pickup, facilityCoord);
      routes.push({
        siteId: site.id,
        name: site.name,
        fullAddress: `${site.name}, ${site.address}, ${site.city}, ${site.state} ${site.zip}`,
        type: site.type,
        distanceMiles: route.distanceMiles,
        durationSeconds: route.durationSeconds,
        etaIso: route.etaIso,
        polyline: route.polyline,
        encodedPolyline: route.encodedPolyline,
        source: route.source,
      });
    } catch (err) {
      console.warn("[dump-sites/routes] route failed for site", site.id, err);
    }
  }

  routes.sort((a, b) => a.distanceMiles - b.distanceMiles);

  res.json({
    pickup: {
      latitude: pickup.latitude,
      longitude: pickup.longitude,
      address: parsed.data.pickupAddress ?? null,
    },
    routes: routes.slice(0, limit),
    generatedAt: new Date().toISOString(),
  });
});

export default router;
