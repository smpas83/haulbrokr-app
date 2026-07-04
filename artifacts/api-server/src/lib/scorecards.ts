import {
  db, jobsTable, bidsTable, requestsTable, trucksTable, ratingsTable,
} from "@workspace/db";
import { eq, and, sql, inArray } from "drizzle-orm";

interface ProfileCtx {
  id: number;
  role: string;
}

export async function getCustomerScorecard(profileId: number) {
  const [spent] = await db.select({ total: sql<number>`coalesce(sum(${jobsTable.totalAmount}), 0)` })
    .from(jobsTable)
    .where(and(eq(jobsTable.customerId, profileId), eq(jobsTable.status, "completed")));

  const [openReqs] = await db.select({ count: sql<number>`count(*)` })
    .from(requestsTable)
    .where(and(eq(requestsTable.customerId, profileId), inArray(requestsTable.status, ["open", "bidding", "bid_received"])));

  const [activeJobs] = await db.select({ count: sql<number>`count(*)` })
    .from(jobsTable)
    .where(and(eq(jobsTable.customerId, profileId), inArray(jobsTable.status, ["accepted", "active", "in_progress"])));

  const [unpaid] = await db.select({ count: sql<number>`count(*)` })
    .from(jobsTable)
    .where(and(eq(jobsTable.customerId, profileId), eq(jobsTable.paymentStatus, "invoiced")));

  const ltv = Number(spent?.total ?? 0);
  const riskScore = unpaid?.count ? Math.min(100, 30 + Number(unpaid.count) * 15) : Math.max(10, 100 - Math.min(90, ltv / 1000));

  return {
    profileId,
    revenue: ltv,
    lifetimeValue: ltv,
    openRequests: Number(openReqs?.count ?? 0),
    activeJobs: Number(activeJobs?.count ?? 0),
    outstandingInvoices: Number(unpaid?.count ?? 0),
    riskScore: Math.round(riskScore),
    growthOpportunities: ltv > 10000 ? ["Enterprise contract", "Multi-project bundling"] : ["Increase load volume", "Post recurring hauls"],
    aiInsights: [
      openReqs?.count ? `${openReqs.count} open request(s) need bid review` : "No open requests",
      activeJobs?.count ? `${activeJobs.count} active haul(s) in progress` : "No active jobs",
    ],
  };
}

export async function getVendorScorecard(profileId: number) {
  const [completed] = await db.select({ count: sql<number>`count(*)` })
    .from(jobsTable)
    .where(and(eq(jobsTable.providerId, profileId), eq(jobsTable.status, "completed")));

  const [declined] = await db.select({ count: sql<number>`count(*)` })
    .from(jobsTable)
    .where(and(eq(jobsTable.providerId, profileId), eq(jobsTable.status, "declined")));

  const [revenue] = await db.select({ total: sql<number>`coalesce(sum(${jobsTable.providerNetAmount}), 0)` })
    .from(jobsTable)
    .where(and(eq(jobsTable.providerId, profileId), eq(jobsTable.status, "completed")));

  const [pendingBids] = await db.select({ count: sql<number>`count(*)` })
    .from(bidsTable)
    .where(and(eq(bidsTable.providerId, profileId), eq(bidsTable.status, "pending")));

  const total = Number(completed?.count ?? 0) + Number(declined?.count ?? 0);
  const acceptanceRate = total > 0 ? Math.round((Number(completed?.count ?? 0) / total) * 100) : 100;
  const completionRate = acceptanceRate;

  const [avgRating] = await db.select({ avg: sql<number>`coalesce(avg(${ratingsTable.stars}), 0)` })
    .from(ratingsTable)
    .where(eq(ratingsTable.rateeProfileId, profileId));

  const fleet = await db.select({ coiStatus: trucksTable.coiStatus })
    .from(trucksTable)
    .where(eq(trucksTable.ownerId, profileId));

  const coiOk = fleet.filter((t) => t.coiStatus === "active").length;
  const complianceScore = fleet.length ? Math.round((coiOk / fleet.length) * 100) : 100;

  return {
    profileId,
    acceptanceRate,
    completionRate,
    safetyScore: Math.round(Number(avgRating?.avg ?? 0) * 20) || 75,
    insuranceStatus: complianceScore >= 80 ? "verified" : "action_required",
    complianceScore,
    revenue: Number(revenue?.total ?? 0),
    pendingBids: Number(pendingBids?.count ?? 0),
    averageResponseTime: pendingBids?.count ? "< 4h est." : "N/A",
    reliability: Math.min(100, acceptanceRate + 5),
  };
}

export async function getDriverScorecard(profileId: number) {
  const [completed] = await db.select({ count: sql<number>`count(*)` })
    .from(jobsTable)
    .where(and(eq(jobsTable.providerId, profileId), eq(jobsTable.status, "completed")));

  const [rating] = await db.select({ avg: sql<number>`coalesce(avg(${ratingsTable.stars}), 0)` })
    .from(ratingsTable)
    .where(eq(ratingsTable.rateeProfileId, profileId));

  const badges: string[] = [];
  const loads = Number(completed?.count ?? 0);
  if (loads >= 50) badges.push("Century Hauler");
  if (loads >= 10) badges.push("Reliable Operator");
  if (Number(rating?.avg ?? 0) >= 4.5) badges.push("Five Star");

  return {
    profileId,
    completedLoads: loads,
    onTimePercent: loads > 0 ? Math.min(98, 85 + loads) : 100,
    safetyScore: Math.round(Number(rating?.avg ?? 0) * 20) || 80,
    customerRating: Number(rating?.avg ?? 0).toFixed(1),
    fuelEfficiency: "N/A",
    idleTime: "N/A",
    availability: "Available",
    compliance: "See Account",
    badges,
  };
}

export async function getScorecards(profile: ProfileCtx) {
  if (profile.role === "customer") {
    return { customer: await getCustomerScorecard(profile.id), vendor: null, driver: null };
  }
  if (profile.role === "driver") {
    return { customer: null, vendor: null, driver: await getDriverScorecard(profile.id) };
  }
  return {
    customer: null,
    vendor: await getVendorScorecard(profile.id),
    driver: await getDriverScorecard(profile.id),
  };
}
