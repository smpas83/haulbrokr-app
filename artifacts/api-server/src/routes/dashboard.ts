import { Router, type IRouter } from "express";
import { eq, or, sql, and } from "drizzle-orm";
import { db, requestsTable, jobsTable, bidsTable, activityTable } from "@workspace/db";
import { getRequestProfile, requireProfile } from "../middlewares/requireAuth";
import {
  GetDashboardStatsResponse,
  GetDashboardActivityResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/dashboard/stats", requireProfile, async (req, res): Promise<void> => {
  const profile = getRequestProfile(req);

  if (profile.role === "customer") {
    const [openResult] = await db.select({ count: sql<number>`count(*)` }).from(requestsTable)
      .where(and(eq(requestsTable.customerId, profile.id), eq(requestsTable.status, "open")));
    const [activeResult] = await db.select({ count: sql<number>`count(*)` }).from(jobsTable)
      .where(and(eq(jobsTable.customerId, profile.id), or(
        eq(jobsTable.status, "active"),
        eq(jobsTable.status, "awarded"),
        eq(jobsTable.status, "accepted"),
        eq(jobsTable.status, "in_progress"),
      )));
    const [completedResult] = await db.select({ count: sql<number>`count(*)` }).from(jobsTable)
      .where(and(eq(jobsTable.customerId, profile.id), eq(jobsTable.status, "completed")));
    const [spentResult] = await db.select({ total: sql<number>`coalesce(sum(total_amount), 0)` }).from(jobsTable)
      .where(and(eq(jobsTable.customerId, profile.id), eq(jobsTable.status, "completed")));

    res.json(GetDashboardStatsResponse.parse({
      openRequests: Number(openResult?.count ?? 0),
      activeJobs: Number(activeResult?.count ?? 0),
      completedJobs: Number(completedResult?.count ?? 0),
      totalBids: 0,
      pendingBids: 0,
      totalRevenue: 0,
      totalSpent: Number(spentResult?.total ?? 0),
    }));
  } else {
    const [pendingBidsResult] = await db.select({ count: sql<number>`count(*)` }).from(bidsTable)
      .where(and(eq(bidsTable.providerId, profile.id), eq(bidsTable.status, "pending")));
    const [totalBidsResult] = await db.select({ count: sql<number>`count(*)` }).from(bidsTable)
      .where(eq(bidsTable.providerId, profile.id));
    const [activeResult] = await db.select({ count: sql<number>`count(*)` }).from(jobsTable)
      .where(and(eq(jobsTable.providerId, profile.id), or(
        eq(jobsTable.status, "active"),
        eq(jobsTable.status, "awarded"),
        eq(jobsTable.status, "accepted"),
        eq(jobsTable.status, "in_progress"),
      )));
    const [completedResult] = await db.select({ count: sql<number>`count(*)` }).from(jobsTable)
      .where(and(eq(jobsTable.providerId, profile.id), eq(jobsTable.status, "completed")));
    const [revenueResult] = await db.select({ total: sql<number>`coalesce(sum(total_amount), 0)` }).from(jobsTable)
      .where(and(eq(jobsTable.providerId, profile.id), eq(jobsTable.status, "completed")));

    res.json(GetDashboardStatsResponse.parse({
      openRequests: 0,
      activeJobs: Number(activeResult?.count ?? 0),
      completedJobs: Number(completedResult?.count ?? 0),
      totalBids: Number(totalBidsResult?.count ?? 0),
      pendingBids: Number(pendingBidsResult?.count ?? 0),
      totalRevenue: Number(revenueResult?.total ?? 0),
      totalSpent: 0,
    }));
  }
});

router.get("/dashboard/activity", requireProfile, async (req, res): Promise<void> => {
  const profile = getRequestProfile(req);
  const activities = await db.select().from(activityTable)
    .where(eq(activityTable.profileId, profile.id))
    .orderBy(sql`${activityTable.createdAt} desc`)
    .limit(20);
  res.json(GetDashboardActivityResponse.parse(activities));
});

export default router;
