import {
  db,
  jobsTable,
  requestsTable,
  bidsTable,
  trucksTable,
  activityTable,
  w9SubmissionsTable,
  insuranceSubmissionsTable,
} from "@workspace/db";
import { eq, and, or, sql, desc, inArray, gte, lte } from "drizzle-orm";

export type InsightSeverity = "critical" | "high" | "medium" | "low" | "info";

export interface InsightAction {
  label: string;
  href?: string;
  command?: string;
}

export interface OperationInsight {
  id: string;
  category: string;
  title: string;
  description: string;
  severity: InsightSeverity;
  confidence: number;
  businessImpact: string;
  recommendedAction: string;
  actions: InsightAction[];
}

export interface DispatchSuggestion {
  jobId: number;
  materialType: string;
  pickupAddress: string;
  recommendedTruckId: number | null;
  recommendedTruckLabel: string | null;
  backupTruckId: number | null;
  backupTruckLabel: string | null;
  estimatedProfit: number;
  estimatedFuelCost: number;
  lateRisk: "low" | "medium" | "high";
  conflicts: string[];
}

export interface LiveStreamEvent {
  id: string;
  type: string;
  description: string;
  relatedId?: number;
  href?: string;
  createdAt: string;
}

export interface OperationsCenterPayload {
  morningBrief: string;
  todayRevenue: number;
  todayJobs: number;
  fleetStatus: {
    total: number;
    available: number;
    onJob: number;
    offline: number;
  };
  driverAvailability: {
    assigned: number;
    unassigned: number;
  };
  weather: { summary: string; detail: string } | null;
  traffic: { summary: string; detail: string } | null;
  criticalAlerts: { id: string; title: string; description: string; href?: string }[];
  lateJobs: {
    id: number;
    materialType: string;
    scheduledDate: string;
    status: string;
    pickupAddress: string;
  }[];
  highMarginOpportunities: {
    id: number;
    materialType: string;
    budgetPerHour: number | null;
    estimatedMargin: number;
    pickupAddress: string;
  }[];
  insights: OperationInsight[];
  recentActivity: {
    id: number;
    type: string;
    description: string;
    relatedId: number | null;
    relatedBinOrderId: string | null;
    createdAt: string;
  }[];
  upcomingDeliveries: {
    id: number;
    materialType: string;
    deliveryAddress: string;
    scheduledDate: string;
    status: string;
  }[];
  complianceWarnings: { id: string; title: string; detail: string; href: string }[];
  fuelAlerts: { id: string; title: string; detail: string }[];
  liveStream: LiveStreamEvent[];
  dispatchSuggestions: DispatchSuggestion[];
  analytics: {
    revenueForecast7d: number;
    marginForecast7d: number;
    fleetUtilization: number;
    customerLifetimeValue: number;
    vendorScore: number | null;
    driverScore: number | null;
    regionalDemand: { region: string; jobCount: number; trend: number }[];
    weeklyEvents: { label: string; count: number }[];
  };
  digitalTwinHealth: {
    fleetHealth: { score: number; label: string; issues: string[] };
    driverHealth: { score: number; label: string; issues: string[] };
    equipmentHealth: { score: number; label: string; issues: string[] };
    maintenance: { overdue: number; upcoming: number };
    compliance: { status: string; issues: string[] };
    insurance: { status: string; expiringWithin30Days: boolean };
    fuel: { alertCount: number };
    utilization: number;
  };
  updatedAt: string;
}

interface ProfileCtx {
  id: number;
  role: string;
  companyName: string;
  state: string | null;
}

function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function extractRegion(address: string): string {
  const m = address.match(/\b([A-Z]{2})\s+\d{5}/);
  if (m) return m[1];
  const parts = address.split(",").map((p) => p.trim());
  const last = parts[parts.length - 1] ?? "";
  const stateMatch = last.match(/\b([A-Z]{2})\b/);
  return stateMatch?.[1] ?? "Unknown";
}

function parseHourly(rate: string | null | undefined): number {
  if (!rate) return 0;
  const n = parseFloat(rate);
  return Number.isFinite(n) ? n : 0;
}

type TruckRow = {
  id: number;
  truckType: string;
  isAvailable: boolean;
  assignedDriverId: number | null;
  coiStatus: string;
  truckNumber: string | null;
  ratePerHour: string;
};

function isLateJob(job: { scheduledDate: Date; status: string; startedAt: Date | null }, now = new Date()): boolean {
  const active = ["accepted", "active", "in_progress", "awarded"].includes(job.status);
  if (!active) return false;
  const sched = new Date(job.scheduledDate);
  if (sched > now) return false;
  if (job.startedAt) return false;
  const [h, m] = "08:00".split(":").map(Number);
  const deadline = new Date(sched);
  deadline.setHours(h ?? 8, m ?? 0, 0, 0);
  return now > deadline;
}

