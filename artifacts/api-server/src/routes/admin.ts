import { Router, type IRouter } from "express";
import { eq, desc, isNotNull, sql, and, notInArray, inArray, ilike, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import {
  db,
  dotCdlTable,
  creditApplicationsTable,
  profilesTable,
  activityTable,
  jobsTable,
  requestsTable,
  binOrders,
  w9SubmissionsTable,
  insuranceSubmissionsTable,
} from "@workspace/db";
import { requireStaffOrProfile, attachStaffSession } from "../middlewares/staffAuth";
import { attachClerkProfileIfPresent } from "../middlewares/requireAuth";
import {
  requireAdmin,
  requirePermission,
  getStaffRole,
  getPermissions,
  ASSIGNABLE_ROLES,
} from "../middlewares/requireAdmin";
import { ReviewComplianceBody, ReviewCreditApplicationBody, UpdateStaffRoleBody } from "@workspace/api-zod";
import { findStuckPayoutJobs, retryStuckPayout } from "../lib/payoutRetry";
import { getUncachableResendClient } from "../lib/resendClient";
import {
  listProviderComplianceBundles,
  reviewProviderW9,
  reviewProviderInsurance,
  reviewProviderUploadedDoc,
  getProviderCanBid,
  profileSummary,
} from "../lib/adminComplianceBundle";

const router: IRouter = Router();

router.use(attachStaffSession);
router.use(attachClerkProfileIfPresent);

/**
 * Records an in-app notification telling an applicant their carrier or credit
 * application was approved or rejected. For rejections we include the reviewer's
 * note (the "why") so they know what to fix. Best-effort: a notification failure
 * must never make the admin's review action appear to fail, so we swallow errors.
 */
async function notifyApplicationReviewed(
  profileId: number,
  kind: "carrier application" | "credit application" | "W-9" | "insurance certificate" | "DOT/CDL compliance" | "compliance document",
  approved: boolean,
  note: string | null,
): Promise<void> {
  try {
    const description = approved
      ? `Good news Ã¢ÂÂ your ${kind} was approved.`
      : `Your ${kind} was not approved${note ? `: ${note}` : "."}`;
    await db.insert(activityTable).values({
      profileId,
      type: approved ? "application_approved" : "application_rejected",
      description,
      relatedId: null,
    });
  } catch (err) {
    console.error("Failed to record application review notification", err);
  }

  // Best-effort email Ã¢ÂÂ never block the admin review action.
  try {
    const [profile] = await db
      .select({ email: profilesTable.email, contactName: profilesTable.contactName })
      .from(profilesTable)
      .where(eq(profilesTable.id, profileId));
    if (!profile?.email) return;

    const { client, fromEmail } = await getUncachableResendClient();
    const subject = approved
      ? `HaulBrokr: ${kind} approved`
      : `HaulBrokr: ${kind} update`;
    const body = approved
      ? `Hi ${profile.contactName ?? "there"},\n\nGood news Ã¢ÂÂ your ${kind} has been approved. You can sign in to HaulBrokr to continue.\n\nÃ¢ÂÂ HaulBrokr`
      : `Hi ${profile.contactName ?? "there"},\n\nYour ${kind} was not approved.${note ? `\n\nReason: ${note}` : ""}\n\nSign in to review your account and resubmit if needed.\n\nÃ¢ÂÂ HaulBrokr`;

    await client.emails.send({
      from: fromEmail,
      to: profile.email,
      subject,
      text: body,
    });
  } catch (err) {
    console.error("Failed to send application review email", err);
  }
}

function parseReviewAction(req: { body?: unknown }) {
  return ReviewComplianceBody.safeParse(req.body);
}

// Ã¢ÂÂÃ¢ÂÂ Admin access flag (used by the web app to gate the admin dashboard) Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ
router.get("/admin/access", async (req, res): Promise<void> => {
  const [staffRole, permissions] = await Promise.all([getStaffRole(req), getPermissions(req)]);
  res.json({
    isAdmin: permissions.length > 0,
    staffRole,
    permissions,
    staffDisplayName: req.staffUser?.displayName ?? null,
    authMethod: req.staffUser ? "staff" : staffRole ? "clerk" : null,
  });
});

// Ã¢ÂÂÃ¢ÂÂ Platform command-center overview Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ
router.get("/admin/overview", requireStaffOrProfile, requirePermission("overview"), async (_req, res): Promise<void> => {
  const [
    [jobAgg],
    [activeAgg],
    [completedAgg],
    [carrierAgg],
    [customerAgg],
    [driverAgg],
    [supervisorAgg],
    [requestsAgg],
    [openRequestsAgg],
    statusRows,
    [realisedAgg],
    [dotPendingAgg],
    [w9PendingAgg],
    [insurancePendingAgg],
    [creditAgg],
    [openBinAgg],
    stuckJobs,
  ] = await Promise.all([
    db
      .select({
        totalJobs: sql<number>`count(*)`,
        gmv: sql<number>`coalesce(sum(coalesce(${jobsTable.customerTotalAmount}, ${jobsTable.totalAmount}, 0)), 0)`,
        brokerFees: sql<number>`coalesce(sum(coalesce(${jobsTable.platformFeeAmount}, 0)), 0)`,
      })
      .from(jobsTable),
    db
      .select({ count: sql<number>`count(*)` })
      .from(jobsTable)
      .where(sql`${jobsTable.status} in ('active', 'awarded', 'accepted', 'in_progress')`),
    db
      .select({ count: sql<number>`count(*)` })
      .from(jobsTable)
      .where(eq(jobsTable.status, "completed")),
    db
      .select({ count: sql<number>`count(*)` })
      .from(profilesTable)
      .where(eq(profilesTable.role, "provider")),
    db
      .select({ count: sql<number>`count(*)` })
      .from(profilesTable)
      .where(eq(profilesTable.role, "customer")),
    // Drivers and supervisors are first-class user roles too.
    db
      .select({ count: sql<number>`count(*)` })
      .from(profilesTable)
      .where(eq(profilesTable.role, "driver")),
    db
      .select({ count: sql<number>`count(*)` })
      .from(profilesTable)
      .where(eq(profilesTable.role, "supervisor")),
    // Job posts (customer requests) â total and still-open.
    db.select({ count: sql<number>`count(*)` }).from(requestsTable),
    db
      .select({ count: sql<number>`count(*)` })
      .from(requestsTable)
      .where(sql`${requestsTable.status} in ('open', 'bid_received', 'bidding')`),
    // Per-status job breakdown for accepted vs in-progress vs cancelled.
    db
      .select({ status: jobsTable.status, count: sql<number>`count(*)` })
      .from(jobsTable)
      .groupBy(jobsTable.status),
    // Realised profit: broker fees on jobs whose payment has been released.
    db
      .select({
        releasedProfit: sql<number>`coalesce(sum(coalesce(${jobsTable.platformFeeAmount}, 0)), 0)`,
        releasedGmv: sql<number>`coalesce(sum(coalesce(${jobsTable.customerTotalAmount}, ${jobsTable.totalAmount}, 0)), 0)`,
      })
      .from(jobsTable)
      .where(eq(jobsTable.paymentStatus, "released")),
    db
      .select({ count: sql<number>`count(*)` })
      .from(dotCdlTable)
      .where(eq(dotCdlTable.status, "pending")),
    db
      .select({ count: sql<number>`count(*)` })
      .from(w9SubmissionsTable)
      .where(eq(w9SubmissionsTable.status, "pending")),
    db
      .select({ count: sql<number>`count(*)` })
      .from(insuranceSubmissionsTable)
      .where(eq(insuranceSubmissionsTable.status, "pending")),
    db
      .select({ count: sql<number>`count(*)` })
      .from(creditApplicationsTable)
      .where(eq(creditApplicationsTable.status, "pending")),
    db
      .select({ count: sql<number>`count(*)` })
      .from(binOrders)
      .where(notInArray(binOrders.status, ["picked_up", "cancelled"])),
    findStuckPayoutJobs(),
  ]);

  const pendingCompliance =
    Number(dotPendingAgg?.count ?? 0)
    + Number(w9PendingAgg?.count ?? 0)
    + Number(insurancePendingAgg?.count ?? 0);

  // Build a status -> count map from the grouped job rows.
  const statusCount = (s: string) =>
    Number(statusRows.find((r) => r.status === s)?.count ?? 0);
  const acceptedJobs = statusCount("awarded") + statusCount("accepted");
  const inProgressJobs = statusCount("in_progress") + statusCount("active");
  const cancelledJobs = statusCount("cancelled") + statusCount("declined");

  const totalJobs = Number(jobAgg?.totalJobs ?? 0);
  const completedJobs = Number(completedAgg?.count ?? 0);
  const gmv = Number(jobAgg?.gmv ?? 0);

  res.json({
    // Money
    gmv,
    brokerFees: Number(jobAgg?.brokerFees ?? 0),
    realisedProfit: Number(realisedAgg?.releasedProfit ?? 0),
    realisedGmv: Number(realisedAgg?.releasedGmv ?? 0),
    avgJobValue: completedJobs > 0 ? gmv / Math.max(totalJobs, 1) : 0,
    // Jobs funnel
    requestsPosted: Number(requestsAgg?.count ?? 0),
    openRequests: Number(openRequestsAgg?.count ?? 0),
    totalJobs,
    acceptedJobs,
    activeJobs: Number(activeAgg?.count ?? 0),
    inProgressJobs,
    completedJobs,
    cancelledJobs,
    // People
    newCarriers: Number(carrierAgg?.count ?? 0),
    newCustomers: Number(customerAgg?.count ?? 0),
    drivers: Number(driverAgg?.count ?? 0),
    supervisors: Number(supervisorAgg?.count ?? 0),
    // Review queues
    stuckPayouts: stuckJobs.length,
    pendingCompliance,
    pendingCredit: Number(creditAgg?.count ?? 0),
    openBinOrders: Number(openBinAgg?.count ?? 0),
  });
});

// ââ Drill-down lists (names, locations, amounts) âââââââââââââââââââââââââ
// All three endpoints are read-only and reuse the "overview" permission so any
// staff member who can see the dashboard can drill into the underlying records.

const JOB_STATUS_GROUPS: Record<string, string[]> = {
  accepted: ["awarded", "accepted"],
  in_progress: ["in_progress", "active"],
  active: ["active", "awarded", "accepted", "in_progress"],
  completed: ["completed"],
  cancelled: ["cancelled", "declined"],
};

// GET /admin/jobs?status=&q=&limit=  -> brokered jobs with customer + carrier names
router.get("/admin/jobs", requireStaffOrProfile, requirePermission("overview"), async (req, res): Promise<void> => {
  const statusKey = typeof req.query.status === "string" ? req.query.status : "";
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const limit = Math.min(Number(req.query.limit) || 100, 500);

  const cust = alias(profilesTable, "cust");
  const prov = alias(profilesTable, "prov");

  const conds = [] as any[];
  const group = JOB_STATUS_GROUPS[statusKey];
  if (group) conds.push(inArray(jobsTable.status, group as any));

  const rows = await db
    .select({
      id: jobsTable.id,
      status: jobsTable.status,
      paymentStatus: jobsTable.paymentStatus,
      materialType: jobsTable.materialType,
      truckType: jobsTable.truckType,
      pickupAddress: jobsTable.pickupAddress,
      deliveryAddress: jobsTable.deliveryAddress,
      scheduledDate: jobsTable.scheduledDate,
      gmv: sql<number>`coalesce(${jobsTable.customerTotalAmount}, ${jobsTable.totalAmount}, 0)`,
      brokerFee: sql<number>`coalesce(${jobsTable.platformFeeAmount}, 0)`,
      providerNet: sql<number>`coalesce(${jobsTable.providerNetAmount}, 0)`,
      customerId: jobsTable.customerId,
      providerId: jobsTable.providerId,
      customerName: cust.companyName,
      customerCity: cust.city,
      customerState: cust.state,
      providerName: prov.companyName,
      providerCity: prov.city,
      providerState: prov.state,
      createdAt: jobsTable.createdAt,
    })
    .from(jobsTable)
    .leftJoin(cust, eq(cust.id, jobsTable.customerId))
    .leftJoin(prov, eq(prov.id, jobsTable.providerId))
    .where(conds.length ? and(...conds) : sql`true`)
    .orderBy(desc(jobsTable.createdAt))
    .limit(limit);

  const filtered = q
    ? rows.filter((r) =>
        [r.customerName, r.providerName, r.materialType, r.pickupAddress, r.deliveryAddress]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q.toLowerCase())),
      )
    : rows;

  res.json(filtered.map((r) => ({
    ...r,
    gmv: Number(r.gmv),
    brokerFee: Number(r.brokerFee),
    providerNet: Number(r.providerNet),
  })));
});

