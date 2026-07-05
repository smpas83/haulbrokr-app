import type Stripe from "stripe";
import { eq } from "drizzle-orm";
import { db, jobsTable, payoutAccountsTable, activityTable } from "@workspace/db";
import { checkProviderPayoutReadiness, syncStripeStatus } from "./payoutStatus";
import { settleConfirmedPayout } from "./payoutRetry";
import { handleChargeRefunded, upsertRefundFromStripe } from "./refunds";
import { logger } from "./logger";

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
): Promise<void> {
  const now = new Date();
  await db
    .update(jobsTable)
    .set({
      paymentStatus: "released",
      paidAt: now,
      releasedAt: now,
      stripePaymentIntentId: paymentIntentId,
      ...(transferId ? { stripeTransferId: transferId } : {}),
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
  await markJobReleased(job.id, pi.id, transferIdFromPaymentIntent(pi));
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
    await markJobReleased(job.id, pi.id, job.stripeTransferId);
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

  if (pi.metadata?.kind === "checkout") {
    return finalizeCheckoutFromPaymentIntent(job, pi);
  }
  return finalizeChargeTransferFromPaymentIntent(job, pi);
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
    })
    .where(eq(jobsTable.id, job.id));
  await notifyPaymentFailed(job);
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
  if (paymentIntentId) {
    const pi = await retrievePaymentIntent(paymentIntentId);
    transferId = transferIdFromPaymentIntent(pi);
  }

  await markJobReleased(job.id, paymentIntentId, transferId);
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

export async function handleRefundEvent(refund: Stripe.Refund): Promise<WebhookHandleResult> {
  const record = await upsertRefundFromStripe(refund);
  if (!record) return { handled: false, reason: "refund_job_not_found" };
  return { handled: true, action: `refund_${record.status}` };
}

export async function handleChargeRefundedEvent(charge: Stripe.Charge): Promise<WebhookHandleResult> {
  const { jobId } = await handleChargeRefunded(charge);
  if (!jobId) return { handled: false, reason: "charge_job_not_found" };
  return { handled: true, action: "charge_refunded_synced" };
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
      return handleChargeRefundedEvent(event.data.object as Stripe.Charge);
    case "refund.created":
    case "refund.updated":
      return handleRefundEvent(event.data.object as Stripe.Refund);
    default:
      return { handled: false, reason: "ignored_event_type" };
  }
}
