import type Stripe from "stripe";
import { eq } from "drizzle-orm";
import { db, jobsTable } from "@workspace/db";
import { getUncachableStripeClient } from "./stripeClient";
import { recordPaymentAudit, safeMetadataJson } from "./paymentAudit";

export interface CustomerInstrument {
  stripeCustomerId: string | null;
  stripePaymentMethodId: string | null;
  methodType: string;
}

export interface StripeJob {
  id: number;
  customerId: number;
  customerTotalAmount: string;
  providerNetAmount: string;
  paymentAttempts?: number | null;
  materialType?: string | null;
}

function amountCents(amount: string | number): number {
  const parsed = typeof amount === "number" ? amount : Number.parseFloat(amount);
  return Math.round(parsed * 100);
}

export function chargeIdFromPaymentIntent(pi: Pick<Stripe.PaymentIntent, "latest_charge">): string | null {
  const charge = pi.latest_charge;
  if (!charge) return null;
  if (typeof charge === "string") return charge;
  return charge.id ?? null;
}

export function receiptUrlFromPaymentIntent(pi: Stripe.PaymentIntent): string | null {
  const charge = pi.latest_charge;
  if (!charge || typeof charge === "string") return null;
  return charge.receipt_url ?? null;
}

function buildPaymentIntentParams(
  job: StripeJob,
  customer: CustomerInstrument,
  captureMethod: "automatic" | "manual",
): Record<string, unknown> {
  const grossCents = amountCents(job.customerTotalAmount);
  const hasRealInstrument = !!customer.stripeCustomerId && !!customer.stripePaymentMethodId;
  const isAch = customer.methodType === "ach";

  if (hasRealInstrument) {
    return {
      amount: grossCents,
      currency: "usd",
      confirm: true,
      capture_method: captureMethod,
      customer: customer.stripeCustomerId,
      payment_method: customer.stripePaymentMethodId,
      payment_method_types: isAch ? ["us_bank_account"] : ["card"],
      off_session: true,
      description: `HaulBrokr job #${job.id}`,
      metadata: { jobId: String(job.id), kind: captureMethod === "manual" ? "authorization" : "charge" },
    };
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("No saved payment method on file. The customer must add a card before this job can be charged.");
  }

  return {
    amount: grossCents,
    currency: "usd",
    confirm: true,
    capture_method: captureMethod,
    payment_method: isAch ? "pm_usBankAccount_success" : "pm_card_visa",
    payment_method_types: isAch ? ["us_bank_account"] : ["card"],
    description: `HaulBrokr job #${job.id}`,
    metadata: { jobId: String(job.id), kind: captureMethod === "manual" ? "authorization" : "charge" },
  };
}

export async function createAuthorizedPaymentIntent(
  job: StripeJob,
  customer: CustomerInstrument,
  attempt: number,
): Promise<Stripe.PaymentIntent> {
  const stripe = await getUncachableStripeClient();
  const pi = await stripe.paymentIntents.create(
    buildPaymentIntentParams(job, customer, "manual") as any,
    { idempotencyKey: `job-authorize:${job.id}:${attempt}` },
  );

  await recordPaymentAudit({
    jobId: job.id,
    profileId: job.customerId,
    eventType: "payment_intent.authorized",
    status: pi.status,
    amountCents: amountCents(job.customerTotalAmount),
    currency: pi.currency ?? "usd",
    stripePaymentIntentId: pi.id,
    stripeChargeId: chargeIdFromPaymentIntent(pi),
    message: "Customer payment authorized for later capture.",
    metadataJson: safeMetadataJson(pi.metadata),
  });

  return pi;
}

export async function captureAuthorizedPaymentIntent(job: StripeJob & { stripePaymentIntentId: string }): Promise<Stripe.PaymentIntent> {
  const stripe = await getUncachableStripeClient();
  const pi = await stripe.paymentIntents.capture(
    job.stripePaymentIntentId,
    {},
    { idempotencyKey: `job-capture:${job.id}:${job.paymentAttempts ?? 0}` },
  );

  await recordPaymentAudit({
    jobId: job.id,
    profileId: job.customerId,
    eventType: "payment_intent.captured",
    status: pi.status,
    amountCents: amountCents(job.customerTotalAmount),
    currency: pi.currency ?? "usd",
    stripePaymentIntentId: pi.id,
    stripeChargeId: chargeIdFromPaymentIntent(pi),
    message: "Authorized customer payment captured.",
    metadataJson: safeMetadataJson(pi.metadata),
  });

  return pi;
}

export async function refundJobPayment(
  job: {
    id: number;
    customerId: number;
    customerTotalAmount: string | null;
    stripePaymentIntentId: string | null;
  },
  amountCentsOverride?: number,
): Promise<Stripe.Refund> {
  if (!job.stripePaymentIntentId) {
    throw Object.assign(new Error("This job does not have a Stripe payment to refund."), { status: 400 });
  }

  const stripe = await getUncachableStripeClient();
  const refund = await stripe.refunds.create(
    {
      payment_intent: job.stripePaymentIntentId,
      ...(amountCentsOverride != null ? { amount: amountCentsOverride } : {}),
      metadata: { jobId: String(job.id) },
    },
    { idempotencyKey: `job-refund:${job.id}:${amountCentsOverride ?? "full"}` },
  );

  const fullAmountCents = job.customerTotalAmount == null ? null : amountCents(job.customerTotalAmount);
  const isFullRefund = amountCentsOverride == null || (fullAmountCents != null && amountCentsOverride >= fullAmountCents);
  const now = new Date();
  await db.update(jobsTable)
    .set({
      paymentStatus: isFullRefund ? "refunded" : "partially_refunded",
      refundStatus: refund.status ?? "pending",
      stripeRefundId: refund.id,
      refundedAt: refund.status === "succeeded" ? now : null,
    })
    .where(eq(jobsTable.id, job.id));

  await recordPaymentAudit({
    jobId: job.id,
    profileId: job.customerId,
    eventType: "refund.created",
    status: refund.status ?? "pending",
    amountCents: refund.amount ?? amountCentsOverride ?? fullAmountCents,
    currency: refund.currency ?? "usd",
    stripePaymentIntentId: job.stripePaymentIntentId,
    stripeRefundId: refund.id,
    message: isFullRefund ? "Full refund created." : "Partial refund created.",
    metadataJson: safeMetadataJson(refund.metadata),
  });

  return refund;
}