// GET /admin/requests?status=&q=&limit= -> customer job posts
router.get("/admin/requests", requireStaffOrProfile, requirePermission("overview"), async (req, res): Promise<void> => {
  const statusKey = typeof req.query.status === "string" ? req.query.status : "";
  const limit = Math.min(Number(req.query.limit) || 100, 500);
  const conds = [] as any[];
  if (statusKey === "open") {
    conds.push(inArray(requestsTable.status, ["open", "bid_received", "bidding"] as any));
  } else if (statusKey) {
    conds.push(eq(requestsTable.status, statusKey as any));
  }

  const rcust = alias(profilesTable, "rcust");

  const rows = await db
    .select({
      id: requestsTable.id,
      status: requestsTable.status,
      materialType: requestsTable.materialType,
      truckType: requestsTable.truckType,
      quantityTons: requestsTable.quantityTons,
      pickupAddress: requestsTable.pickupAddress,
      deliveryAddress: requestsTable.deliveryAddress,
      budgetPerHour: requestsTable.budgetPerHour,
      scheduledDate: requestsTable.scheduledDate,
      trucksNeeded: requestsTable.trucksNeeded,
      customerId: requestsTable.customerId,
      customerName: rcust.companyName,
      customerCity: rcust.city,
      customerState: rcust.state,
      createdAt: requestsTable.createdAt,
    })
    .from(requestsTable)
    .leftJoin(rcust, eq(rcust.id, requestsTable.customerId))
    .where(conds.length ? and(...conds) : sql`true`)
    .orderBy(desc(requestsTable.createdAt))
    .limit(limit);

  res.json(rows);
});

