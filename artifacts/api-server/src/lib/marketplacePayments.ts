import {
  db,
  paymentTransactionsTable,
  payoutTransfersTable,
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
