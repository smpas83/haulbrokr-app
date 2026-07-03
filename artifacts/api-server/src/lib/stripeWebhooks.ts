import type Stripe from "stripe";
import { eq } from "drizzle-orm";
import { db, jobsTable, payoutAccountsTable, activityTable } from "@workspace/db";
import { checkProviderPayoutReadiness, syncStripeStatus } from "./payoutStatus";
import { settleConfirmedPayout } from "./payoutRetry";
import { logger } from "./logger";
import {
  beginWebhookEvent,
  finishWebhookEvent,
  recordPaymentAudit,
  safeMetadataJson,
} from "./paymentAudit";
import { chargeIdFromPaymentIntent, receiptUrlFromPaymentIntent } from "./stripePayments";

export type WebhookHandleResult =
  | { handled: true; action: string }
  | { handled: false; reason: string };

async function notifyPaymentFailed(job: { id: number; customerId: number; materialType: string }): Promise<void> {
  try {
    await db.insert(activityTable).values({
      profileId: job.customerId,
      type: "payment_failed",
      description: `Payment failed for job #${job.id} — ${job.materialType} delivery. Open the job to retry.`,
      relatedId: job.id,
    });
  } catch (err) {
    logger.error({ err, jobId: job.id }, "Failed to record payment_failed notification from webhook");
  }
}

async function markJobReleased(
  jobId: number,
  paymentIntentId: string | null,
  transferId: string | null,
  chargeId: string | null = null,
  receiptUrl: string | null = null,
): Promise<void> {
  const now = new Date();
  await db
    .update(jobsTable)
    .set({
      paymentStatus: "released",
      paidAt: now,
      releasedAt: now,
      stripePaymentIntentId: paymentIntentId,
      ...(chargeId ? { stripeChargeId: chargeId } : {}),
      ...(transferId ? { stripeTransferId: transferId } : {}),
      ...(receiptUrl ? { stripeReceiptUrl: receiptUrl } : {}),
      payoutStatus: "paid",
      payoutRetryFailures: 0,
      payoutAlertSentAt: null,
    })
    .where(eq(jobsTable.id, jobId));
}

function transferIdFromPaymentIntent(pi: Stripe.PaymentIntent): string | null {
  const charge = pi.latest_charge;
  if (!charge || typeof charge === "string") return null;
  const transfer = charge.transfer;
  if (typeof transfer === "string") return transfer;
  if (transfer && typeof transfer === "object" && "id" in transfer) return transfer.id;
  return null;
}

async function loadJobByMetadataJobId(jobIdRaw: string | undefined): Promise<(typeof jobsTable.$inferSelect) | null> {
  if (!jobIdRaw) return null;
  const jobId = parseInt(jobIdRaw, 10);
  if (!Number.isFinite(jobId)) return null;
  const [job] = await db.select().from(jobsTable).where(eq(jobsTable.id, jobId));
  return job ?? null;
}

async function loadJobByPaymentIntentId(paymentIntentId: string | null | undefined): Promise<(typeof jobsTable.$inferSelect) | null> {
  if (!paymentIntentId) return null;
  const [job] = await db.select().from(jobsTable).where(eq(jobsTable.stripePaymentIntentId, paymentIntentId));
  return job ?? null;
}

function paymentIntentMatchesJob(
  job: { stripePaymentIntentId: string | null },
  pi: Stripe.PaymentIntent,
): boolean {
  return !job.stripePaymentIntentId || job.stripePaymentIntentId === pi.id;
}

/**
 * Finalize a Checkout (destination charge) job — mirrors verify-checkout without
 * re-charging. The provider net already moved via transfer_data on the PI.
 */
async function finalizeCheckoutFromPaymentIntent(
  job: typeof jobsTable.$inferSelect,
  pi: Stripe.PaymentIntent,
): Promise<WebhookHandleResult> {
  if (job.paymentStatus === "released" || job.paymentStatus === "paid") {
    return { handled: true, action: "checkout_already_finalized" };
  }
  if (pi.metadata?.kind !== "checkout") {
    return { handled: false, reason: "not_checkout_payment_intent" };
  }
  if (!paymentIntentMatchesJob(job, pi)) {
    return { handled: false, reason: "pi_mismatch" };
  }
  await markJobReleased(job.id, pi.id, transferIdFromPaymentIntent(pi), chargeIdFromPaymentIntent(pi), receiptUrlFromPaymentIntent(pi));
  return { handled: true, action: "checkout_finalized" };
}

/**
 * Complete the transfer leg for a charge+transfer job whose PaymentIntent has
 * now succeeded (3-D Secure confirmed, ACH settled, or async recovery).
 */