// GET /admin/people?role=customer|provider|driver|supervisor&q=&limit=
router.get("/admin/people", requireStaffOrProfile, requirePermission("overview"), async (req, res): Promise<void> => {
  const role = typeof req.query.role === "string" ? req.query.role : "";
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const limit = Math.min(Number(req.query.limit) || 200, 500);

  const validRoles = ["customer", "provider", "driver", "supervisor"];
  const conds = [] as any[];
  if (validRoles.includes(role)) conds.push(eq(profilesTable.role, role as any));
  if (q) {
    conds.push(
      or(
        ilike(profilesTable.companyName, `%${q}%`),
        ilike(profilesTable.contactName, `%${q}%`),
        ilike(profilesTable.email, `%${q}%`),
        ilike(profilesTable.city, `%${q}%`),
      ),
    );
  }

  const rows = await db
    .select({
      id: profilesTable.id,
      role: profilesTable.role,
      companyName: profilesTable.companyName,
      contactName: profilesTable.contactName,
      email: profilesTable.email,
      phone: profilesTable.phone,
      city: profilesTable.city,
      state: profilesTable.state,
      mcNumber: profilesTable.mcNumber,
      createdAt: profilesTable.createdAt,
    })
    .from(profilesTable)
    .where(conds.length ? and(...conds) : sql`true`)
    .orderBy(desc(profilesTable.createdAt))
    .limit(limit);

  res.json(rows);
});