export function buildMorningBrief(ctx: {
  profile: ProfileCtx;
  todayJobs: number;
  todayRevenue: number;
  activeJobs: number;
  openLoads: number;
  insightCount: number;
  lateCount: number;
}): string {
  const { profile, todayJobs, todayRevenue, activeJobs, openLoads, insightCount, lateCount } = ctx;
  const parts: string[] = [];
  parts.push(`Good morning, ${profile.companyName}.`);
  if (todayJobs > 0) {
    parts.push(`You have ${todayJobs} job${todayJobs === 1 ? "" : "s"} scheduled today`);
    if (todayRevenue > 0) parts.push(`with ~$${Math.round(todayRevenue).toLocaleString()} projected revenue`);
  } else if (activeJobs > 0) {
    parts.push(`${activeJobs} active haul${activeJobs === 1 ? "" : "s"} in progress`);
  } else if (openLoads > 0) {
    parts.push(`${openLoads} open load${openLoads === 1 ? "" : "s"} awaiting action`);
  } else {
    parts.push("Operations are quiet — a good time to review fleet and compliance.");
  }
  if (lateCount > 0) parts.push(`${lateCount} job${lateCount === 1 ? " is" : "s are"} running late.`);
  if (insightCount > 0) parts.push(`${insightCount} AI recommendation${insightCount === 1 ? "" : "s"} ready for review.`);
  return parts.join(" ");
}