async function finalizeChargeTransferFromPaymentIntent(
  job: typeof jobsTable.$inferSelect,
  pi: Stripe.PaymentIntent,
): Promise<WebhookHandleResult> {
  if (job.paymentStatus === "released" || job.paymentStatus === "paid") {
    return { handled: true, action: "already_finalized" };
  }
  if (!paymentIntentMatchesJob(job, pi)) {
    return { handled: false, reason: "pi_mismatch" };
  }

  if (job.stripeTransferId) {
    await markJobReleased(job.id, pi.id, job.stripeTransferId, chargeIdFromPaymentIntent(pi), receiptUrlFromPaymentIntent(pi));
    return { handled: true, action: "marked_released_existing_transfer" };
  }

  if (job.providerNetAmount == null) {
    return { handled: false, reason: "job_missing_amounts" };
  }

  const readiness = await checkProviderPayoutReadiness(job.providerId);
  if (!readiness.ok) {
    await db
      .update(jobsTable)
      .set({ stripePaymentIntentId: pi.id })
      .where(eq(jobsTable.id, job.id));
    return { handled: true, action: "awaiting_payout_readiness" };
  }

  await settleConfirmedPayout(
    { id: job.id, providerNetAmount: job.providerNetAmount, paymentAttempts: job.paymentAttempts },
    readiness.stripeAccountId,
    pi,
  );
  return { handled: true, action: "transfer_completed" };
}

export async function handlePaymentIntentSucceeded(
  pi: Stripe.PaymentIntent,
): Promise<WebhookHandleResult> {
  const job = await loadJobByMetadataJobId(pi.metadata?.jobId);
  if (!job) return { handled: false, reason: "job_not_found" };

  const result = pi.metadata?.kind === "checkout"
    ? await finalizeCheckoutFromPaymentIntent(job, pi)
    : await finalizeChargeTransferFromPaymentIntent(job, pi);

  await recordPaymentAudit({
    jobId: job.id,
    profileId: job.customerId,
    eventType: "payment_intent.succeeded",
    status: result.handled ? result.action : result.reason,
    amountCents: pi.amount_received ?? pi.amount ?? null,
    currency: pi.currency ?? "usd",
    stripePaymentIntentId: pi.id,
    stripeChargeId: chargeIdFromPaymentIntent(pi),
    stripeTransferId: transferIdFromPaymentIntent(pi),
    message: "Stripe payment intent succeeded.",
    metadataJson: safeMetadataJson(pi.metadata),
  });

  return result;
}

export async function handlePaymentIntentPaymentFailed(
  pi: Stripe.PaymentIntent,
): Promise<WebhookHandleResult> {
  const job = await loadJobByMetadataJobId(pi.metadata?.jobId);
  if (!job) return { handled: false, reason: "job_not_found" };

  if (job.paymentStatus === "released" || job.paymentStatus === "paid") {
    return { handled: true, action: "already_finalized" };
  }
  if (job.stripePaymentIntentId && job.stripePaymentIntentId !== pi.id) {
    return { handled: false, reason: "pi_mismatch" };
  }

  await db
    .update(jobsTable)
    .set({
      paymentStatus: "failed",
      stripePaymentIntentId: pi.id,
      stripeChargeId: chargeIdFromPaymentIntent(pi),
    })
    .where(eq(jobsTable.id, job.id));
  await notifyPaymentFailed(job);
  await recordPaymentAudit({
    jobId: job.id,
    profileId: job.customerId,
    eventType: "payment_intent.payment_failed",
    status: "failed",
    amountCents: pi.amount ?? null,
    currency: pi.currency ?? "usd",
    stripePaymentIntentId: pi.id,
    stripeChargeId: chargeIdFromPaymentIntent(pi),
    message: pi.last_payment_error?.message ?? "Stripe payment intent failed.",
    metadataJson: safeMetadataJson(pi.metadata),
  });
  return { handled: true, action: "marked_failed" };
}

export async function handleCheckoutSessionCompleted(
  session: Stripe.Checkout.Session,
  retrievePaymentIntent: (id: string) => Promise<Stripe.PaymentIntent>,
): Promise<WebhookHandleResult> {
  if (session.metadata?.kind !== "checkout") {
    return { handled: false, reason: "not_checkout_session" };
  }

  const job = await loadJobByMetadataJobId(session.metadata?.jobId);
  if (!job) return { handled: false, reason: "job_not_found" };

  if (job.paymentStatus === "released" || job.paymentStatus === "paid") {
    return { handled: true, action: "checkout_already_finalized" };
  }
  if (session.payment_status !== "paid") {
    return { handled: true, action: "checkout_unpaid_skipped" };
  }

  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id ?? null;

  let transferId: string | null = null;
  let chargeId: string | null = null;
  let receiptUrl: string | null = null;
  if (paymentIntentId) {
    const pi = await retrievePaymentIntent(paymentIntentId);
    transferId = transferIdFromPaymentIntent(pi);
    chargeId = chargeIdFromPaymentIntent(pi);
    receiptUrl = receiptUrlFromPaymentIntent(pi);
  }

  await markJobReleased(job.id, paymentIntentId, transferId, chargeId, receiptUrl);
  return { handled: true, action: "checkout_session_finalized" };
}

