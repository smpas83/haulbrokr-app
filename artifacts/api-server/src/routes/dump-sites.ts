import { Router, type IRouter } from "express";
import { eq, and, asc } from "drizzle-orm";
import { db, dumpSitesTable } from "@workspace/db";
import { getRequestProfile, requireProfile } from "../middlewares/requireAuth";
import { serializeDumpSite } from "../lib/dumpSite";
import {
  CreateDumpSiteBody,
  GetDumpSiteParams,
  ListDumpSitesQueryParams,
  ListDumpSitesResponse,
  ListDumpSiteStatesResponse,
  GetDumpSiteResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

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

  const enriched = sites.map(serializeDumpSite);

  res.json(ListDumpSitesResponse.parse(enriched));
});

router.post("/dump-sites", requireProfile, async (req, res): Promise<void> => {
  const profile = getRequestProfile(req);
  if (!profile.staffRole) {
    res.status(403).json({ error: "Only HaulBrokr staff can add dropoff facilities" });
    return;
  }

  const parsed = CreateDumpSiteBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [site] = await db.insert(dumpSitesTable).values({
    ...parsed.data,
    state: parsed.data.state.toUpperCase(),
    latitude: parsed.data.latitude != null ? String(parsed.data.latitude) : undefined,
    longitude: parsed.data.longitude != null ? String(parsed.data.longitude) : undefined,
    acceptedMaterials: parsed.data.acceptedMaterials ?? [],
    isActive: parsed.data.isActive ?? true,
  }).returning();

  res.status(201).json(GetDumpSiteResponse.parse(serializeDumpSite(site)));
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

router.get("/dump-sites/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetDumpSiteParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [site] = await db
    .select()
    .from(dumpSitesTable)
    .where(and(eq(dumpSitesTable.id, params.data.id), eq(dumpSitesTable.isActive, true)));
  if (!site) {
    res.status(404).json({ error: "Dump site not found" });
    return;
  }

  res.json(GetDumpSiteResponse.parse(serializeDumpSite(site)));
});

export default router;
