import { eq } from "drizzle-orm";
import {
  db,
  driverEarningsTable,
  driverWalletTable,
  invoiceDocumentsTable,
  paymentHistoryTable,
  refundHistoryTable,
  ticketsTable,
  vendorPayoutsTable,
  type Job,
} from "@workspace/db";

type JobMoney = Pick<Job,
  "id" | "customerId" | "providerId" | "customerTotalAmount" | "providerNetAmount" |
  "platformFeeAmount" | "totalAmount" | "stripePaymentIntentId" | "stripeTransferId"
>;

function money(value: string | number | null | undefined): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function moneyString(value: string | number | null | undefined): string {
  return money(value).toFixed(2);
}

async function insertReturning<T>(result: unknown, fallback: T): Promise<T> {
  if (result && typeof result === "object" && "returning" in result && typeof (result as any).returning === "function") {
    const [row] = await (result as { returning: () => Promise<T[]> }).returning();
    return row ?? fallback;
  }
  await result;
  return fallback;
}

export async function recordPaymentHistory(
  job: JobMoney,
  event: {
    type: "payment_intent" | "charge" | "checkout" | "invoice" | "transfer" | "payout" | "refund" | "chargeback" | "manual_adjustment" | "reconciliation";
    status: "pending" | "requires_action" | "succeeded" | "failed" | "refunded" | "partially_refunded" | "disputed" | "reconciled";
    eventType: string;
    amount?: string | number | null;
    stripePaymentIntentId?: string | null;
    stripeChargeId?: string | null;
    stripeTransferId?: string | null;
    stripeRefundId?: string | null;
    stripeDisputeId?: string | null;
    metadata?: Record<string, unknown>;
  },
) {
  const values = {
    jobId: job.id,
    customerProfileId: job.customerId,
    vendorProfileId: job.providerId,
    type: event.type,
    status: event.status,
    amount: moneyString(event.amount ?? job.customerTotalAmount ?? job.totalAmount),
    platformFeeAmount: moneyString(job.platformFeeAmount),
    stripePaymentIntentId: event.stripePaymentIntentId ?? job.stripePaymentIntentId ?? null,
    stripeChargeId: event.stripeChargeId ?? null,
    stripeTransferId: event.stripeTransferId ?? job.stripeTransferId ?? null,
    stripeRefundId: event.stripeRefundId ?? null,
    stripeDisputeId: event.stripeDisputeId ?? null,
    eventType: event.eventType,
    metadataJson: event.metadata ? JSON.stringify(event.metadata) : null,
  };
  return insertReturning(db.insert(paymentHistoryTable).values(values), { id: 0, createdAt: new Date(), ...values });
}

export async function ensureInvoiceDocument(job: JobMoney & { paymentDueDate?: Date | null }) {
  const [existing] = await db
    .select()
    .from(invoiceDocumentsTable)
    .where(eq(invoiceDocumentsTable.jobId, job.id));
  if (existing) return existing;

  const values = {
    jobId: job.id,
    customerProfileId: job.customerId,
    invoiceNumber: `HB-${String(job.id).padStart(6, "0")}`,
    subtotalAmount: moneyString(job.totalAmount ?? job.providerNetAmount),
    platformFeeAmount: moneyString(job.platformFeeAmount),
    totalAmount: moneyString(job.customerTotalAmount ?? job.totalAmount),
    amountPaid: "0.00",
    amountRefunded: "0.00",
    dueAt: job.paymentDueDate ?? null,
    status: "issued" as const,
  };
  return insertReturning(db.insert(invoiceDocumentsTable).values(values), { id: 0, createdAt: new Date(), updatedAt: new Date(), pdfUrl: null, paidAt: null, ...values });
}

export async function createPendingPayoutForCompletedJob(job: JobMoney) {
  if (money(job.providerNetAmount) <= 0) return null;

  const [existing] = await db
    .select()
    .from(vendorPayoutsTable)
    .where(eq(vendorPayoutsTable.jobId, job.id));
  if (existing) return existing;

  const [ticket] = await db
    .select()
    .from(ticketsTable)
    .where(eq(ticketsTable.jobId, job.id));

  const values = {
    jobId: job.id,
    vendorProfileId: job.providerId,
    driverProfileId: ticket?.driverProfileId ?? null,
    grossAmount: moneyString(job.customerTotalAmount ?? job.totalAmount),
    platformFeeAmount: moneyString(job.platformFeeAmount),
    netAmount: moneyString(job.providerNetAmount),
    paidAmount: "0.00",
    status: "pending" as const,
  };
  const payout = await insertReturning(db.insert(vendorPayoutsTable).values(values), {
    id: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    stripeTransferId: null,
    stripePayoutId: null,
    failureReason: null,
    adjustmentReason: null,
    approvedAt: null,
    paidAt: null,
    cancelledAt: null,
    ...values,
  });

  if (ticket?.driverProfileId) {
    await createDriverEarning(job, ticket.driverProfileId);
  }
  return payout;
}

