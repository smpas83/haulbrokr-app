import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import {
  db,
  profilesTable,
  jobsTable,
  requestsTable,
  w9SubmissionsTable,
  insuranceSubmissionsTable,
  driverDocumentsTable,
} from "@workspace/db";
import { requireAutomationKey } from "../middlewares/requireAutomationKey";
import { collectProductionReadiness } from "../lib/productionReadiness";

const router: IRouter = Router();

router.get("/automation/readiness", requireAutomationKey, (_req, res): void => {
  res.json(collectProductionReadiness());
});

/**
 * Read-only aggregate digest for the external automation layer.
 * Guarded by a static service key (x-automation-key header).
 * Status values mirror the schema enums:
 *  - w9/insurance verification_status: not_submitted|pending|verified|rejected
 *  - driver_documents status: missing|uploaded|verified|rejected (no expiry tracking yet)
 */
router.get("/automation/digest", requireAutomationKey, async (_req, res): Promise<void> => {
  try {
    const [
      [providerAgg],
      [customerAgg],
      [driverAgg],
      [activeJobsAgg],
      [completedJobsAgg],
      [openRequestsAgg],
      [w9PendingAgg],
      [insurancePendingAgg],
      [docsMissingAgg],
      [docsUploadedAgg],
    ] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(profilesTable).where(eq(profilesTable.role, "provider")),
      db.select({ count: sql<number>`count(*)` }).from(profilesTable).where(eq(profilesTable.role, "customer")),
      db.select({ count: sql<number>`count(*)` }).from(profilesTable).where(eq(profilesTable.role, "driver")),
      db.select({ count: sql<number>`count(*)` }).from(jobsTable).where(sql`${jobsTable.status} in ('active','awarded','accepted','in_progress')`),
      db.select({ count: sql<number>`count(*)` }).from(jobsTable).where(eq(jobsTable.status, "completed")),
      db.select({ count: sql<number>`count(*)` }).from(requestsTable).where(sql`${requestsTable.status} in ('open','bid_received','bidding')`),
      db.select({ count: sql<number>`count(*)` }).from(w9SubmissionsTable).where(sql`${w9SubmissionsTable.status} = 'pending'`),
      db.select({ count: sql<number>`count(*)` }).from(insuranceSubmissionsTable).where(sql`${insuranceSubmissionsTable.status} = 'pending'`),
      db.select({ count: sql<number>`count(*)` }).from(driverDocumentsTable).where(sql`${driverDocumentsTable.status} = 'missing'`),
      db.select({ count: sql<number>`count(*)` }).from(driverDocumentsTable).where(sql`${driverDocumentsTable.status} = 'uploaded'`),
    ]);

    res.json({
      generatedAt: new Date().toISOString(),
      users: {
        providers: Number(providerAgg?.count ?? 0),
        customers: Number(customerAgg?.count ?? 0),
        drivers: Number(driverAgg?.count ?? 0),
      },
      jobs: {
        active: Number(activeJobsAgg?.count ?? 0),
        completed: Number(completedJobsAgg?.count ?? 0),
        openRequests: Number(openRequestsAgg?.count ?? 0),
      },
      compliance: {
        w9Pending: Number(w9PendingAgg?.count ?? 0),
        insurancePending: Number(insurancePendingAgg?.count ?? 0),
        driverDocsMissing: Number(docsMissingAgg?.count ?? 0),
        driverDocsAwaitingReview: Number(docsUploadedAgg?.count ?? 0),
      },
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to build digest" });
  }
});

export default router;
