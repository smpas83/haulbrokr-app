import {
  db,
  invoicesTable,
  paymentTransactionsTable,
  payoutTransfersTable,
  refundsTable,
  type Job,
} from "@workspace/db";

type TransactionKind =
  | "checkout"
  | "charge"
  | "transfer"
  | "refund"
  | "application_fee";
type TransactionStatus = "pending" | "succeeded" | "failed" | "cancelled";

export async function recordPaymentTransaction(input: {
  jobId?: number | null;
  kind: TransactionKind;
  status: TransactionStatus;
  amountCents: number;
  currency?: string;
  stripePaymentIntentId?: string | null;
  stripeChargeId?: string | null;
  stripeTransferId?: string | null;
  stripeRefundId?: string | null;
  stripeCheckoutSessionId?: string | null;
  idempotencyKey?: string | null;
  attempt?: number;
  failureCode?: string | null;
  failureMessage?: string | null;
  metadata?: unknown;
}): Promise<void> {
  try {
    await db.insert(paymentTransactionsTable).values({
      jobId: input.jobId ?? null,
      kind: input.kind,
      status: input.status,
      amountCents: input.amountCents,
      currency: input.currency ?? "usd",
      stripePaymentIntentId: input.stripePaymentIntentId ?? null,
      stripeChargeId: input.stripeChargeId ?? null,
      stripeTransferId: input.stripeTransferId ?? null,
      stripeRefundId: input.stripeRefundId ?? null,
      stripeCheckoutSessionId: input.stripeCheckoutSessionId ?? null,
      idempotencyKey: input.idempotencyKey ?? null,
      attempt: input.attempt ?? 1,
      failureCode: input.failureCode ?? null,
      failureMessage: input.failureMessage ?? null,
      metadata: input.metadata ?? null,
    });
  } catch (err) {
    console.error("Failed to record payment transaction", err);
  }
}

export async function recordPayoutTransfer(input: {
  jobId: number;
  providerProfileId: number;
  stripeAccountId: string;
  stripeTransferId: string;
  amountCents: number;
  sourceChargeId?: string | null;
  attempt?: number;
}): Promise<void> {
  try {
    await db.insert(payoutTransfersTable).values({
      jobId: input.jobId,
      providerProfileId: input.providerProfileId,
      stripeAccountId: input.stripeAccountId,
      stripeTransferId: input.stripeTransferId,
      amountCents: input.amountCents,
      status: "paid",
      sourceChargeId: input.sourceChargeId ?? null,
      attempt: input.attempt ?? 1,
      releasedAt: new Date(),
    });
  } catch (err) {
    console.error("Failed to record payout transfer", err);
  }
}

function invoiceNumber(jobId: number, at = new Date()): string {
  return `INV-${at.getFullYear()}-${String(jobId).padStart(4, "0")}`;
}

function moneyToCents(
  value: string | number | null | undefined,
): number | null {
  if (value == null) return null;
  const parsed = typeof value === "number" ? value : Number.parseFloat(value);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : null;
}

export async function recordInvoiceForJob(
  job: Pick<
    Job,
    | "id"
    | "providerNetAmount"
    | "totalAmount"
    | "platformFeeAmount"
    | "customerTotalAmount"
    | "paymentDueDate"
    | "paidAt"
  >,
): Promise<void> {
  const subtotal = job.providerNetAmount ?? job.totalAmount;
  if (
    subtotal == null ||
    job.platformFeeAmount == null ||
    job.customerTotalAmount == null
  )
    return;
  try {
    await db.insert(invoicesTable).values({
      jobId: job.id,
      invoiceNumber: invoiceNumber(job.id),
      status: job.paidAt ? "paid" : "open",
      subtotal,
      platformFeeAmount: job.platformFeeAmount,
      totalAmount: job.customerTotalAmount,
      dueDate: job.paymentDueDate ?? null,
      paidAt: job.paidAt ?? null,
    });
  } catch (err) {
    console.error("Failed to record marketplace invoice", err);
  }
}

export async function recordRefund(input: {
  jobId: number;
  paymentTransactionId?: number | null;
  amountCents: number;
  reason?: string | null;
  stripeRefundId?: string | null;
  status?: "pending" | "succeeded" | "failed";
  initiatedByProfileId?: number | null;
}): Promise<void> {
  try {
    await db.insert(refundsTable).values({
      jobId: input.jobId,
      paymentTransactionId: input.paymentTransactionId ?? null,
      amountCents: input.amountCents,
      reason: input.reason ?? null,
      stripeRefundId: input.stripeRefundId ?? null,
      status: input.status ?? "pending",
      initiatedByProfileId: input.initiatedByProfileId ?? null,
    });
  } catch (err) {
    console.error("Failed to record marketplace refund", err);
  }
}

export { moneyToCents };
