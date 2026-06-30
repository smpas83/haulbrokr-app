import { db, marketplacePaymentsTable } from "@workspace/db";

type PaymentLedgerType = "payment_intent" | "checkout_session" | "transfer" | "refund" | "invoice";
type PaymentLedgerStatus = "pending" | "requires_action" | "paid" | "released" | "failed" | "refunded";

export type PaymentLedgerInput = {
  jobId: number;
  customerId: number;
  vendorId: number;
  type: PaymentLedgerType;
  status: PaymentLedgerStatus;
  amountCents: number;
  platformFeeCents?: number;
  vendorPayoutCents?: number;
  driverPayoutCents?: number | null;
  currency?: string;
  paymentRail?: string | null;
  stripePaymentIntentId?: string | null;
  stripeCheckoutSessionId?: string | null;
  stripeTransferId?: string | null;
  stripeRefundId?: string | null;
  description?: string | null;
};

function cents(value: number | undefined): number {
  if (value == null) return 0;
  if (!Number.isFinite(value)) throw new Error("Payment ledger amount must be finite.");
  return Math.round(value);
}

export async function recordPaymentLedgerEntry(input: PaymentLedgerInput): Promise<void> {
  await db.insert(marketplacePaymentsTable).values({
    jobId: input.jobId,
    customerId: input.customerId,
    vendorId: input.vendorId,
    type: input.type,
    status: input.status,
    amountCents: cents(input.amountCents),
    platformFeeCents: cents(input.platformFeeCents),
    vendorPayoutCents: cents(input.vendorPayoutCents),
    driverPayoutCents: input.driverPayoutCents == null ? null : cents(input.driverPayoutCents),
    currency: input.currency ?? "usd",
    paymentRail: input.paymentRail ?? null,
    stripePaymentIntentId: input.stripePaymentIntentId ?? null,
    stripeCheckoutSessionId: input.stripeCheckoutSessionId ?? null,
    stripeTransferId: input.stripeTransferId ?? null,
    stripeRefundId: input.stripeRefundId ?? null,
    description: input.description ?? null,
  });
}

export function serializeMarketplacePayment(row: typeof marketplacePaymentsTable.$inferSelect) {
  return {
    ...row,
    amount: row.amountCents / 100,
    platformFee: row.platformFeeCents / 100,
    vendorPayout: row.vendorPayoutCents / 100,
    driverPayout: row.driverPayoutCents == null ? null : row.driverPayoutCents / 100,
  };
}