async function createDriverEarning(job: JobMoney, driverProfileId: number) {
  const [existing] = await db
    .select()
    .from(driverEarningsTable)
    .where(eq(driverEarningsTable.jobId, job.id));
  if (!existing) {
    const values = {
      jobId: job.id,
      driverProfileId,
      vendorProfileId: job.providerId,
      grossEarnings: moneyString(job.providerNetAmount),
      platformFees: "0.00",
      fuelAdjustments: "0.00",
      bonuses: "0.00",
      tips: "0.00",
      netEarnings: moneyString(job.providerNetAmount),
      status: "pending" as const,
    };
    await insertReturning(db.insert(driverEarningsTable).values(values), { id: 0, createdAt: new Date(), updatedAt: new Date(), earnedAt: new Date(), ...values });
  }
  await recalculateDriverWallet(driverProfileId);
}

export async function recalculateDriverWallet(driverProfileId: number) {
  const earnings = await db
    .select()
    .from(driverEarningsTable)
    .where(eq(driverEarningsTable.driverProfileId, driverProfileId));
  const pending = earnings
    .filter((earning) => earning.status === "pending")
    .reduce((sum, earning) => sum + money(earning.netEarnings), 0);
  const available = earnings
    .filter((earning) => earning.status === "available")
    .reduce((sum, earning) => sum + money(earning.netEarnings), 0);
  const paid = earnings
    .filter((earning) => earning.status === "paid")
    .reduce((sum, earning) => sum + money(earning.netEarnings), 0);
  const lifetime = earnings
    .filter((earning) => earning.status !== "cancelled")
    .reduce((sum, earning) => sum + money(earning.netEarnings), 0);

  const [wallet] = await db
    .select()
    .from(driverWalletTable)
    .where(eq(driverWalletTable.driverProfileId, driverProfileId));
  const values = {
    pendingBalance: pending.toFixed(2),
    availableBalance: available.toFixed(2),
    paidOutBalance: paid.toFixed(2),
    lifetimeEarnings: lifetime.toFixed(2),
    lastCalculatedAt: new Date(),
  };
  if (wallet) {
    await db.update(driverWalletTable).set(values).where(eq(driverWalletTable.id, wallet.id));
    return;
  }
  await insertReturning(db.insert(driverWalletTable).values({ driverProfileId, ...values }), {
    id: 0,
    driverProfileId,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...values,
  });
}

export async function markVendorPayoutPaid(job: JobMoney, transferId: string | null) {
  const [payout] = await db
    .select()
    .from(vendorPayoutsTable)
    .where(eq(vendorPayoutsTable.jobId, job.id));
  if (!payout) return null;

  const now = new Date();
  const [updated] = await db.update(vendorPayoutsTable).set({
    status: "paid",
    paidAmount: moneyString(payout.netAmount),
    stripeTransferId: transferId ?? payout.stripeTransferId,
    paidAt: now,
    failureReason: null,
  }).where(eq(vendorPayoutsTable.id, payout.id)).returning();

  if (updated.driverProfileId) {
    await db.update(driverEarningsTable).set({ status: "available" }).where(eq(driverEarningsTable.jobId, job.id));
    await recalculateDriverWallet(updated.driverProfileId);
  }
  return updated;
}

export async function markVendorPayoutFailed(job: JobMoney, reason: string) {
  const [payout] = await db
    .select()
    .from(vendorPayoutsTable)
    .where(eq(vendorPayoutsTable.jobId, job.id));
  if (!payout) return null;
  const [updated] = await db.update(vendorPayoutsTable).set({
    status: "failed",
    failureReason: reason,
  }).where(eq(vendorPayoutsTable.id, payout.id)).returning();
  return updated;
}

export async function recordRefundHistory(
  job: JobMoney,
  refundInput: {
    amount: string | number;
    reason?: string | null;
    status: "pending" | "succeeded" | "failed" | "cancelled";
    stripeRefundId?: string | null;
    requestedByProfileId?: number | null;
  },
) {
  const payment = await recordPaymentHistory(job, {
    type: "refund",
    status: refundInput.amount && money(refundInput.amount) < money(job.customerTotalAmount) ? "partially_refunded" : "refunded",
    eventType: "refund_recorded",
    amount: refundInput.amount,
    stripeRefundId: refundInput.stripeRefundId ?? null,
    metadata: { reason: refundInput.reason ?? null },
  });

  const values = {
    jobId: job.id,
    paymentHistoryId: payment.id,
    customerProfileId: job.customerId,
    vendorProfileId: job.providerId,
    amount: moneyString(refundInput.amount),
    reason: refundInput.reason ?? null,
    status: refundInput.status,
    stripeRefundId: refundInput.stripeRefundId ?? null,
    requestedByProfileId: refundInput.requestedByProfileId ?? null,
  };
  return insertReturning(db.insert(refundHistoryTable).values(values), { id: 0, createdAt: new Date(), updatedAt: new Date(), currency: "usd", ...values });
}