export function generateInsights(input: {
  profile: ProfileCtx;
  openRequests: { id: number; materialType: string; budgetPerHour: string | null; pickupAddress: string }[];
  activeJobs: { id: number; materialType: string; status: string; scheduledDate: Date }[];
  trucks: { id: number; truckType: string; isAvailable: boolean; assignedDriverId: number | null; coiStatus: string }[];
  lateJobs: { id: number; materialType: string }[];
  pendingBids: number;
  declinedThisWeek: number;
  declinedLastWeek: number;
  todayRevenue: number;
  idleRevenueEstimate: number;
  regionalTrend: { region: string; current: number; previous: number } | null;
  complianceIssues: string[];
  paymentAlerts: number;
}): OperationInsight[] {
  const insights: OperationInsight[] = [];
  const isCustomer = input.profile.role === "customer";
  const isProvider = input.profile.role === "provider" || input.profile.role === "driver";

  const idleTrucks = input.trucks.filter((t) => t.isAvailable);
  if (isProvider && idleTrucks.length > 0 && input.openRequests.length > 0) {
    insights.push({
      id: "idle-trucks-near-loads",
      category: "Fleet",
      title: `${idleTrucks.length} truck${idleTrucks.length === 1 ? "" : "s"} idle with open loads available`,
      description: `${idleTrucks.length} available unit${idleTrucks.length === 1 ? "" : "s"} while ${input.openRequests.length} load${input.openRequests.length === 1 ? "" : "s"} sit${input.openRequests.length === 1 ? "s" : ""} on the board.`,
      severity: idleTrucks.length >= 3 ? "high" : "medium",
      confidence: 92,
      businessImpact: `Estimated idle cost today: $${Math.round(input.idleRevenueEstimate).toLocaleString()}`,
      recommendedAction: "Bid on high-margin open loads or reassign drivers to active jobs.",
      actions: [
        { label: "Browse loads", href: "/requests" },
        { label: "View fleet", href: "/fleet" },
      ],
    });
  }

  if (input.declinedLastWeek > 0 && input.declinedThisWeek > input.declinedLastWeek) {
    const pct = Math.round(((input.declinedThisWeek - input.declinedLastWeek) / input.declinedLastWeek) * 100);
    if (pct >= 10) {
      insights.push({
        id: "decline-rate-up",
        category: "Market",
        title: `Job declines up ${pct}% vs last week`,
        description: `${input.declinedThisWeek} declined this week compared to ${input.declinedLastWeek} last week.`,
        severity: pct >= 25 ? "high" : "medium",
        confidence: 78,
        businessImpact: "Higher decline rates reduce fill rate and extend time-to-dispatch.",
        recommendedAction: isCustomer ? "Review bid pricing and lead times on open requests." : "Prioritize accepting awarded jobs to protect your vendor score.",
        actions: [{ label: "View jobs", href: "/jobs" }],
      });
    }
  }

  if (input.regionalTrend && input.regionalTrend.previous > 0) {
    const pct = Math.round(((input.regionalTrend.current - input.regionalTrend.previous) / input.regionalTrend.previous) * 100);
    if (Math.abs(pct) >= 15) {
      insights.push({
        id: "regional-demand",
        category: "Demand",
        title: `${input.regionalTrend.region} demand ${pct > 0 ? "up" : "down"} ${Math.abs(pct)}%`,
        description: `${input.regionalTrend.current} active jobs this week vs ${input.regionalTrend.previous} prior week in ${input.regionalTrend.region}.`,
        severity: pct > 0 ? "medium" : "low",
        confidence: 74,
        businessImpact: pct > 0 ? "Opportunity to capture volume in a hot region." : "Consider repositioning fleet or adjusting rates.",
        recommendedAction: pct > 0 ? "Increase bids in this region." : "Review pricing and service radius.",
        actions: [{ label: "Load board", href: "/requests" }, { label: "Live map", href: "/map" }],
      });
    }
  }

  const tomorrowJobs = input.activeJobs.filter((j) => {
    const d = new Date(j.scheduledDate);
    const tmr = addDays(startOfDay(), 1);
    return d >= tmr && d <= endOfDay(tmr);
  });
  if (tomorrowJobs.length >= 2) {
    insights.push({
      id: "tomorrow-schedule",
      category: "Schedule",
      title: `${tomorrowJobs.length} deliveries scheduled tomorrow`,
      description: "Multiple hauls scheduled — confirm driver assignments and route timing tonight.",
      severity: "medium",
      confidence: 88,
      businessImpact: "Proactive dispatch reduces late-arrival risk and customer escalations.",
      recommendedAction: "Review tomorrow's jobs and assign backup trucks where needed.",
      actions: [{ label: "Active jobs", href: "/jobs" }, { label: "Digital Twin", href: "/dispatch" }],
    });
  }

  if (input.idleRevenueEstimate > 500) {
    insights.push({
      id: "lost-revenue-today",
      category: "Revenue",
      title: `Estimated unrealized revenue today: $${Math.round(input.idleRevenueEstimate).toLocaleString()}`,
      description: "Idle fleet capacity combined with open demand on your account.",
      severity: input.idleRevenueEstimate > 2000 ? "high" : "medium",
      confidence: 70,
      businessImpact: "Each idle hour represents lost billable capacity.",
      recommendedAction: isProvider ? "Place bids on open loads matching your truck types." : "Award pending bids to lock in capacity.",
      actions: [{ label: isCustomer ? "Review bids" : "Find jobs", href: "/requests" }],
    });
  }

  if (input.lateJobs.length > 0) {
    insights.push({
      id: "late-jobs",
      category: "Operations",
      title: `${input.lateJobs.length} job${input.lateJobs.length === 1 ? "" : "s"} running late`,
      description: `Job${input.lateJobs.length === 1 ? "" : "s"} #${input.lateJobs.slice(0, 3).map((j) => j.id).join(", #")} past scheduled start without driver check-in.`,
      severity: "critical",
      confidence: 95,
      businessImpact: "Late jobs increase cancellation risk and damage customer trust.",
      recommendedAction: "Contact drivers immediately and dispatch backup capacity if needed.",
      actions: input.lateJobs.slice(0, 3).map((j) => ({ label: `Job #${j.id}`, href: `/jobs/${j.id}` })),
    });
  }

  if (isCustomer && input.pendingBids > 0) {
    insights.push({
      id: "pending-bids",
      category: "Dispatch",
      title: `${input.pendingBids} bid${input.pendingBids === 1 ? "" : "s"} awaiting review`,
      description: "Open requests have provider quotes ready for award.",
      severity: "medium",
      confidence: 90,
      businessImpact: "Delayed awards extend time-to-dispatch and may lose preferred vendors.",
      recommendedAction: "Review and award bids to secure capacity for upcoming hauls.",
      actions: [{ label: "Review requests", href: "/requests" }],
    });
  }

  if (input.complianceIssues.length > 0) {
    insights.push({
      id: "compliance",
      category: "Compliance",
      title: "Compliance action required",
      description: input.complianceIssues.join("; "),
      severity: "high",
      confidence: 99,
      businessImpact: "Non-compliant accounts cannot bid, dispatch, or receive payouts.",
      recommendedAction: "Complete verification documents in Account settings.",
      actions: [{ label: "Go to Account", href: "/account" }],
    });
  }

  if (input.paymentAlerts > 0) {
    insights.push({
      id: "payment-alerts",
      category: "Finance",
      title: `${input.paymentAlerts} payment issue${input.paymentAlerts === 1 ? "" : "s"} need attention`,
      description: "Failed or action-required payments detected on your account.",
      severity: "critical",
      confidence: 97,
      businessImpact: "Payment failures block job settlement and provider payouts.",
      recommendedAction: "Resolve payment methods and retry failed settlements.",
      actions: [{ label: "View jobs", href: "/jobs" }, { label: "Account", href: "/account" }],
    });
  }

  const highMargin = input.openRequests
    .filter((r) => parseHourly(r.budgetPerHour) >= 120)
    .slice(0, 1);
  if (highMargin.length > 0 && isProvider) {
    const r = highMargin[0]!;
    insights.push({
      id: `priority-load-${r.id}`,
      category: "Opportunity",
      title: `High-margin load: ${r.materialType} at $${parseHourly(r.budgetPerHour)}/hr`,
      description: `Request #${r.id} in ${extractRegion(r.pickupAddress)} exceeds your fleet average rate.`,
      severity: "medium",
      confidence: 82,
      businessImpact: "Prioritizing high-rate loads improves daily margin.",
      recommendedAction: "Submit a competitive bid before capacity fills.",
      actions: [{ label: "View load", href: `/requests/${r.id}` }, { label: "Bid now", href: "/requests" }],
    });
  }

  return insights.slice(0, 12);
}

