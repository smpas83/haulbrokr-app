import { Router, type IRouter } from "express";
import { eq, desc, isNotNull, sql, and, notInArray } from "drizzle-orm";
import {
  db,
  dotCdlTable,
  creditApplicationsTable,
  profilesTable,
  activityTable,
  jobsTable,
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
      ? `Good news — your ${kind} was approved.`
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

  // Best-effort email — never block the admin review action.
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
      ? `Hi ${profile.contactName ?? "there"},\n\nGood news — your ${kind} has been approved. You can sign in to HaulBrokr to continue.\n\n— HaulBrokr`
      : `Hi ${profile.contactName ?? "there"},\n\nYour ${kind} was not approved.${note ? `\n\nReason: ${note}` : ""}\n\nSign in to review your account and resubmit if needed.\n\n— HaulBrokr`;

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

// ── Admin access flag (used by the web app to gate the admin dashboard) ────────
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

// ── Platform command-center overview ──────────────────────────────────────────
router.get("/admin/overview", requireStaffOrProfile, requirePermission("overview"), async (_req, res): Promise<void> => {
  const [
    [jobAgg],
    [activeAgg],
    [completedAgg],
    [carrierAgg],
    [customerAgg],
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

  res.json({
    totalJobs: Number(jobAgg?.totalJobs ?? 0),
    gmv: Number(jobAgg?.gmv ?? 0),
    brokerFees: Number(jobAgg?.brokerFees ?? 0),
    activeJobs: Number(activeAgg?.count ?? 0),
    completedJobs: Number(completedAgg?.count ?? 0),
    newCarriers: Number(carrierAgg?.count ?? 0),
    newCustomers: Number(customerAgg?.count ?? 0),
    stuckPayouts: stuckJobs.length,
    pendingCompliance,
    pendingCredit: Number(creditAgg?.count ?? 0),
    openBinOrders: Number(openBinAgg?.count ?? 0),
  });
});

// ── Staff team management ─────────────────────────────────────────────────────
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

// ── Carrier compliance review ─────────────────────────────────────────────────
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

// ── Customer credit-application review ─────────────────────────────────────────
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

// ── Stuck provider payouts ────────────────────────────────────────────────────
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
// attempt a transfer — that's what /retry is for.
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