export async function handleAccountUpdated(account: Stripe.Account): Promise<WebhookHandleResult> {
  const profileIdRaw = account.metadata?.profileId;
  if (profileIdRaw) {
    const profileId = parseInt(profileIdRaw, 10);
    if (Number.isFinite(profileId)) {
      await syncStripeStatus(account.id, profileId);
      return { handled: true, action: "payout_status_synced" };
    }
  }

  const [row] = await db
    .select()
    .from(payoutAccountsTable)
    .where(eq(payoutAccountsTable.stripeAccountId, account.id));
  if (!row) return { handled: false, reason: "payout_account_not_found" };

  await syncStripeStatus(account.id, row.profileId);
  return { handled: true, action: "payout_status_synced" };
}

export async function handleChargeRefunded(charge: Stripe.Charge): Promise<WebhookHandleResult> {
  const paymentIntentId = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id ?? null;
  const job = await loadJobByMetadataJobId(charge.metadata?.jobId) ?? await loadJobByPaymentIntentId(paymentIntentId);
  if (!job) return { handled: false, reason: "job_not_found" };

  const latestRefund = typeof charge.refunds?.data?.[0]?.id === "string" ? charge.refunds.data[0] : null;
  const isFullRefund = typeof charge.amount === "number"
    && typeof charge.amount_refunded === "number"
    && charge.amount_refunded >= charge.amount;
  const now = new Date();

  await db.update(jobsTable)
    .set({
      paymentStatus: isFullRefund ? "refunded" : "partially_refunded",
      refundStatus: isFullRefund ? "succeeded" : "partial",
      stripePaymentIntentId: paymentIntentId,
      stripeChargeId: charge.id,
      stripeRefundId: latestRefund?.id ?? job.stripeRefundId,
      refundedAt: isFullRefund ? now : job.refundedAt,
    })
    .where(eq(jobsTable.id, job.id));

  await recordPaymentAudit({
    jobId: job.id,
    profileId: job.customerId,
    eventType: "charge.refunded",
    status: isFullRefund ? "refunded" : "partially_refunded",
    amountCents: charge.amount_refunded ?? null,
    currency: charge.currency ?? "usd",
    stripePaymentIntentId: paymentIntentId,
    stripeChargeId: charge.id,
    stripeRefundId: latestRefund?.id ?? null,
    message: isFullRefund ? "Charge fully refunded." : "Charge partially refunded.",
    metadataJson: safeMetadataJson(charge.metadata),
  });

  return { handled: true, action: isFullRefund ? "marked_refunded" : "marked_partially_refunded" };
}

export async function handleInvoicePaid(invoice: Stripe.Invoice): Promise<WebhookHandleResult> {
  const paymentIntent = (invoice as any).payment_intent;
  const paymentIntentId = typeof paymentIntent === "string" ? paymentIntent : paymentIntent?.id ?? null;
  const job = await loadJobByMetadataJobId(invoice.metadata?.jobId) ?? await loadJobByPaymentIntentId(paymentIntentId);
  if (!job) return { handled: false, reason: "job_not_found" };

  await db.update(jobsTable)
    .set({
      paymentStatus: "paid",
      paidAt: new Date(),
      stripeInvoiceId: invoice.id,
      ...(paymentIntentId ? { stripePaymentIntentId: paymentIntentId } : {}),
    })
    .where(eq(jobsTable.id, job.id));

  await recordPaymentAudit({
    jobId: job.id,
    profileId: job.customerId,
    eventType: "invoice.paid",
    status: "paid",
    amountCents: invoice.amount_paid ?? null,
    currency: invoice.currency ?? "usd",
    stripeInvoiceId: invoice.id,
    stripePaymentIntentId: paymentIntentId,
    message: "Stripe invoice paid.",
    metadataJson: safeMetadataJson(invoice.metadata),
  });

  return { handled: true, action: "invoice_marked_paid" };
}