export function buildDispatchSuggestions(
  jobs: {
    id: number;
    materialType: string;
    pickupAddress: string;
    truckType: string;
    ratePerHour: string;
    estimatedHours: string;
    scheduledDate: Date;
    status: string;
    startedAt: Date | null;
  }[],
  trucks: {
    id: number;
    truckType: string;
    isAvailable: boolean;
    truckNumber: string | null;
    ratePerHour: string;
    assignedDriverId: number | null;
  }[],
): DispatchSuggestion[] {
  const available = trucks.filter((t) => t.isAvailable);
  return jobs.slice(0, 8).map((job) => {
    const matching = available.filter((t) => t.truckType === job.truckType || t.truckType === "dump_truck");
    const sorted = [...matching].sort((a, b) => parseHourly(a.ratePerHour) - parseHourly(b.ratePerHour));
    const recommended = sorted[0] ?? available[0] ?? null;
    const backup = sorted[1] ?? available.find((t) => t.id !== recommended?.id) ?? null;
    const hours = parseFloat(job.estimatedHours) || 8;
    const revenue = parseHourly(job.ratePerHour) * hours;
    const cost = parseHourly(recommended?.ratePerHour ?? "0") * hours;
    const fuelEst = Math.round(hours * 45);
    const late = isLateJob({ scheduledDate: job.scheduledDate, status: job.status, startedAt: job.startedAt });
    const conflicts: string[] = [];
    if (!recommended) conflicts.push("No available truck matching job type");
    if (!job.startedAt && new Date(job.scheduledDate) < new Date()) conflicts.push("Past scheduled start time");
    return {
      jobId: job.id,
      materialType: job.materialType,
      pickupAddress: job.pickupAddress,
      recommendedTruckId: recommended?.id ?? null,
      recommendedTruckLabel: recommended ? (recommended.truckNumber ?? `Truck #${recommended.id}`) : null,
      backupTruckId: backup?.id ?? null,
      backupTruckLabel: backup ? (backup.truckNumber ?? `Truck #${backup.id}`) : null,
      estimatedProfit: Math.round(revenue - cost),
      estimatedFuelCost: fuelEst,
      lateRisk: late ? "high" : conflicts.length > 0 ? "medium" : "low",
      conflicts,
    };
  });
}

function activityToLiveEvent(a: {
  id: number;
  type: string;
  description: string;
  relatedId: number | null;
  createdAt: Date;
}): LiveStreamEvent {
  const href =
    a.type.includes("job") && a.relatedId ? `/jobs/${a.relatedId}` :
    a.type.includes("bid") && a.relatedId ? `/requests/${a.relatedId}` :
    a.type.includes("payment") && a.relatedId ? `/jobs/${a.relatedId}` :
    undefined;
  return {
    id: `activity-${a.id}`,
    type: a.type,
    description: a.description,
    relatedId: a.relatedId ?? undefined,
    href,
    createdAt: a.createdAt.toISOString(),
  };
}

