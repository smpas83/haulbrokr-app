import { Router, type IRouter, type Response } from "express";
import { eq } from "drizzle-orm";
import { db, quickbooksConnectionsTable, jobsTable } from "@workspace/db";
import { getRequestProfile, requireProfile } from "../middlewares/requireAuth";

const router: IRouter = Router();

function quickBooksLiveConfigured(): boolean {
  return Boolean(process.env.QUICKBOOKS_CLIENT_ID && process.env.QUICKBOOKS_CLIENT_SECRET);
}

function blockSimulatedQuickBooksInProduction(res: Response): boolean {
  if (process.env.NODE_ENV === "production" && !quickBooksLiveConfigured()) {
    res.status(501).json({ error: "QuickBooks sync requires production OAuth credentials before it can be enabled." });
    return true;
  }
  return false;
}

router.get("/quickbooks/status", requireProfile, async (req, res): Promise<void> => {
  const profile = getRequestProfile(req);
  const [conn] = await db.select().from(quickbooksConnectionsTable)
    .where(eq(quickbooksConnectionsTable.profileId, profile.id));
  res.json(conn ?? { connected: false, invoicesSynced: 0, lastSyncedAt: null, companyName: null });
});

// Simulated OAuth connect (in production this would redirect to QB OAuth)
router.post("/quickbooks/connect", requireProfile, async (req, res): Promise<void> => {
  if (blockSimulatedQuickBooksInProduction(res)) return;
  const profile = getRequestProfile(req);
  const { companyName } = req.body;
  if (!companyName) { res.status(400).json({ error: "companyName is required" }); return; }

  const existing = await db.select().from(quickbooksConnectionsTable)
    .where(eq(quickbooksConnectionsTable.profileId, profile.id));

  if (existing.length > 0) {
    const [updated] = await db.update(quickbooksConnectionsTable)
      .set({ connected: true, companyName, realmId: `qb_${profile.id}_${Date.now()}` })
      .where(eq(quickbooksConnectionsTable.profileId, profile.id))
      .returning();
    res.json(updated);
    return;
  }

  const [created] = await db.insert(quickbooksConnectionsTable).values({
    profileId: profile.id,
    connected: true,
    companyName,
    realmId: `qb_${profile.id}_${Date.now()}`,
  }).returning();
  res.status(201).json(created);
});

router.post("/quickbooks/disconnect", requireProfile, async (req, res): Promise<void> => {
  const profile = getRequestProfile(req);
  await db.update(quickbooksConnectionsTable)
    .set({ connected: false, realmId: null })
    .where(eq(quickbooksConnectionsTable.profileId, profile.id));
  res.json({ success: true });
});

router.post("/quickbooks/sync", requireProfile, async (req, res): Promise<void> => {
  if (blockSimulatedQuickBooksInProduction(res)) return;
  const profile = getRequestProfile(req);
  const [conn] = await db.select().from(quickbooksConnectionsTable)
    .where(eq(quickbooksConnectionsTable.profileId, profile.id));
  if (!conn?.connected) {
    res.status(400).json({ error: "QuickBooks not connected" });
    return;
  }

  // Count completed jobs to simulate sync
  const jobs = await db.select().from(jobsTable)
    .where(eq(jobsTable.providerId, profile.id));
  const completedJobs = jobs.filter(j => j.status === "completed").length;

  const [updated] = await db.update(quickbooksConnectionsTable)
    .set({
      lastSyncedAt: new Date(),
      lastSyncStatus: "success",
      invoicesSynced: conn.invoicesSynced + completedJobs,
    })
    .where(eq(quickbooksConnectionsTable.profileId, profile.id))
    .returning();

  res.json({
    success: true,
    invoicesSynced: completedJobs,
    totalSynced: updated.invoicesSynced,
    lastSyncedAt: updated.lastSyncedAt,
  });
});

export default router;