// ── Time series for charts ────────────────────────────────────
// GET /admin/timeseries?months=6  -> monthly buckets of money + jobs + signups.
router.get("/admin/timeseries", requireStaffOrProfile, requirePermission("overview"), async (req, res): Promise<void> => {
  const months = Math.min(Math.max(Number(req.query.months) || 6, 1), 24);
  const since = sql`now() - (${months} || ' months')::interval`;

  // Money + jobs created per month (bucketed on created_at).
  const created = await db
    .select({
      bucket: sql<string>`to_char(date_trunc('month', ${jobsTable.createdAt}), 'YYYY-MM')`,
      jobs: sql<number>`count(*)`,
      gmv: sql<number>`coalesce(sum(coalesce(${jobsTable.customerTotalAmount}, ${jobsTable.totalAmount}, 0)), 0)`,
      brokerFees: sql<number>`coalesce(sum(coalesce(${jobsTable.platformFeeAmount}, 0)), 0)`,
    })
    .from(jobsTable)
    .where(sql`${jobsTable.createdAt} >= ${since}`)
    .groupBy(sql`1`);

  // Completed hauls per month (bucketed on completed_at).
  const completed = await db
    .select({
      bucket: sql<string>`to_char(date_trunc('month', ${jobsTable.completedAt}), 'YYYY-MM')`,
      completed: sql<number>`count(*)`,
    })
    .from(jobsTable)
    .where(and(isNotNull(jobsTable.completedAt), sql`${jobsTable.completedAt} >= ${since}`))
    .groupBy(sql`1`);

  // New signups per month by role.
  const signups = await db
    .select({
      bucket: sql<string>`to_char(date_trunc('month', ${profilesTable.createdAt}), 'YYYY-MM')`,
      role: profilesTable.role,
      count: sql<number>`count(*)`,
    })
    .from(profilesTable)
    .where(sql`${profilesTable.createdAt} >= ${since}`)
    .groupBy(sql`1`, profilesTable.role);

  // Build a continuous list of month buckets so the chart has no gaps.
  const labels: string[] = [];
  const now = new Date();
  for (let i = months - 1; i >= 0; i--) {
    const dt = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    labels.push(`${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  const createdMap = new Map(created.map((r) => [r.bucket, r]));
  const completedMap = new Map(completed.map((r) => [r.bucket, Number(r.completed)]));
  const signupMap = new Map<string, Record<string, number>>();
  for (const s of signups) {
    const m = signupMap.get(s.bucket) ?? {};
    m[s.role as string] = Number(s.count);
    signupMap.set(s.bucket, m);
  }

  const series = labels.map((bucket) => {
    const c = createdMap.get(bucket);
    const su = signupMap.get(bucket) ?? {};
    const [y, mo] = bucket.split("-").map(Number);
    const label = new Date(Date.UTC(y, mo - 1, 1)).toLocaleDateString("en-US", { month: "short", year: "2-digit" });
    return {
      bucket,
      label,
      jobs: Number(c?.jobs ?? 0),
      gmv: Number(c?.gmv ?? 0),
      brokerFees: Number(c?.brokerFees ?? 0),
      completed: completedMap.get(bucket) ?? 0,
      customers: su["customer"] ?? 0,
      providers: su["provider"] ?? 0,
      drivers: su["driver"] ?? 0,
    };
  });

  res.json({ months, series });
});

// Ã¢ÂÂÃ¢ÂÂ Staff team management Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ
router.get("/admin/staff", requireStaffOrProfile, requirePermission("view_staff"), async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(profilesTable)
    .where(isNotNull(profilesTable.staffRole))
    .orderBy(desc(profilesTable.updatedAt));
  res.json(rows.map((p) => ({ ...profileSummary(p), staffRole: p.staffRole })));
});

router.patch("/admin/staff/:profileId", requireStaffOrProfile, requirePermission("manage_staff"), async (req, res): Promise<void> => {
  const parsed = UpdateStaffRoleBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const profileId = Number(req.params.profileId);
  if (!Number.isInteger(profileId)) {
    res.status(400).json({ error: "Invalid profileId" });
    return;
  }
  const staffRole = parsed.data.staffRole ?? null;
  if (staffRole !== null && !ASSIGNABLE_ROLES.includes(staffRole)) {
    res.status(400).json({ error: "Invalid staff role" });
    return;
  }
  const [rec] = await db
    .update(profilesTable)
    .set({ staffRole })
    .where(eq(profilesTable.id, profileId))
    .returning();
  if (!rec) {
    res.status(404).json({ error: "No profile with that id." });
    return;
  }
  res.json({ ...profileSummary(rec), staffRole: rec.staffRole });
});

// Ã¢ÂÂÃ¢ÂÂ Carrier compliance review Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ
router.get("/admin/compliance", requireStaffOrProfile, requirePermission("compliance"), async (_req, res): Promise<void> => {
  const bundles = await listProviderComplianceBundles();
  res.json(bundles);
});

router.patch("/admin/compliance/:profileId/w9", requireStaffOrProfile, requirePermission("compliance"), async (req, res): Promise<void> => {
  const parsed = parseReviewAction(req);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const profileId = Number(req.params.profileId);
  if (!Number.isInteger(profileId)) {
    res.status(400).json({ error: "Invalid profileId" });
    return;
  }
  const approved = parsed.data.action === "approve";
  const note = parsed.data.note?.trim() || null;
  const rec = await reviewProviderW9(profileId, approved, note);
  if (!rec) {
    res.status(404).json({ error: "No W-9 submission for that carrier." });
    return;
  }
  await notifyApplicationReviewed(profileId, "W-9", approved, note);
  res.json({ ...rec, canBid: await getProviderCanBid(profileId) });
});

router.patch("/admin/compliance/:profileId/insurance", requireStaffOrProfile, requirePermission("compliance"), async (req, res): Promise<void> => {
  const parsed = parseReviewAction(req);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const profileId = Number(req.params.profileId);
  if (!Number.isInteger(profileId)) {
    res.status(400).json({ error: "Invalid profileId" });
    return;
  }
  const approved = parsed.data.action === "approve";
  const note = parsed.data.note?.trim() || null;
  const rec = await reviewProviderInsurance(profileId, approved, note);
  if (!rec) {
    res.status(404).json({ error: "No insurance submission for that carrier." });
    return;
  }
  await notifyApplicationReviewed(profileId, "insurance certificate", approved, note);
  res.json({
    ...rec,
    glCoverageAmount: parseFloat(rec.glCoverageAmount),
    autoCoverageAmount: rec.autoCoverageAmount ? parseFloat(rec.autoCoverageAmount) : null,
    bondAmount: rec.bondAmount ? parseFloat(rec.bondAmount) : null,
    canBid: await getProviderCanBid(profileId),
  });
});

router.patch("/admin/compliance/:profileId/documents/:docType", requireStaffOrProfile, requirePermission("compliance"), async (req, res): Promise<void> => {
  const parsed = parseReviewAction(req);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const profileId = Number(req.params.profileId);
  const docType = String(req.params.docType ?? "");
  if (!Number.isInteger(profileId)) {
    res.status(400).json({ error: "Invalid profileId" });
    return;
  }
  const approved = parsed.data.action === "approve";
  const note = parsed.data.note?.trim() || null;
  const rec = await reviewProviderUploadedDoc(profileId, docType, approved, note);
  if (!rec) {
    res.status(404).json({ error: "No uploaded document of that type for that carrier." });
    return;
  }
  await notifyApplicationReviewed(profileId, "compliance document", approved, note);
  res.json({ ...rec, canBid: await getProviderCanBid(profileId) });
});

router.patch("/admin/compliance/:profileId", requireStaffOrProfile, requirePermission("compliance"), async (req, res): Promise<void> => {
  const parsed = ReviewComplianceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const profileId = Number(req.params.profileId);
  if (!Number.isInteger(profileId)) {
    res.status(400).json({ error: "Invalid profileId" });
    return;
  }
  const now = new Date();
  const approved = parsed.data.action === "approve";
  const note = parsed.data.note?.trim() || null;
  const update = approved
    ? {
        dotVerified: true,
        dotVerifiedAt: now,
        cdlVerified: true,
        cdlVerifiedAt: now,
        fmcsaAuthority: "verified",
        insuranceActive: "verified",
        dotOperatingStatus: "verified",
        notSuspended: "verified",
        safetyRating: "Satisfactory",
        complianceCheckedAt: now,
        status: "verified",
        reviewNote: note,
      }
    : {
        dotVerified: false,
        cdlVerified: false,
        fmcsaAuthority: "failed",
        insuranceActive: "failed",
        dotOperatingStatus: "failed",
        notSuspended: "failed",
        complianceCheckedAt: now,
        status: "rejected",
        reviewNote: note,
      };
  const [rec] = await db
    .update(dotCdlTable)
    .set(update)
    .where(eq(dotCdlTable.profileId, profileId))
    .returning();
  if (!rec) {
    res.status(404).json({ error: "No compliance record for that carrier." });
    return;
  }
  await notifyApplicationReviewed(profileId, "DOT/CDL compliance", approved, note);
  res.json({ ...rec, canBid: await getProviderCanBid(profileId) });
});

// Ã¢ÂÂÃ¢ÂÂ Customer credit-application review Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ
router.get("/admin/credit-applications", requireStaffOrProfile, requirePermission("credit"), async (_req, res): Promise<void> => {
  const rows = await db
    .select({ rec: creditApplicationsTable, profile: profilesTable })
    .from(creditApplicationsTable)
    .innerJoin(profilesTable, eq(creditApplicationsTable.profileId, profilesTable.id))
    .orderBy(desc(creditApplicationsTable.createdAt));
  res.json(
    rows.map(({ rec, profile }) => ({
      id: rec.id,
      profileId: rec.profileId,
      wantsInvoicing: rec.wantsInvoicing,
      tradeReferences: rec.tradeReferences,
      bankReference: rec.bankReference,
      estimatedMonthlySpend: rec.estimatedMonthlySpend ? parseFloat(rec.estimatedMonthlySpend) : null,
      status: rec.status,
      reviewNote: rec.reviewNote,
      createdAt: rec.createdAt,
      profile: profileSummary(profile),
    })),
  );
});

router.patch("/admin/credit-applications/:profileId", requireStaffOrProfile, requirePermission("credit"), async (req, res): Promise<void> => {
  const parsed = ReviewCreditApplicationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const profileId = Number(req.params.profileId);
  if (!Number.isInteger(profileId)) {
    res.status(400).json({ error: "Invalid profileId" });
    return;
  }
  const approved = parsed.data.action === "approve";
  const note = parsed.data.note?.trim() || null;
  const status = approved ? "approved" : "rejected";
  const [rec] = await db
    .update(creditApplicationsTable)
    .set({ status, reviewNote: note })
    .where(eq(creditApplicationsTable.profileId, profileId))
    .returning();
  if (!rec) {
    res.status(404).json({ error: "No credit application for that customer." });
    return;
  }
  await notifyApplicationReviewed(profileId, "credit application", approved, note);
  res.json({ ...rec, estimatedMonthlySpend: rec.estimatedMonthlySpend ? parseFloat(rec.estimatedMonthlySpend) : null });
});

// Ã¢ÂÂÃ¢ÂÂ Stuck provider payouts Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ
// Jobs parked in `requires_action` whose customer charge already succeeded but
// whose provider transfer never completed. The background sweep resolves these
// automatically; these endpoints let an admin see what's outstanding and nudge
// a single payout through immediately.
router.get("/admin/stuck-payouts", requireStaffOrProfile, requirePermission("payouts"), async (_req, res): Promise<void> => {
  const jobs = await findStuckPayoutJobs();
  const items = await Promise.all(
    jobs.map(async (job) => {
      const [customer] = await db.select().from(profilesTable).where(eq(profilesTable.id, job.customerId));
      const [provider] = await db.select().from(profilesTable).where(eq(profilesTable.id, job.providerId));
      return {
        id: job.id,
        materialType: job.materialType,
        customerCompany: customer?.companyName ?? "",
        providerCompany: provider?.companyName ?? "",
        providerNetAmount: job.providerNetAmount != null ? parseFloat(job.providerNetAmount) : null,
        customerTotalAmount: job.customerTotalAmount != null ? parseFloat(job.customerTotalAmount) : null,
        paymentAttempts: job.paymentAttempts,
        payoutRetryFailures: job.payoutRetryFailures ?? 0,
        payoutAlertSentAt: job.payoutAlertSentAt,
        completedAt: job.completedAt,
        createdAt: job.createdAt,
      };
    }),
  );
  // Surface the most-failed payouts first so an admin sees the truly-stuck ones
  // before transient blips.
  items.sort((a, b) => b.payoutRetryFailures - a.payoutRetryFailures);
  res.json(items);
});

router.post("/admin/stuck-payouts/:id/retry", requireStaffOrProfile, requirePermission("payouts"), async (req, res): Promise<void> => {
  const jobId = Number(req.params.id);
  if (!Number.isInteger(jobId)) {
    res.status(400).json({ error: "Invalid job id" });
    return;
  }
  const [job] = await db.select().from(jobsTable).where(eq(jobsTable.id, jobId));
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  const result = await retryStuckPayout(job);
  // A genuine transfer failure is a server-side problem worth a 502 so the admin
  // UI can flag it; "skipped" (not eligible yet) and "released" are 200.
  res.status(result.outcome === "failed" ? 502 : 200).json(result);
});

// Manually clear a payout's escalation state once an admin has resolved the
// underlying problem (e.g. the provider fixed their Stripe Connect account).
// This zeroes the consecutive failure counter and clears the alert timestamp so
// the most-failed-first sort and "Alerted" badges stay meaningful. It does NOT
// attempt a transfer Ã¢ÂÂ that's what /retry is for.
router.post("/admin/stuck-payouts/:id/reset-failures", requireStaffOrProfile, requirePermission("payouts"), async (req, res): Promise<void> => {
  const jobId = Number(req.params.id);
  if (!Number.isInteger(jobId)) {
    res.status(400).json({ error: "Invalid job id" });
    return;
  }
  const [job] = await db.select().from(jobsTable).where(eq(jobsTable.id, jobId));
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  await db
    .update(jobsTable)
    .set({ payoutRetryFailures: 0, payoutAlertSentAt: null })
    .where(eq(jobsTable.id, jobId));
  res.json({ id: jobId, payoutRetryFailures: 0, payoutAlertSentAt: null });
});

export default router;