export async function buildOperationsCenter(profile: ProfileCtx): Promise<OperationsCenterPayload> {
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const weekAgo = addDays(todayStart, -7);
  const twoWeeksAgo = addDays(todayStart, -14);

  const isCustomer = profile.role === "customer";
  const isProvider = profile.role === "provider" || profile.role === "driver";

  const jobScope = isCustomer
    ? eq(jobsTable.customerId, profile.id)
    : isProvider
      ? eq(jobsTable.providerId, profile.id)
      : sql`1=0`;

  const activeStatuses = ["accepted", "active", "in_progress", "awarded"] as const;

  const [
    todayJobsRows,
    activeJobsRows,
    completedTodayRows,
    activities,
    trucks,
    openRequests,
    pendingBidsResult,
    w9,
    insurance,
    declinedThisWeek,
    declinedLastWeek,
    paymentActivity,
    upcomingJobs,
    weekJobs,
    prevWeekJobs,
    allJobsForClv,
  ] = await Promise.all([
    db.select({
      id: jobsTable.id,
      materialType: jobsTable.materialType,
      totalAmount: jobsTable.totalAmount,
      ratePerHour: jobsTable.ratePerHour,
      estimatedHours: jobsTable.estimatedHours,
      scheduledDate: jobsTable.scheduledDate,
      status: jobsTable.status,
      pickupAddress: jobsTable.pickupAddress,
      deliveryAddress: jobsTable.deliveryAddress,
      truckType: jobsTable.truckType,
      startedAt: jobsTable.startedAt,
    })
      .from(jobsTable)
      .where(and(jobScope, gte(jobsTable.scheduledDate, todayStart), lte(jobsTable.scheduledDate, todayEnd))),

    db.select({
      id: jobsTable.id,
      materialType: jobsTable.materialType,
      status: jobsTable.status,
      scheduledDate: jobsTable.scheduledDate,
      pickupAddress: jobsTable.pickupAddress,
      deliveryAddress: jobsTable.deliveryAddress,
      ratePerHour: jobsTable.ratePerHour,
      estimatedHours: jobsTable.estimatedHours,
      truckType: jobsTable.truckType,
      startedAt: jobsTable.startedAt,
    })
      .from(jobsTable)
      .where(and(jobScope, inArray(jobsTable.status, [...activeStatuses]))),

    db.select({ total: sql<number>`coalesce(sum(${jobsTable.totalAmount}), 0)` })
      .from(jobsTable)
      .where(and(jobScope, eq(jobsTable.status, "completed"), gte(jobsTable.completedAt, todayStart))),

    db.select()
      .from(activityTable)
      .where(eq(activityTable.profileId, profile.id))
      .orderBy(desc(activityTable.createdAt))
      .limit(25),

    isProvider
      ? db.select({
          id: trucksTable.id,
          truckType: trucksTable.truckType,
          isAvailable: trucksTable.isAvailable,
          assignedDriverId: trucksTable.assignedDriverId,
          coiStatus: trucksTable.coiStatus,
          truckNumber: trucksTable.truckNumber,
          ratePerHour: trucksTable.ratePerHour,
        }).from(trucksTable).where(eq(trucksTable.ownerId, profile.id))
      : Promise.resolve([] as TruckRow[]),

    isCustomer
      ? db.select({
          id: requestsTable.id,
          materialType: requestsTable.materialType,
          budgetPerHour: requestsTable.budgetPerHour,
          pickupAddress: requestsTable.pickupAddress,
        })
          .from(requestsTable)
          .where(and(eq(requestsTable.customerId, profile.id), inArray(requestsTable.status, ["open", "bid_received", "bidding"])))
      : db.select({
          id: requestsTable.id,
          materialType: requestsTable.materialType,
          budgetPerHour: requestsTable.budgetPerHour,
          pickupAddress: requestsTable.pickupAddress,
        })
          .from(requestsTable)
          .where(eq(requestsTable.status, "open"))
          .limit(20),

    isCustomer
      ? db.select({ count: sql<number>`count(*)` })
          .from(bidsTable)
          .innerJoin(requestsTable, eq(bidsTable.requestId, requestsTable.id))
          .where(and(eq(requestsTable.customerId, profile.id), eq(bidsTable.status, "pending")))
      : Promise.resolve([{ count: 0 }]),

    isProvider
      ? db.select().from(w9SubmissionsTable).where(eq(w9SubmissionsTable.profileId, profile.id))
      : Promise.resolve([]),

    isProvider
      ? db.select().from(insuranceSubmissionsTable).where(eq(insuranceSubmissionsTable.profileId, profile.id))
      : Promise.resolve([]),

    db.select({ count: sql<number>`count(*)` })
      .from(jobsTable)
      .where(and(jobScope, eq(jobsTable.status, "declined"), gte(jobsTable.updatedAt, weekAgo))),

    db.select({ count: sql<number>`count(*)` })
      .from(jobsTable)
      .where(and(jobScope, eq(jobsTable.status, "declined"), gte(jobsTable.updatedAt, twoWeeksAgo), lte(jobsTable.updatedAt, weekAgo))),

    db.select({ count: sql<number>`count(*)` })
      .from(activityTable)
      .where(and(
        eq(activityTable.profileId, profile.id),
        inArray(activityTable.type, ["payment_failed", "payment_requires_action", "payout_delayed"]),
        gte(activityTable.createdAt, weekAgo),
      )),

    db.select({
      id: jobsTable.id,
      materialType: jobsTable.materialType,
      deliveryAddress: jobsTable.deliveryAddress,
      scheduledDate: jobsTable.scheduledDate,
      status: jobsTable.status,
    })
      .from(jobsTable)
      .where(and(jobScope, gte(jobsTable.scheduledDate, now), inArray(jobsTable.status, [...activeStatuses, "accepted"])))
      .orderBy(jobsTable.scheduledDate)
      .limit(10),

    db.select({ pickupAddress: jobsTable.pickupAddress })
      .from(jobsTable)
      .where(and(jobScope, gte(jobsTable.createdAt, weekAgo))),

    db.select({ pickupAddress: jobsTable.pickupAddress })
      .from(jobsTable)
      .where(and(jobScope, gte(jobsTable.createdAt, twoWeeksAgo), lte(jobsTable.createdAt, weekAgo))),

    isCustomer
      ? db.select({ total: sql<number>`coalesce(sum(${jobsTable.totalAmount}), 0)` })
          .from(jobsTable)
          .where(and(eq(jobsTable.customerId, profile.id), eq(jobsTable.status, "completed")))
      : Promise.resolve([{ total: 0 }]),
  ]);

  const todayRevenue = todayJobsRows.reduce((sum, j) => {
    const amt = j.totalAmount ? parseFloat(String(j.totalAmount)) : parseHourly(j.ratePerHour) * parseFloat(String(j.estimatedHours));
    return sum + (Number.isFinite(amt) ? amt : 0);
  }, 0);

  const completedToday = Number(completedTodayRows[0]?.total ?? 0);
  const todayRevenueTotal = todayRevenue + completedToday;

  const lateJobs = activeJobsRows.filter((j) => isLateJob(j)).map((j) => ({
    id: j.id,
    materialType: j.materialType,
    scheduledDate: j.scheduledDate.toISOString(),
    status: j.status,
    pickupAddress: j.pickupAddress,
  }));

  const fleetTotal = trucks.length;
  const fleetAvailable = trucks.filter((t) => t.isAvailable).length;
  const fleetOnJob = Math.min(activeJobsRows.length, fleetTotal - fleetAvailable);
  const fleetOffline = Math.max(0, fleetTotal - fleetAvailable - fleetOnJob);

  const assignedDrivers = new Set(trucks.map((t) => t.assignedDriverId).filter(Boolean)).size;
  const unassignedTrucks = trucks.filter((t) => !t.assignedDriverId).length;

  const avgTruckRate = trucks.length
    ? trucks.reduce((s, t) => s + parseHourly(t.ratePerHour), 0) / trucks.length
    : 95;
  const idleRevenueEstimate = fleetAvailable * avgTruckRate * 6;

  const regionCounts = (rows: { pickupAddress: string }[]) => {
    const m = new Map<string, number>();
    for (const r of rows) {
      const reg = extractRegion(r.pickupAddress);
      m.set(reg, (m.get(reg) ?? 0) + 1);
    }
    return m;
  };
  const currentRegions = regionCounts(weekJobs);
  const prevRegions = regionCounts(prevWeekJobs);
  let regionalTrend: { region: string; current: number; previous: number } | null = null;
  for (const [region, current] of currentRegions) {
    const previous = prevRegions.get(region) ?? 0;
    if (current >= 2 || previous >= 2) {
      regionalTrend = { region, current, previous };
      break;
    }
  }

  const complianceIssues: string[] = [];
  if (isProvider) {
    const w9Row = w9[0];
    const insRow = insurance[0];
    if (!w9Row || w9Row.status !== "verified") complianceIssues.push("W-9 verification incomplete");
    if (!insRow || insRow.status !== "verified") complianceIssues.push("Insurance verification incomplete");
    const expiredCoi = trucks.filter((t) => t.coiStatus === "expired" || t.coiStatus === "none");
    if (expiredCoi.length > 0) complianceIssues.push(`${expiredCoi.length} truck(s) with COI issues`);
  }

  const complianceWarnings = complianceIssues.map((issue, i) => ({
    id: `compliance-${i}`,
    title: issue,
    detail: "Complete verification to restore full operating capability.",
    href: "/account",
  }));

  const coiExpiring = trucks.filter((t) => t.coiStatus === "pending").length;

  const highMarginOpportunities = (isProvider ? openRequests : openRequests)
    .map((r) => ({
      id: r.id,
      materialType: r.materialType,
      budgetPerHour: r.budgetPerHour ? parseHourly(r.budgetPerHour) : null,
      estimatedMargin: r.budgetPerHour ? Math.round(parseHourly(r.budgetPerHour) * 0.15 * 8) : 0,
      pickupAddress: r.pickupAddress,
    }))
    .filter((r) => r.budgetPerHour && r.budgetPerHour >= 100)
    .sort((a, b) => (b.budgetPerHour ?? 0) - (a.budgetPerHour ?? 0))
    .slice(0, 5);

  const insights = generateInsights({
    profile,
    openRequests,
    activeJobs: activeJobsRows,
    trucks,
    lateJobs,
    pendingBids: Number(pendingBidsResult[0]?.count ?? 0),
    declinedThisWeek: Number(declinedThisWeek[0]?.count ?? 0),
    declinedLastWeek: Number(declinedLastWeek[0]?.count ?? 0),
    todayRevenue: todayRevenueTotal,
    idleRevenueEstimate,
    regionalTrend,
    complianceIssues,
    paymentAlerts: Number(paymentActivity[0]?.count ?? 0),
  });

  const criticalAlerts = [
    ...lateJobs.map((j) => ({
      id: `late-${j.id}`,
      title: `Late job #${j.id}`,
      description: `${j.materialType} haul past scheduled start at ${j.pickupAddress}`,
      href: `/jobs/${j.id}`,
    })),
    ...complianceWarnings
      .filter((_, i) => complianceIssues[i]?.includes("W-9") || complianceIssues[i]?.includes("Insurance"))
      .map((w) => ({
        id: w.id,
        title: w.title,
        description: w.detail,
        href: w.href,
      })),
  ];

  const dispatchSuggestions = isProvider
    ? buildDispatchSuggestions(activeJobsRows, trucks)
    : [];

  const fleetUtilization = fleetTotal > 0
    ? Math.round(((fleetTotal - fleetAvailable) / fleetTotal) * 100)
    : activeJobsRows.length > 0 ? 100 : 0;

  const revenueForecast7d = todayRevenueTotal * 7 + activeJobsRows.reduce((s, j) => {
    return s + parseHourly(j.ratePerHour) * parseFloat(String(j.estimatedHours));
  }, 0);

  const marginForecast7d = Math.round(revenueForecast7d * (isProvider ? 0.85 : 1));

  const weeklyEvents = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(todayStart, -(6 - i));
    const label = d.toLocaleDateString("en-US", { weekday: "short" });
    const dateStr = d.toISOString().slice(0, 10);
    const count = activities.filter((a) => a.createdAt.toISOString().slice(0, 10) === dateStr).length;
    return { label, count };
  });

  const regionalDemand = [...currentRegions.entries()]
    .map(([region, jobCount]) => ({
      region,
      jobCount,
      trend: jobCount - (prevRegions.get(region) ?? 0),
    }))
    .sort((a, b) => b.jobCount - a.jobCount)
    .slice(0, 6);

  const insRow = insurance[0];
  const insuranceExpiring = insRow?.glExpirationDate
    ? new Date(insRow.glExpirationDate).getTime() - now.getTime() < 30 * 86400000
    : false;

  const equipmentIssues = trucks.filter((t) => t.coiStatus !== "active").length;

  const activeRegionCount = new Set(activeJobsRows.map((j) => extractRegion(j.pickupAddress))).size;
  const trafficSummary = activeRegionCount > 1
    ? `${activeRegionCount} active regions`
    : activeRegionCount === 1 && activeJobsRows[0]
      ? extractRegion(activeJobsRows[0].pickupAddress)
      : null;

  const tomorrowCount = activeJobsRows.filter((j) => {
    const d = new Date(j.scheduledDate);
    const tmr = addDays(todayStart, 1);
    return d >= tmr && d <= endOfDay(tmr);
  }).length;

  return {
    morningBrief: buildMorningBrief({
      profile,
      todayJobs: todayJobsRows.length,
      todayRevenue: todayRevenueTotal,
      activeJobs: activeJobsRows.length,
      openLoads: openRequests.length,
      insightCount: insights.length,
      lateCount: lateJobs.length,
    }),
    todayRevenue: Math.round(todayRevenueTotal),
    todayJobs: todayJobsRows.length,
    fleetStatus: {
      total: fleetTotal,
      available: fleetAvailable,
      onJob: fleetOnJob,
      offline: fleetOffline,
    },
    driverAvailability: {
      assigned: assignedDrivers,
      unassigned: unassignedTrucks,
    },
    weather: tomorrowCount > 0
      ? {
          summary: `${tomorrowCount} outdoor haul${tomorrowCount === 1 ? "" : "s"} tomorrow`,
          detail: "Review schedule and driver assignments before end of day.",
        }
      : null,
    traffic: trafficSummary && activeJobsRows.length > 0
      ? {
          summary: trafficSummary,
          detail: `${activeJobsRows.length} active route${activeJobsRows.length === 1 ? "" : "s"} in operation.`,
        }
      : null,
    criticalAlerts,
    lateJobs,
    highMarginOpportunities,
    insights,
    recentActivity: activities.map((a) => ({
      id: a.id,
      type: a.type,
      description: a.description,
      relatedId: a.relatedId,
      relatedBinOrderId: a.relatedBinOrderId,
      createdAt: a.createdAt.toISOString(),
    })),
    upcomingDeliveries: upcomingJobs.map((j) => ({
      id: j.id,
      materialType: j.materialType,
      deliveryAddress: j.deliveryAddress,
      scheduledDate: j.scheduledDate.toISOString(),
      status: j.status,
    })),
    complianceWarnings,
    fuelAlerts: coiExpiring > 0
      ? [{ id: "coi-pending", title: `${coiExpiring} truck COI pending review`, detail: "Insurance certificates affect dispatch eligibility." }]
      : [],
    liveStream: activities.slice(0, 15).map(activityToLiveEvent),
    dispatchSuggestions,
    analytics: {
      revenueForecast7d: Math.round(revenueForecast7d),
      marginForecast7d,
      fleetUtilization,
      customerLifetimeValue: Math.round(Number(allJobsForClv[0]?.total ?? 0)),
      vendorScore: isProvider && activeJobsRows.length > 0 ? Math.min(100, 70 + activeJobsRows.length * 3) : null,
      driverScore: isProvider && assignedDrivers > 0 ? Math.min(100, 75 + assignedDrivers * 5) : null,
      regionalDemand,
      weeklyEvents,
    },
    digitalTwinHealth: {
      fleetHealth: {
        score: fleetTotal ? Math.round(((fleetTotal - fleetOffline) / fleetTotal) * 100) : 100,
        label: fleetTotal ? `${fleetAvailable} available / ${fleetTotal} total` : "No fleet registered",
        issues: fleetAvailable === 0 && fleetTotal > 0 ? ["All trucks currently assigned or offline"] : [],
      },
      driverHealth: {
        score: trucks.length ? Math.round((assignedDrivers / Math.max(trucks.length, 1)) * 100) : 100,
        label: `${assignedDrivers} assigned, ${unassignedTrucks} unassigned`,
        issues: unassignedTrucks > 0 ? [`${unassignedTrucks} truck(s) without assigned driver`] : [],
      },
      equipmentHealth: {
        score: trucks.length ? Math.round(((trucks.length - equipmentIssues) / trucks.length) * 100) : 100,
        label: equipmentIssues > 0 ? `${equipmentIssues} unit(s) need COI attention` : "All units compliant",
        issues: equipmentIssues > 0 ? [`${equipmentIssues} truck(s) with COI status not active`] : [],
      },
      maintenance: { overdue: equipmentIssues, upcoming: 0 },
      compliance: {
        status: complianceIssues.length === 0 ? "good" : "action_required",
        issues: complianceIssues,
      },
      insurance: {
        status: insRow?.status ?? "not_submitted",
        expiringWithin30Days: insuranceExpiring,
      },
      fuel: { alertCount: 0 },
      utilization: fleetUtilization,
    },
    updatedAt: now.toISOString(),
  };
}

