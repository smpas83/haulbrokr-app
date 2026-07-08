import type Stripe from "stripe";
import { and, eq, inArray, sql } from "drizzle-orm";
import {
  db,
  jobsTable,
  paymentRefundsTable,
  type Job,
  type PaymentRefund,
} from "@workspace/db";
import { getUncachableStripeClient } from "./stripeClient";
import { recordActivity } from "./activityNotify";
import { logger } from "./logger";

const REFUNDABLE_PAYMENT_STATUSES = new Set([
  "released",
  "paid",
  "partially_refunded",
]);

export type IssueRefundInput = {
  job: Job;
  amountDollars: number | null;
  reason: string | null;
  createdByProfileId: number | null;
  createdByStaffUsername: string | null;
  idempotencyKey: string;
};

export type IssueRefundResult =
  | { ok: true; refund: PaymentRefund; duplicate: boolean }
  | { ok: false; code: string; message: string };

function dollarsToCents(amount: string | number): number {
  const n = typeof amount === "string" ? parseFloat(amount) : amount;
  return Math.round(n * 100);
}

function centsToDollars(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function isRefundAuthorized(
  profile:
    | { role?: string | null; staffRole?: string | null }
    | null
    | undefined,
): boolean {
  if (!profile) return false;
  if (profile.staffRole) return true;
  return false;
}

export async function sumRefundedForJob(jobId: number): Promise<number> {
  const [row] = await db
    .select({
      total: sql<string>`coalesce(sum(${paymentRefundsTable.amount}), 0)`,
    })
    .from(paymentRefundsTable)
    .where(
      and(
        eq(paymentRefundsTable.jobId, jobId),
        inArray(paymentRefundsTable.status, ["pending", "succeeded"]),
      ),
    );
  return parseFloat(row?.total ?? "0");
}

async function chargeIdFromPaymentIntent(
  stripe: Stripe,
  paymentIntentId: string,
): Promise<string> {
  const pi = await stripe.paymentIntents.retrieve(paymentIntentId, {
    expand: ["latest_charge"],
  });
  const charge = pi.latest_charge;
  if (typeof charge === "string") return charge;
  if (
    charge &&
    typeof charge === "object" &&
    "id" in charge &&
    typeof charge.id === "string"
  ) {
    return charge.id;
  }
  throw new Error("Payment intent has no charge to refund.");
}

export function deriveJobPaymentStatusAfterRefund(
  customerTotalAmount: string | null,
  refundedAmount: number,
): "released" | "partially_refunded" | "refunded" {
  const gross =
    customerTotalAmount != null ? parseFloat(customerTotalAmount) : 0;
  if (gross <= 0 || refundedAmount <= 0) return "released";
  if (refundedAmount >= gross - 0.005) return "refunded";
  return "partially_refunded";
}

export async function syncJobRefundTotals(jobId: number): Promise<void> {
  const [job] = await db
    .select()
    .from(jobsTable)
    .where(eq(jobsTable.id, jobId));
  if (!job) return;

  const refunded = await sumRefundedForJob(jobId);
  const paymentStatus = deriveJobPaymentStatusAfterRefund(
    job.customerTotalAmount,
    refunded,
  );

  await db
    .update(jobsTable)
    .set({
      refundedAmount: centsToDollars(Math.round(refunded * 100)),
      paymentStatus,
    })
    .where(eq(jobsTable.id, jobId));
}

async function notifyRefund(
  job: Job,
  amount: string,
  full: boolean,
): Promise<void> {
  await recordActivity({
    profileId: job.customerId,
    type: "payment_refunded",
    description: full
      ? `A full refund of $${amount} was issued for job #${job.id} — ${job.materialType} delivery.`
      : `A partial refund of $${amount} was issued for job #${job.id} — ${job.materialType} delivery.`,
    relatedId: job.id,
  });
}

export async function issueJobRefund(
  input: IssueRefundInput,
): Promise<IssueRefundResult> {
  const {
    job,
    reason,
    createdByProfileId,
    createdByStaffUsername,
    idempotencyKey,
  } = input;

  if (!job.stripePaymentIntentId) {
    return {
      ok: false,
      code: "missing_payment_intent",
      message: "Job has no Stripe payment intent.",
    };
  }
  if (job.paymentStatus === "refunded") {
    return {
      ok: false,
      code: "already_refunded",
      message: "Job has already been fully refunded.",
    };
  }
  if (!REFUNDABLE_PAYMENT_STATUSES.has(job.paymentStatus)) {
    return {
      ok: false,
      code: "not_refundable",
      message: `Job payment status "${job.paymentStatus}" is not refundable.`,
    };
  }

  const gross =
    job.customerTotalAmount != null ? parseFloat(job.customerTotalAmount) : 0;
  if (gross <= 0) {
    return {
      ok: false,
      code: "missing_amount",
      message: "Job has no customer total amount.",
    };
  }

  const [existing] = await db
    .select()
    .from(paymentRefundsTable)
    .where(eq(paymentRefundsTable.idempotencyKey, idempotencyKey));
  if (existing) {
    return { ok: true, refund: existing, duplicate: true };
  }

  const alreadyRefunded = await sumRefundedForJob(job.id);
  const remaining = gross - alreadyRefunded;
  if (remaining <= 0) {
    return {
      ok: false,
      code: "already_refunded",
      message: "No refundable balance remains on this job.",
    };
  }

  const refundDollars = input.amountDollars ?? remaining;
  if (refundDollars <= 0 || refundDollars > remaining + 0.005) {
    return {
      ok: false,
      code: "invalid_amount",
      message: `Refund amount must be between $0.01 and $${remaining.toFixed(2)}.`,
    };
  }

  const refundCents = dollarsToCents(refundDollars);
  const stripe = await getUncachableStripeClient();
  const chargeId = await chargeIdFromPaymentIntent(
    stripe,
    job.stripePaymentIntentId,
  );

  const stripeRefund = await stripe.refunds.create(
    {
      charge: chargeId,
      amount: refundCents,
      reason:
        reason === "duplicate" || reason === "fraudulent"
          ? reason
          : "requested_by_customer",
      metadata: {
        jobId: String(job.id),
        operatorReason: reason ?? "",
        createdByProfileId:
          createdByProfileId != null ? String(createdByProfileId) : "",
        createdByStaffUsername: createdByStaffUsername ?? "",
      },
      reverse_transfer: true,
    },
    { idempotencyKey },
  );

  const refundAmount = centsToDollars(stripeRefund.amount ?? refundCents);
  const status = mapStripeRefundStatus(stripeRefund.status);

  const [record] = await db
    .insert(paymentRefundsTable)
    .values({
      jobId: job.id,
      stripeRefundId: stripeRefund.id,
      stripePaymentIntentId: job.stripePaymentIntentId,
      stripeChargeId: chargeId,
      amount: refundAmount,
      reason,
      status,
      createdByProfileId,
      createdByStaffUsername,
      idempotencyKey,
    })
    .returning();

  await db
    .update(jobsTable)
    .set({ refundAttempts: job.refundAttempts + 1 })
    .where(eq(jobsTable.id, job.id));

  await syncJobRefundTotals(job.id);

  if (status === "succeeded") {
    const full = alreadyRefunded + parseFloat(refundAmount) >= gross - 0.005;
    await notifyRefund(job, refundAmount, full);
  }

  return { ok: true, refund: record, duplicate: false };
}

export function mapStripeRefundStatus(
  status: string | null | undefined,
): PaymentRefund["status"] {
  switch (status) {
    case "succeeded":
      return "succeeded";
    case "failed":
      return "failed";
    case "canceled":
      return "canceled";
    default:
      return "pending";
  }
}

export async function upsertRefundFromStripe(
  refund: Stripe.Refund,
): Promise<PaymentRefund | null> {
  const jobIdRaw = refund.metadata?.jobId;
  if (!jobIdRaw) return null;
  const jobId = parseInt(jobIdRaw, 10);
  if (!Number.isFinite(jobId)) return null;

  const [job] = await db
    .select()
    .from(jobsTable)
    .where(eq(jobsTable.id, jobId));
  if (!job) return null;

  const paymentIntentId =
    typeof refund.payment_intent === "string"
      ? refund.payment_intent
      : (refund.payment_intent?.id ?? job.stripePaymentIntentId ?? "");
  const chargeId =
    typeof refund.charge === "string"
      ? refund.charge
      : (refund.charge?.id ?? "");

  const status = mapStripeRefundStatus(refund.status);
  const amount = centsToDollars(refund.amount ?? 0);

  const [existing] = await db
    .select()
    .from(paymentRefundsTable)
    .where(eq(paymentRefundsTable.stripeRefundId, refund.id));

  let record: PaymentRefund;
  if (existing) {
    const wasSucceeded = existing.status === "succeeded";
    [record] = await db
      .update(paymentRefundsTable)
      .set({ status, amount, updatedAt: new Date() })
      .where(eq(paymentRefundsTable.id, existing.id))
      .returning();
    await syncJobRefundTotals(jobId);
    if (!wasSucceeded && status === "succeeded") {
      const gross =
        job.customerTotalAmount != null
          ? parseFloat(job.customerTotalAmount)
          : 0;
      const refunded = await sumRefundedForJob(jobId);
      await notifyRefund(job, amount, refunded >= gross - 0.005);
    }
    return record;
  }

  [record] = await db
    .insert(paymentRefundsTable)
    .values({
      jobId,
      stripeRefundId: refund.id,
      stripePaymentIntentId: paymentIntentId,
      stripeChargeId: chargeId,
      amount,
      reason: refund.metadata?.operatorReason || refund.reason || null,
      status,
      createdByProfileId: refund.metadata?.createdByProfileId
        ? parseInt(refund.metadata.createdByProfileId, 10) || null
        : null,
      createdByStaffUsername: refund.metadata?.createdByStaffUsername || null,
      idempotencyKey: `webhook:${refund.id}`,
    })
    .returning();

  await syncJobRefundTotals(jobId);
  if (status === "succeeded") {
    const gross =
      job.customerTotalAmount != null ? parseFloat(job.customerTotalAmount) : 0;
    const refunded = await sumRefundedForJob(jobId);
    await notifyRefund(job, amount, refunded >= gross - 0.005);
  }

  return record;
}

export async function handleChargeRefunded(
  charge: Stripe.Charge,
): Promise<{ jobId: number | null }> {
  const jobIdRaw = charge.metadata?.jobId;
  if (!jobIdRaw) {
    const pi =
      typeof charge.payment_intent === "string"
        ? charge.payment_intent
        : charge.payment_intent?.id;
    if (!pi) return { jobId: null };
    const [job] = await db
      .select()
      .from(jobsTable)
      .where(eq(jobsTable.stripePaymentIntentId, pi));
    if (!job) return { jobId: null };
    const refundedDollars = centsToDollars(charge.amount_refunded ?? 0);
    await db
      .update(jobsTable)
      .set({
        refundedAmount: refundedDollars,
        paymentStatus: deriveJobPaymentStatusAfterRefund(
          job.customerTotalAmount,
          parseFloat(refundedDollars),
        ),
      })
      .where(eq(jobsTable.id, job.id));
    return { jobId: job.id };
  }

  const jobId = parseInt(jobIdRaw, 10);
  if (!Number.isFinite(jobId)) return { jobId: null };

  const [job] = await db
    .select()
    .from(jobsTable)
    .where(eq(jobsTable.id, jobId));
  if (!job) return { jobId: null };

  const refundedDollars = centsToDollars(charge.amount_refunded ?? 0);
  await db
    .update(jobsTable)
    .set({
      refundedAmount: refundedDollars,
      paymentStatus: deriveJobPaymentStatusAfterRefund(
        job.customerTotalAmount,
        parseFloat(refundedDollars),
      ),
    })
    .where(eq(jobsTable.id, jobId));

  return { jobId };
}

export type PaymentHistoryEntry = {
  type: "payment" | "refund";
  amount: number;
  status: string;
  stripeId: string | null;
  reason: string | null;
  createdAt: Date;
  createdBy: string | null;
};

export type JobPaymentHistory = {
  jobId: number;
  originalPayment: {
    amount: number;
    paymentIntentId: string | null;
    chargeId: string | null;
    transferId: string | null;
    status: string;
    paidAt: Date | null;
    releasedAt: Date | null;
  };
  refunds: Array<{
    id: number;
    stripeRefundId: string;
    amount: number;
    reason: string | null;
    status: string;
    createdAt: Date;
    createdBy: string | null;
  }>;
  currentBalance: number;
  refundStatus: string;
  timeline: PaymentHistoryEntry[];
};

export async function getJobPaymentHistory(
  jobId: number,
): Promise<JobPaymentHistory | null> {
  const [job] = await db
    .select()
    .from(jobsTable)
    .where(eq(jobsTable.id, jobId));
  if (!job) return null;

  const refunds = await db
    .select()
    .from(paymentRefundsTable)
    .where(eq(paymentRefundsTable.jobId, jobId))
    .orderBy(paymentRefundsTable.createdAt);

  const gross =
    job.customerTotalAmount != null ? parseFloat(job.customerTotalAmount) : 0;
  const refunded =
    job.refundedAmount != null ? parseFloat(job.refundedAmount) : 0;

  const refundRows = refunds.map((r) => ({
    id: r.id,
    stripeRefundId: r.stripeRefundId,
    amount: parseFloat(r.amount),
    reason: r.reason,
    status: r.status,
    createdAt: r.createdAt,
    createdBy:
      r.createdByStaffUsername ??
      (r.createdByProfileId != null ? `profile:${r.createdByProfileId}` : null),
  }));

  const timeline: PaymentHistoryEntry[] = [];
  if (job.releasedAt || job.paidAt) {
    timeline.push({
      type: "payment",
      amount: gross,
      status: job.paymentStatus,
      stripeId: job.stripePaymentIntentId,
      reason: null,
      createdAt: job.releasedAt ?? job.paidAt ?? job.createdAt,
      createdBy: null,
    });
  }
  for (const r of refundRows) {
    timeline.push({
      type: "refund",
      amount: r.amount,
      status: r.status,
      stripeId: r.stripeRefundId,
      reason: r.reason,
      createdAt: r.createdAt,
      createdBy: r.createdBy,
    });
  }
  timeline.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  return {
    jobId,
    originalPayment: {
      amount: gross,
      paymentIntentId: job.stripePaymentIntentId,
      chargeId: null,
      transferId: job.stripeTransferId,
      status: job.paymentStatus,
      paidAt: job.paidAt,
      releasedAt: job.releasedAt,
    },
    refunds: refundRows,
    currentBalance: Math.max(0, gross - refunded),
    refundStatus: job.paymentStatus,
    timeline,
  };
}