export async function handleInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<WebhookHandleResult> {
  const paymentIntent = (invoice as any).payment_intent;
  const paymentIntentId = typeof paymentIntent === "string" ? paymentIntent : paymentIntent?.id ?? null;
  const job = await loadJobByMetadataJobId(invoice.metadata?.jobId) ?? await loadJobByPaymentIntentId(paymentIntentId);
  if (!job) return { handled: false, reason: "job_not_found" };

  await db.update(jobsTable)
    .set({
      paymentStatus: "failed",
      stripeInvoiceId: invoice.id,
      ...(paymentIntentId ? { stripePaymentIntentId: paymentIntentId } : {}),
    })
    .where(eq(jobsTable.id, job.id));
  await notifyPaymentFailed(job);

  await recordPaymentAudit({
    jobId: job.id,
    profileId: job.customerId,
    eventType: "invoice.payment_failed",
    status: "failed",
    amountCents: invoice.amount_due ?? null,
    currency: invoice.currency ?? "usd",
    stripeInvoiceId: invoice.id,
    stripePaymentIntentId: paymentIntentId,
    message: "Stripe invoice payment failed.",
    metadataJson: safeMetadataJson(invoice.metadata),
  });

  return { handled: true, action: "invoice_marked_failed" };
}

export async function handlePayoutStatus(
  payout: Stripe.Payout,
  stripeAccountId: string | null | undefined,
  status: "paid" | "failed",
): Promise<WebhookHandleResult> {
  if (!stripeAccountId) return { handled: false, reason: "connected_account_missing" };

  const [account] = await db.select().from(payoutAccountsTable).where(eq(payoutAccountsTable.stripeAccountId, stripeAccountId));
  if (!account) return { handled: false, reason: "payout_account_not_found" };

  await db.update(payoutAccountsTable)
    .set({
      lastStripePayoutId: payout.id,
      lastPayoutStatus: status,
      lastStripeSyncAt: new Date(),
    })
    .where(eq(payoutAccountsTable.id, account.id));

  const jobIdRaw = payout.metadata?.jobId;
  const jobId = jobIdRaw ? Number.parseInt(jobIdRaw, 10) : NaN;
  if (Number.isFinite(jobId)) {
    await db.update(jobsTable)
      .set({
        stripePayoutId: payout.id,
        payoutStatus: status,
      })
      .where(eq(jobsTable.id, jobId));
  }

  await recordPaymentAudit({
    profileId: account.profileId,
    jobId: Number.isFinite(jobId) ? jobId : null,
    eventType: `payout.${status}`,
    status,
    amountCents: payout.amount ?? null,
    currency: payout.currency ?? "usd",
    stripePayoutId: payout.id,
    message: status === "paid" ? "Stripe payout paid." : "Stripe payout failed.",
    metadataJson: safeMetadataJson(payout.metadata),
  });

  return { handled: true, action: status === "paid" ? "payout_marked_paid" : "payout_marked_failed" };
}

export async function handleStripeEvent(event: Stripe.Event): Promise<WebhookHandleResult> {
  switch (event.type) {
    case "payment_intent.succeeded":
      return handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
    case "payment_intent.payment_failed":
      return handlePaymentIntentPaymentFailed(event.data.object as Stripe.PaymentIntent);
    case "checkout.session.completed":
      return handleCheckoutSessionCompleted(
        event.data.object as Stripe.Checkout.Session,
        async (id) => {
          const { getUncachableStripeClient } = await import("./stripeClient");
          const stripe = await getUncachableStripeClient();
          return stripe.paymentIntents.retrieve(id, { expand: ["latest_charge"] }) as Promise<Stripe.PaymentIntent>;
        },
      );
    case "account.updated":
      return handleAccountUpdated(event.data.object as Stripe.Account);
    case "charge.refunded":
      return handleChargeRefunded(event.data.object as Stripe.Charge);
    case "invoice.paid":
      return handleInvoicePaid(event.data.object as Stripe.Invoice);
    case "invoice.payment_failed":
      return handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
    case "payout.paid":
      return handlePayoutStatus(event.data.object as Stripe.Payout, event.account, "paid");
    case "payout.failed":
      return handlePayoutStatus(event.data.object as Stripe.Payout, event.account, "failed");
    default:
      return { handled: false, reason: "ignored_event_type" };
  }
}

export async function processStripeWebhookEvent(event: Stripe.Event): Promise<WebhookHandleResult> {
  const started = await beginWebhookEvent(event);
  if (started === "duplicate") {
    return { handled: true, action: "duplicate_event" };
  }

  try {
    const result = await handleStripeEvent(event);
    await finishWebhookEvent(
      event.id,
      result.handled ? "succeeded" : "ignored",
      result.handled ? result.action : result.reason,
    );
    return result;
  } catch (err: any) {
    await finishWebhookEvent(event.id, "failed", "handler_failed", err?.message ?? "Webhook handler failed");
    throw err;
  }
}
