import { Router, type IRouter } from "express";
import { and, desc, eq, gte, lte } from "drizzle-orm";
import {
  db,
  driverEarningsTable,
  driverWalletTable,
  invoiceDocumentsTable,
  jobsTable,
  paymentHistoryTable,
  profilesTable,
  refundHistoryTable,
  stripeConnectedAccountsTable,
  vendorPayoutsTable,
} from "@workspace/db";
import { getRequestProfile, requireProfile } from "../middlewares/requireAuth";
import { requireStaffOrProfile, attachStaffSession } from "../middlewares/staffAuth";
import { attachClerkProfileIfPresent } from "../middlewares/requireAuth";
import { requirePermission } from "../middlewares/requireAdmin";
import { getUncachableStripeClient } from "../lib/stripeClient";
import { recalculateDriverWallet, recordPaymentHistory, recordRefundHistory } from "../lib/marketplaceLedger";

const router: IRouter = Router();

router.use(attachStaffSession);
router.use(attachClerkProfileIfPresent);

function cents(amount: number): number {
  return Math.round(amount * 100);
}

function toNumber(value: string | number | null | undefined): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function asDate(value: unknown): Date | null {
  if (typeof value !== "string" || !value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function serializeMoneyRow<T extends Record<string, unknown>>(row: T): T {
  const out: Record<string, unknown> = { ...row };
  for (const key of [
    "amount",
    "platformFeeAmount",
    "grossAmount",
    "netAmount",
    "paidAmount",
    "subtotalAmount",
    "totalAmount",
    "amountPaid",
    "amountRefunded",
  ]) {
    if (key in out && out[key] != null) out[key] = Number(out[key]);
  }
  return out as T;
}

router.get("/stripe/connected-account", requireProfile, async (req, res): Promise<void> => {
  const profile = getRequestProfile(req);
  const [account] = await db
    .select()
    .from(stripeConnectedAccountsTable)
    .where(eq(stripeConnectedAccountsTable.profileId, profile.id));
  res.json({
    connected: !!account,
    account: account ? {
      ...account,
      requirements: account.requirementsJson ? JSON.parse(account.requirementsJson) : null,
    } : null,
  });
});

router.get("/billing/history", requireProfile, async (req, res): Promise<void> => {
  const profile = getRequestProfile(req);
  const [invoices, payments, refunds] = await Promise.all([
    db
      .select()
      .from(invoiceDocumentsTable)
      .where(eq(invoiceDocumentsTable.customerProfileId, profile.id))
      .orderBy(desc(invoiceDocumentsTable.issuedAt)),
    db
      .select()
      .from(paymentHistoryTable)
      .where(eq(paymentHistoryTable.customerProfileId, profile.id))
      .orderBy(desc(paymentHistoryTable.createdAt)),
    db
      .select()
      .from(refundHistoryTable)
      .where(eq(refundHistoryTable.customerProfileId, profile.id))
      .orderBy(desc(refundHistoryTable.createdAt)),
  ]);
  const outstandingBalance = invoices.reduce((sum, invoice) => {
    if (invoice.status === "paid" || invoice.status === "refunded" || invoice.status === "void") return sum;
    return sum + Math.max(0, toNumber(invoice.totalAmount) - toNumber(invoice.amountPaid) - toNumber(invoice.amountRefunded));
  }, 0);
  res.json({
    outstandingBalance,
    invoices: invoices.map(serializeMoneyRow),
    payments: payments.map(serializeMoneyRow),
    refunds: refunds.map(serializeMoneyRow),
  });
});

router.get("/payouts/history", requireProfile, async (req, res): Promise<void> => {
  const profile = getRequestProfile(req);
  const payouts = await db
    .select()
    .from(vendorPayoutsTable)
    .where(eq(vendorPayoutsTable.vendorProfileId, profile.id))
    .orderBy(desc(vendorPayoutsTable.createdAt));
  res.json({ payouts: payouts.map(serializeMoneyRow) });
});

router.get("/driver/earnings", requireProfile, async (req, res): Promise<void> => {
  const profile = getRequestProfile(req);
  const driverId = profile.role === "provider" && req.query.driverId != null
    ? parseInt(String(req.query.driverId), 10)
    : profile.id;
  if (!Number.isFinite(driverId)) { res.status(400).json({ error: "Invalid driver id" }); return; }

  await recalculateDriverWallet(driverId);
  const [wallet] = await db
    .select()
    .from(driverWalletTable)
    .where(eq(driverWalletTable.driverProfileId, driverId));
  const earnings = await db
    .select()
    .from(driverEarningsTable)
    .where(eq(driverEarningsTable.driverProfileId, driverId))
    .orderBy(desc(driverEarningsTable.earnedAt));

  const now = new Date();
  const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const weekStart = new Date(dayStart);
  weekStart.setUTCDate(dayStart.getUTCDate() - dayStart.getUTCDay());
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const sumSince = (date: Date) => earnings
    .filter((earning) => new Date(earning.earnedAt).getTime() >= date.getTime())
    .reduce((sum, earning) => sum + toNumber(earning.netEarnings), 0);

  res.json({
    driverProfileId: driverId,
    wallet: wallet ? serializeMoneyRow(wallet) : null,
    dailyEarnings: sumSince(dayStart),
    weeklyEarnings: sumSince(weekStart),
    monthlyEarnings: sumSince(monthStart),
    lifetimeEarnings: wallet ? toNumber(wallet.lifetimeEarnings) : earnings.reduce((sum, earning) => sum + toNumber(earning.netEarnings), 0),
    earnings: earnings.map(serializeMoneyRow),
  });
});

router.patch("/admin/payouts/:id", requireStaffOrProfile, requirePermission("payouts"), async (req, res): Promise<void> => {
  const payoutId = parseInt(String(req.params.id), 10);
  if (!Number.isFinite(payoutId)) { res.status(400).json({ error: "Invalid payout id" }); return; }
  const status = String(req.body?.status ?? "");
  const allowed = new Set(["pending", "approved", "paid", "failed", "cancelled", "partial"]);
  if (!allowed.has(status)) { res.status(400).json({ error: "Invalid payout status." }); return; }

  const [payout] = await db.select().from(vendorPayoutsTable).where(eq(vendorPayoutsTable.id, payoutId));
  if (!payout) { res.status(404).json({ error: "Payout not found" }); return; }

  const now = new Date();
  const paidAmount = req.body?.paidAmount != null ? toNumber(req.body.paidAmount) : toNumber(payout.paidAmount);
  const updates = {
    status: status as "pending" | "approved" | "paid" | "failed" | "cancelled" | "partial",
    paidAmount: status === "paid" ? String(toNumber(payout.netAmount)) : status === "partial" ? paidAmount.toFixed(2) : payout.paidAmount,
    approvedAt: status === "approved" ? now : payout.approvedAt,
    paidAt: status === "paid" || status === "partial" ? now : payout.paidAt,
    cancelledAt: status === "cancelled" ? now : payout.cancelledAt,
    failureReason: status === "failed" ? String(req.body?.reason ?? "Payout failed") : payout.failureReason,
    adjustmentReason: req.body?.adjustmentReason != null ? String(req.body.adjustmentReason) : payout.adjustmentReason,
  };

  const [updated] = await db
    .update(vendorPayoutsTable)
    .set(updates)
    .where(eq(vendorPayoutsTable.id, payoutId))
    .returning();
  if (updated.driverProfileId) {
    const earningStatus = status === "paid" ? "available" : status === "cancelled" ? "cancelled" : status === "failed" ? "pending" : undefined;
    if (earningStatus) {
      await db.update(driverEarningsTable).set({ status: earningStatus }).where(eq(driverEarningsTable.jobId, updated.jobId));
    }
    await recalculateDriverWallet(updated.driverProfileId);
  }
  res.json(serializeMoneyRow(updated));
});

router.post("/admin/jobs/:id/refunds", requireStaffOrProfile, requirePermission("payouts"), async (req, res): Promise<void> => {
  const jobId = parseInt(String(req.params.id), 10);
  const amount = toNumber(req.body?.amount);
  if (!Number.isFinite(jobId) || jobId <= 0) { res.status(400).json({ error: "Invalid job id" }); return; }
  if (!amount || amount <= 0) { res.status(400).json({ error: "Refund amount must be greater than zero." }); return; }

  const [job] = await db.select().from(jobsTable).where(eq(jobsTable.id, jobId));
  if (!job) { res.status(404).json({ error: "Job not found" }); return; }
  const paidAmount = toNumber(job.customerTotalAmount ?? job.totalAmount);
  if (amount > paidAmount) {
    res.status(409).json({ error: "Refund cannot exceed the paid job amount." });
    return;
  }
  if (!job.stripePaymentIntentId) {
    res.status(409).json({ error: "Job has no Stripe payment intent to refund." });
    return;
  }

  try {
    const stripe = await getUncachableStripeClient();
    const reason = String(req.body?.reason ?? "").trim();
    const refund = await stripe.refunds.create({
      payment_intent: job.stripePaymentIntentId,
      amount: cents(amount),
      metadata: {
        jobId: String(job.id),
        requestedByProfileId: req.profile?.id ? String(req.profile.id) : "",
        reason,
      },
    });
    const row = await recordRefundHistory(job, {
      amount,
      reason,
      status: refund.status === "succeeded" ? "succeeded" : "pending",
      stripeRefundId: refund.id,
      requestedByProfileId: req.profile?.id ?? null,
    });
    res.status(201).json(serializeMoneyRow(row));
  } catch (err: any) {
    req.log?.error?.({ err, jobId }, "Refund creation failed");
    res.status(502).json({ error: err?.message ?? "Refund creation failed." });
  }
});

router.get("/admin/payments/reconciliation", requireStaffOrProfile, requirePermission("payouts"), async (req, res): Promise<void> => {
  const since = asDate(req.query.since);
  const until = asDate(req.query.until);
  const conditions = [];
  if (since) conditions.push(gte(paymentHistoryTable.createdAt, since));
  if (until) conditions.push(lte(paymentHistoryTable.createdAt, until));
  const rows = await db
    .select()
    .from(paymentHistoryTable)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(paymentHistoryTable.createdAt));
  res.json({ events: rows.map(serializeMoneyRow) });
});

router.post("/admin/payments/reconciliation", requireStaffOrProfile, requirePermission("payouts"), async (req, res): Promise<void> => {
  const jobId = req.body?.jobId != null ? parseInt(String(req.body.jobId), 10) : null;
  const [job] = jobId ? await db.select().from(jobsTable).where(eq(jobsTable.id, jobId)) : [];
  if (jobId && !job) { res.status(404).json({ error: "Job not found" }); return; }
  const event = await recordPaymentHistory(job ?? {
    id: null as any,
    customerId: null as any,
    providerId: null as any,
    customerTotalAmount: "0",
    providerNetAmount: "0",
    platformFeeAmount: "0",
    totalAmount: "0",
    stripePaymentIntentId: null,
    stripeTransferId: null,
  }, {
    type: "reconciliation",
    status: "reconciled",
    eventType: String(req.body?.eventType ?? "manual_reconciliation"),
    amount: req.body?.amount ?? 0,
    metadata: {
      note: req.body?.note ?? null,
      externalReference: req.body?.externalReference ?? null,
    },
  });
  res.status(201).json(serializeMoneyRow(event));
});

router.get("/admin/financials", requireStaffOrProfile, requirePermission("overview"), async (req, res): Promise<void> => {
  const since = asDate(req.query.since);
  const until = asDate(req.query.until);
  const conditions = [];
  if (since) conditions.push(gte(jobsTable.createdAt, since));
  if (until) conditions.push(lte(jobsTable.createdAt, until));

  const [jobs, payouts, refunds, chargebacks, customers, vendors] = await Promise.all([
    db.select().from(jobsTable).where(conditions.length ? and(...conditions) : undefined),
    db.select().from(vendorPayoutsTable),
    db.select().from(refundHistoryTable),
    db.select().from(paymentHistoryTable).where(eq(paymentHistoryTable.type, "chargeback")),
    db.select({ id: profilesTable.id, companyName: profilesTable.companyName, city: profilesTable.city, state: profilesTable.state }).from(profilesTable),
    db.select({ id: profilesTable.id, companyName: profilesTable.companyName, city: profilesTable.city, state: profilesTable.state }).from(profilesTable),
  ]);

  const profileById = new Map([...customers, ...vendors].map((profile) => [profile.id, profile]));
  const gmv = jobs.reduce((sum, job) => sum + toNumber(job.customerTotalAmount ?? job.totalAmount), 0);
  const netRevenue = jobs.reduce((sum, job) => sum + toNumber(job.platformFeeAmount), 0);
  const completedJobs = jobs.filter((job) => job.status === "completed").length;
  const completedPayouts = payouts.filter((payout) => payout.status === "paid");
  const pendingPayouts = payouts.filter((payout) => payout.status === "pending" || payout.status === "approved");
  const refundsTotal = refunds.reduce((sum, refund) => sum + toNumber(refund.amount), 0);
  const chargebacksTotal = chargebacks.reduce((sum, chargeback) => sum + toNumber(chargeback.amount), 0);

  const groupBy = typeof req.query.groupBy === "string" ? req.query.groupBy : null;
  const groups = new Map<string, { label: string; gmv: number; netRevenue: number; jobs: number }>();
  for (const job of jobs) {
    let key = "all";
    let label = "All";
    if (groupBy === "customer") {
      key = String(job.customerId);
      label = profileById.get(job.customerId)?.companyName ?? `Customer #${job.customerId}`;
    } else if (groupBy === "vendor") {
      key = String(job.providerId);
      label = profileById.get(job.providerId)?.companyName ?? `Vendor #${job.providerId}`;
    } else if (groupBy === "region") {
      const profile = profileById.get(job.customerId);
      key = `${profile?.state ?? "unknown"}:${profile?.city ?? "unknown"}`;
      label = [profile?.city, profile?.state].filter(Boolean).join(", ") || "Unknown";
    } else if (groupBy === "material") {
      key = job.materialType;
      label = job.materialType;
    } else if (groupBy === "truckType") {
      key = job.truckType;
      label = job.truckType;
    } else if (groupBy === "date") {
      key = job.createdAt.toISOString().slice(0, 10);
      label = key;
    }
    const current = groups.get(key) ?? { label, gmv: 0, netRevenue: 0, jobs: 0 };
    current.gmv += toNumber(job.customerTotalAmount ?? job.totalAmount);
    current.netRevenue += toNumber(job.platformFeeAmount);
    current.jobs += 1;
    groups.set(key, current);
  }

  res.json({
    gmv,
    netRevenue,
    vendorPayouts: payouts.reduce((sum, payout) => sum + toNumber(payout.netAmount), 0),
    pendingPayouts: pendingPayouts.reduce((sum, payout) => sum + toNumber(payout.netAmount), 0),
    completedPayouts: completedPayouts.reduce((sum, payout) => sum + toNumber(payout.paidAmount || payout.netAmount), 0),
    refunds: refundsTotal,
    chargebacks: chargebacksTotal,
    averageJobValue: jobs.length ? gmv / jobs.length : 0,
    averageMargin: gmv ? netRevenue / gmv : 0,
    completedJobs,
    groups: Array.from(groups.values()),
  });
});

export default router;