export async function searchOperations(profile: ProfileCtx, query: string) {
  const q = query.trim();
  if (!q) return { results: [] as { type: string; label: string; href: string; subtitle?: string }[] };

  const results: { type: string; label: string; href: string; subtitle?: string }[] = [];
  const idMatch = q.match(/#?(\d+)/);
  const numId = idMatch ? parseInt(idMatch[1]!, 10) : NaN;

  if (Number.isFinite(numId)) {
    const [job] = await db.select({ id: jobsTable.id, materialType: jobsTable.materialType })
      .from(jobsTable)
      .where(and(
        eq(jobsTable.id, numId),
        profile.role === "customer"
          ? eq(jobsTable.customerId, profile.id)
          : profile.role === "provider"
            ? eq(jobsTable.providerId, profile.id)
            : sql`1=1`,
      ));
    if (job) results.push({ type: "job", label: `Job #${job.id}`, href: `/jobs/${job.id}`, subtitle: job.materialType });

    const [req] = await db.select({ id: requestsTable.id, materialType: requestsTable.materialType })
      .from(requestsTable)
      .where(and(
        eq(requestsTable.id, numId),
        profile.role === "customer" ? eq(requestsTable.customerId, profile.id) : sql`1=1`,
      ));
    if (req) results.push({ type: "request", label: `Request #${req.id}`, href: `/requests/${req.id}`, subtitle: req.materialType });
  }

  const lower = q.toLowerCase();
  const navCommands = [
    { type: "nav", label: "Dashboard", href: "/dashboard", keywords: ["home", "operations", "mission"] },
    { type: "nav", label: "Load Board", href: "/requests", keywords: ["loads", "requests", "bid"] },
    { type: "nav", label: "Active Jobs", href: "/jobs", keywords: ["jobs", "haul"] },
    { type: "nav", label: "Digital Twin", href: "/dispatch", keywords: ["dispatch", "fleet", "twin"] },
    { type: "nav", label: "Live Map", href: "/map", keywords: ["map", "gps", "tracking"] },
    { type: "nav", label: "Account", href: "/account", keywords: ["account", "compliance", "insurance"] },
    { type: "nav", label: "AI Copilot", href: "#copilot", keywords: ["ai", "copilot", "assistant", "chat"] },
  ];
  for (const cmd of navCommands) {
    if (cmd.label.toLowerCase().includes(lower) || cmd.keywords.some((k) => k.includes(lower) || lower.includes(k))) {
      results.push({ type: cmd.type, label: cmd.label, href: cmd.href });
    }
  }

  return { results: results.slice(0, 12) };
}
