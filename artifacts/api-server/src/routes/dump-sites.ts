import { Router, type IRouter } from "express";
import { eq, and, asc, sql } from "drizzle-orm";
import { db, dumpSitesTable } from "@workspace/db";
import {
  ListDumpSitesQueryParams,
  ListDumpSitesResponse,
  ListDumpSiteStatesResponse,
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

export default router;
