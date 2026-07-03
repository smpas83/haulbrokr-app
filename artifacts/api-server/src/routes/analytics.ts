import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import {
  db,
  jobsTable,
  profilesTable,
  requestsTable,
  ticketsTable,
  trucksTable,
} from "@workspace/db";
import { getRequestProfile, requireProfile } from "../middlewares/requireAuth";

const router: IRouter = Router();

function money(value: unknown): number {
  return Number(value ?? 0);
}

router.get("/analytics/marketplace", requireProfile, async (req, res): Promise<void> => {
  const profile = getRequestProfile(req);
  if (!profile.staffRole) {
    res.status(403).json({ error: "Only HaulBrokr staff can view marketplace analytics." });
    return;
  }

  const [
    revenueByCustomer,
    revenueByDriver,
    revenueByFleet,
    revenueByRegion,
    revenueByMaterial,
    revenueByTruck,
    [marginAgg],
    [durationAgg],
    [requestAgg],
    [completionAgg],
  ] = await Promise.all([
    db
      .select({
        customerId: jobsTable.customerId,
        customerName: profilesTable.companyName,
        revenue: sql<number>`coalesce(sum(coalesce(${jobsTable.customerTotalAmount}, ${jobsTable.totalAmount}, 0)), 0)`,
        profit: sql<number>`coalesce(sum(coalesce(${jobsTable.platformFeeAmount}, 0)), 0)`,
      })
      .from(jobsTable)
      .leftJoin(profilesTable, eq(profilesTable.id, jobsTable.customerId))
      .groupBy(jobsTable.customerId, profilesTable.companyName),
    db
      .select({
        driverId: ticketsTable.driverProfileId,
        driverName: profilesTable.companyName,
        revenue: sql<number>`coalesce(sum(coalesce(${jobsTable.providerNetAmount}, ${jobsTable.totalAmount}, 0) / greatest(${jobsTable.trucksAssigned}, 1)), 0)`,
        completedLoads: sql<number>`count(*) filter (where ${ticketsTable.status} in ('completed', 'verified'))`,
      })
      .from(ticketsTable)
      .leftJoin(jobsTable, eq(jobsTable.id, ticketsTable.jobId))
      .leftJoin(profilesTable, eq(profilesTable.id, ticketsTable.driverProfileId))
      .groupBy(ticketsTable.driverProfileId, profilesTable.companyName),
    db
      .select({
        providerId: jobsTable.providerId,
        fleetName: profilesTable.companyName,
        revenue: sql<number>`coalesce(sum(coalesce(${jobsTable.providerNetAmount}, ${jobsTable.totalAmount}, 0)), 0)`,
        utilizationJobs: sql<number>`count(*) filter (where ${jobsTable.status} in ('active', 'accepted', 'in_progress', 'completed'))`,
      })
      .from(jobsTable)
      .leftJoin(profilesTable, eq(profilesTable.id, jobsTable.providerId))
      .groupBy(jobsTable.providerId, profilesTable.companyName),
    db
      .select({
        region: profilesTable.state,
        revenue: sql<number>`coalesce(sum(coalesce(${jobsTable.customerTotalAmount}, ${jobsTable.totalAmount}, 0)), 0)`,
      })
      .from(jobsTable)
      .leftJoin(profilesTable, eq(profilesTable.id, jobsTable.customerId))
      .groupBy(profilesTable.state),
    db
      .select({
        materialType: jobsTable.materialType,
        revenue: sql<number>`coalesce(sum(coalesce(${jobsTable.customerTotalAmount}, ${jobsTable.totalAmount}, 0)), 0)`,
        loads: sql<number>`count(*)`,
      })
      .from(jobsTable)
      .groupBy(jobsTable.materialType),
    db
      .select({
        truckId: ticketsTable.truckId,
        truckNumber: trucksTable.truckNumber,
        revenue: sql<number>`coalesce(sum(coalesce(${jobsTable.providerNetAmount}, ${jobsTable.totalAmount}, 0) / greatest(${jobsTable.trucksAssigned}, 1)), 0)`,
      })
      .from(ticketsTable)
      .leftJoin(jobsTable, eq(jobsTable.id, ticketsTable.jobId))
      .leftJoin(trucksTable, eq(trucksTable.id, ticketsTable.truckId))
      .groupBy(ticketsTable.truckId, trucksTable.truckNumber),
    db.select({
      averageMargin: sql<number>`coalesce(avg(${jobsTable.platformFeeRate}), 0)`,
      profitPerLoad: sql<number>`coalesce(avg(coalesce(${jobsTable.platformFeeAmount}, 0)), 0)`,
      totalProfit: sql<number>`coalesce(sum(coalesce(${jobsTable.platformFeeAmount}, 0)), 0)`,
      deadheadPercent: sql<number | null>`null`,
      averageEtaMinutes: sql<number | null>`null`,
    }).from(jobsTable),
    db.select({
      averageLoadDurationHours: sql<number>`coalesce(avg(extract(epoch from (${jobsTable.completedAt} - ${jobsTable.startedAt})) / 3600), 0)`,
    }).from(jobsTable),
    db.select({
      totalRequests: sql<number>`count(*)`,
      awardedRequests: sql<number>`count(*) filter (where ${requestsTable.status} in ('awarded', 'accepted', 'in_progress', 'completed'))`,
      repeatCustomers: sql<number>`count(distinct ${requestsTable.customerId}) filter (where ${requestsTable.customerId} in (select customer_id from requests group by customer_id having count(*) > 1))`,
    }).from(requestsTable),
    db.select({
      totalJobs: sql<number>`count(*)`,
      completedJobs: sql<number>`count(*) filter (where ${jobsTable.status} = 'completed')`,
    }).from(jobsTable),
  ]);

  const totalRequests = money(requestAgg?.totalRequests);
  const totalJobs = money(completionAgg?.totalJobs);
  res.json({
    revenueByCustomer,
    revenueByDriver,
    revenueByFleet,
    revenueByRegion: revenueByRegion.map((row) => ({ ...row, region: row.region ?? "Unknown" })),
    revenueByMaterial,
    revenueByTruck,
    averageMargin: money(marginAgg?.averageMargin),
    profitPerLoad: money(marginAgg?.profitPerLoad),
    totalProfit: money(marginAgg?.totalProfit),
    driverUtilization: revenueByDriver,
    fleetUtilization: revenueByFleet,
    deadheadPercent: marginAgg?.deadheadPercent ?? null,
    averageEtaMinutes: marginAgg?.averageEtaMinutes ?? null,
    averageLoadDurationHours: money(durationAgg?.averageLoadDurationHours),
    customerLifetimeValue: revenueByCustomer,
    driverLifetimeValue: revenueByDriver,
    repeatCustomerPercent: totalRequests > 0 ? money(requestAgg?.repeatCustomers) / totalRequests : 0,
    acceptancePercent: totalRequests > 0 ? money(requestAgg?.awardedRequests) / totalRequests : 0,
    completionPercent: totalJobs > 0 ? money(completionAgg?.completedJobs) / totalJobs : 0,
  });
});

export default router;
