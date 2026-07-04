import { db, jobsTable, trucksTable } from "@workspace/db";
import { eq, and, sql, inArray, gte } from "drizzle-orm";

interface ProfileCtx {
  id: number;
  role: string;
}

export async function getFinanceCenter(profile: ProfileCtx) {
  const isCustomer = profile.role === "customer";
  const scope = isCustomer ? eq(jobsTable.customerId, profile.id) : eq(jobsTable.providerId, profile.id);

  const [revenue] = await db.select({
    total: sql<number>`coalesce(sum(${isCustomer ? jobsTable.totalAmount : jobsTable.providerNetAmount}), 0)`,
  }).from(jobsTable).where(and(scope, eq(jobsTable.status, "completed")));

  const [margin] = await db.select({
    total: sql<number>`coalesce(sum(${jobsTable.providerNetAmount}), 0)`,
  }).from(jobsTable).where(and(eq(jobsTable.providerId, profile.id), eq(jobsTable.status, "completed")));

  const receivable = await db.select({
    id: jobsTable.id,
    amount: jobsTable.totalAmount,
    paymentStatus: jobsTable.paymentStatus,
    scheduledDate: jobsTable.scheduledDate,
  })
    .from(jobsTable)
    .where(and(scope, inArray(jobsTable.paymentStatus, ["invoiced", "unpaid"])))
    .limit(20);

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [monthRevenue] = await db.select({
    total: sql<number>`coalesce(sum(${isCustomer ? jobsTable.totalAmount : jobsTable.providerNetAmount}), 0)`,
  }).from(jobsTable).where(and(scope, eq(jobsTable.status, "completed"), gte(jobsTable.completedAt, monthStart)));

  const byRegion = await db.select({
    region: sql<string>`split_part(${jobsTable.pickupAddress}, ',', -1)`,
    total: sql<number>`coalesce(sum(${jobsTable.totalAmount}), 0)`,
    count: sql<number>`count(*)`,
  })
    .from(jobsTable)
    .where(and(scope, eq(jobsTable.status, "completed")))
    .groupBy(sql`split_part(${jobsTable.pickupAddress}, ',', -1)`)
    .limit(10);

  const totalRev = Number(revenue?.total ?? 0);
  const totalMargin = Number(margin?.total ?? 0);

  return {
    revenue: totalRev,
    margins: isCustomer ? totalRev * 0.15 : totalMargin,
    accountsReceivable: receivable.reduce((s, j) => s + parseFloat(String(j.amount ?? 0)), 0),
    accountsPayable: isCustomer ? 0 : receivable.filter((j) => j.paymentStatus === "unpaid").reduce((s, j) => s + parseFloat(String(j.amount ?? 0)), 0),
    outstandingInvoices: receivable.length,
    monthRevenue: Number(monthRevenue?.total ?? 0),
    aging: {
      current: receivable.filter((j) => j.paymentStatus === "invoiced").length,
      overdue: receivable.filter((j) => j.paymentStatus === "unpaid").length,
    },
    profitabilityByRegion: byRegion.map((r) => ({
      region: String(r.region ?? "Unknown").trim().slice(0, 20),
      revenue: Number(r.total ?? 0),
      loads: Number(r.count ?? 0),
    })),
    profitabilityByCustomer: [],
    profitabilityByLoad: receivable.slice(0, 5).map((j) => ({
      jobId: j.id,
      amount: parseFloat(String(j.amount ?? 0)),
    })),
  };
}

export async function getFleetManagement(profile: ProfileCtx) {
  if (profile.role !== "provider" && profile.role !== "driver") {
    return { trucks: [], summary: { total: 0, available: 0, maintenanceDue: 0, utilization: 0 } };
  }

  const ownerId = profile.role === "provider" ? profile.id : profile.id;
  const fleet = await db.select()
    .from(trucksTable)
    .where(eq(trucksTable.ownerId, ownerId));

  const available = fleet.filter((t) => t.isAvailable).length;
  const maintenanceDue = fleet.filter((t) => t.coiStatus !== "active").length;

  return {
    trucks: fleet.map((t) => ({
      id: t.id,
      label: t.truckNumber ?? `Truck #${t.id}`,
      truckType: t.truckType,
      isAvailable: t.isAvailable,
      coiStatus: t.coiStatus,
      registrationExpiration: null,
      insuranceExpiration: t.coiStatus === "expired" ? "Expired" : t.coiStatus === "active" ? "Active" : "Pending",
      inspectionStatus: t.coiStatus === "active" ? "pass" : "review",
      fuelUsage: "N/A",
      utilization: t.isAvailable ? 0 : 100,
    })),
    summary: {
      total: fleet.length,
      available,
      maintenanceDue,
      utilization: fleet.length ? Math.round(((fleet.length - available) / fleet.length) * 100) : 0,
      upcomingService: maintenanceDue,
      downtime: maintenanceDue,
    },
    maintenanceSchedule: fleet.filter((t) => t.coiStatus !== "active").map((t) => ({
      truckId: t.id,
      task: "COI / compliance review",
      due: "ASAP",
    })),
  };
}
