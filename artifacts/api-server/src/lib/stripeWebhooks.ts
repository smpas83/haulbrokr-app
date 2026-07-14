import type Stripe from "stripe";
import { eq } from "drizzle-orm";
import {
  db,
  jobsTable,
  payoutAccountsTable,
  stripeWebhookEventsTable,
} from "@workspace/db";
import { checkProviderPayoutReadiness, syncStripeStatus } from "./payoutStatus";
import { settleConfirmedPayout } from "./payoutRetry";
import { handleChargeRefunded, upsertRefundFromStripe } from "./refunds";
import { notifyUser } from "./notificationPlatform";
import { logger } from "./logger";

export type WebhookHandleResult =
  | { handled: true; action: string }
  | { handled: false; reason: string };

async function notifyPaymentFailed(job: {
  id: number;
  customerId: number;
  materialType: string;
}): Promise<void> {
  await notifyUser({
    profileId: job.customerId,
    type: "payment_failed",
    topic: "payment",
    title: "Payment failed",
    description: `Payment failed for job #${job.id} — ${job.materialType} delivery. Open the job to retry.`,
    relatedId: job.id,
  });
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
  if (transfer && typeof transfer === "object" && "id" in transfer)
    return transfer.id;
  return null;
}

async function loadJobByMetadataJobId(
  jobIdRaw: string | undefined,
): Promise<typeof jobsTable.$inferSelect | null> {
  if (!jobIdRaw) return null;
  const jobId = parseInt(jobIdRaw, 10);
  if (!Number.isFinite(jobId)) return null;
  const [job] = await db
    .select()
    .from(jobsTable)
    .where(eq(jobsTable.id, jobId));
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
    {
      id: job.id,
      providerNetAmount: job.providerNetAmount,
      paymentAttempts: job.paymentAttempts,
    },
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
      : (session.payment_intent?.id ?? null);

  let transferId: string | null = null;
  if (paymentIntentId) {
    const pi = await retrievePaymentIntent(paymentIntentId);
    transferId = transferIdFromPaymentIntent(pi);
  }

  await markJobReleased(job.id, paymentIntentId, transferId);
  return { handled: true, action: "checkout_session_finalized" };
}

export async function handleAccountUpdated(
  account: Stripe.Account,
): Promise<WebhookHandleResult> {
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

export async function handleRefundEvent(
  refund: Stripe.Refund,
): Promise<WebhookHandleResult> {
  const record = await upsertRefundFromStripe(refund);
  if (!record) return { handled: false, reason: "refund_job_not_found" };
  return { handled: true, action: `refund_${record.status}` };
}

export async function handleChargeRefundedEvent(
  charge: Stripe.Charge,
): Promise<WebhookHandleResult> {
  const { jobId } = await handleChargeRefunded(charge);
  if (!jobId) return { handled: false, reason: "charge_job_not_found" };
  return { handled: true, action: "charge_refunded_synced" };
}

/**
 * Mark a net-terms / Stripe Invoice job paid when Stripe fires invoice.paid.
 * Expects metadata.jobId on the invoice (or its parent subscription metadata).
 */
export async function handleInvoicePaid(
  invoice: Stripe.Invoice,
): Promise<WebhookHandleResult> {
  const jobIdRaw =
    invoice.metadata?.jobId ??
    (typeof invoice.parent === "object" &&
    invoice.parent &&
    "subscription_details" in invoice.parent
      ? (
          invoice.parent as {
            subscription_details?: { metadata?: { jobId?: string } };
          }
        ).subscription_details?.metadata?.jobId
      : undefined);

  const job = await loadJobByMetadataJobId(jobIdRaw);
  if (!job) {
    // Also accept invoices whose payment_intent metadata carries jobId after retrieval.
    return { handled: false, reason: "invoice_job_not_found" };
  }

  if (job.paymentStatus === "released" || job.paymentStatus === "paid") {
    return { handled: true, action: "invoice_already_paid" };
  }

  const paymentIntentRaw = (
    invoice as unknown as { payment_intent?: string | { id: string } | null }
  ).payment_intent;
  const paymentIntentId =
    typeof paymentIntentRaw === "string"
      ? paymentIntentRaw
      : paymentIntentRaw && typeof paymentIntentRaw === "object"
        ? paymentIntentRaw.id
        : null;

  const now = new Date();
  await db
    .update(jobsTable)
    .set({
      paymentStatus: "paid",
      paidAt: now,
      stripePaymentIntentId: paymentIntentId ?? job.stripePaymentIntentId,
    })
    .where(eq(jobsTable.id, job.id));

  const amountPaid = ((invoice.amount_paid ?? 0) / 100).toFixed(2);
  await notifyUser({
    profileId: job.customerId,
    type: "invoice_paid",
    topic: "payment",
    title: "Invoice paid",
    description: `Invoice paid for job #${job.id} — $${amountPaid}.`,
    relatedId: job.id,
  });
  await notifyUser({
    profileId: job.providerId,
    type: "invoice_paid",
    topic: "payment",
    title: "Customer invoice paid",
    description: `Customer paid the invoice for job #${job.id} — $${amountPaid}.`,
    relatedId: job.id,
  });

  return { handled: true, action: "invoice_marked_paid" };
}

async function loadPayoutAccountByStripeAccount(
  stripeAccountId: string | null | undefined,
): Promise<typeof payoutAccountsTable.$inferSelect | null> {
  if (!stripeAccountId) return null;
  const [row] = await db
    .select()
    .from(payoutAccountsTable)
    .where(eq(payoutAccountsTable.stripeAccountId, stripeAccountId));
  return row ?? null;
}

function payoutAmountDollars(payout: Stripe.Payout): string {
  return ((payout.amount ?? 0) / 100).toFixed(2);
}

export async function handlePayoutEvent(
  payout: Stripe.Payout,
  eventType: string,
  stripeAccountId?: string | null,
): Promise<WebhookHandleResult> {
  let account = stripeAccountId
    ? await loadPayoutAccountByStripeAccount(stripeAccountId)
    : null;

  if (!account) {
    const [byPayout] = await db
      .select()
      .from(payoutAccountsTable)
      .where(eq(payoutAccountsTable.lastPayoutId, payout.id));
    account = byPayout ?? null;
  }
  if (!account) return { handled: false, reason: "payout_account_not_found" };

  const status = payout.status;
  const failed =
    eventType === "payout.failed" ||
    status === "failed" ||
    status === "canceled";
  await db
    .update(payoutAccountsTable)
    .set({
      lastPayoutId: payout.id,
      lastPayoutStatus: status,
      lastPayoutAmount: payoutAmountDollars(payout),
      lastPayoutAt: new Date((payout.arrival_date || payout.created) * 1000),
      lastPayoutFailureCode: failed ? (payout.failure_code ?? status) : null,
      lastPayoutFailureMessage: failed
        ? (payout.failure_message ?? `Payout ${status}`)
        : null,
    })
    .where(eq(payoutAccountsTable.id, account.id));

  if (failed) {
    await notifyUser({
      profileId: account.profileId,
      type: "payout_failed",
      topic: "payment",
      title: "Payout failed",
      description:
        payout.failure_message ??
        `Your bank payout of $${payoutAmountDollars(payout)} ${status}. Update your bank details in Account.`,
      relatedId: null,
    });
    return { handled: true, action: `payout_${status}` };
  }

  if (eventType === "payout.paid" || status === "paid") {
    await notifyUser({
      profileId: account.profileId,
      type: "payout_paid",
      topic: "payment",
      title: "Payout sent",
      description: `$${payoutAmountDollars(payout)} was sent to your bank account.`,
      relatedId: null,
    });
    return { handled: true, action: "payout_paid" };
  }

  return { handled: true, action: `payout_${status}` };
}

export async function handleTransferEvent(
  transfer: Stripe.Transfer,
  eventType: string,
): Promise<WebhookHandleResult> {
  const jobIdRaw = transfer.metadata?.jobId;
  const job = await loadJobByMetadataJobId(jobIdRaw);
  if (!job) {
    // Try matching by stripe_transfer_id
    const [byTransfer] = await db
      .select()
      .from(jobsTable)
      .where(eq(jobsTable.stripeTransferId, transfer.id));
    if (!byTransfer)
      return { handled: false, reason: "transfer_job_not_found" };

    if (eventType === "transfer.failed" || eventType === "transfer.reversed") {
      await notifyUser({
        profileId: byTransfer.providerId,
        type: "payout_failed",
        topic: "payment",
        title: "Transfer failed",
        description: `Payout transfer for job #${byTransfer.id} ${eventType.replace("transfer.", "")}.`,
        relatedId: byTransfer.id,
      });
      return { handled: true, action: eventType.replace(".", "_") };
    }
    return { handled: true, action: "transfer_noted" };
  }

  if (eventType === "transfer.created" || eventType === "transfer.paid") {
    if (!job.stripeTransferId) {
      await db
        .update(jobsTable)
        .set({ stripeTransferId: transfer.id })
        .where(eq(jobsTable.id, job.id));
    }
    return { handled: true, action: eventType.replace(".", "_") };
  }

  if (eventType === "transfer.failed" || eventType === "transfer.reversed") {
    await notifyUser({
      profileId: job.providerId,
      type: "payout_failed",
      topic: "payment",
      title: "Transfer failed",
      description: `Payout transfer for job #${job.id} ${eventType.replace("transfer.", "")}.`,
      relatedId: job.id,
    });
    return { handled: true, action: eventType.replace(".", "_") };
  }

  return { handled: true, action: "transfer_noted" };
}

async function claimWebhookEvent(
  event: Stripe.Event,
): Promise<"new" | "duplicate"> {
  const [existing] = await db
    .select()
    .from(stripeWebhookEventsTable)
    .where(eq(stripeWebhookEventsTable.stripeEventId, event.id));
  if (existing) return "duplicate";

  try {
    await db.insert(stripeWebhookEventsTable).values({
      stripeEventId: event.id,
      eventType: event.type,
      handled: false,
    });
    return "new";
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (
      message.includes("unique") ||
      message.includes("duplicate") ||
      message.includes("stripe_event_id")
    ) {
      return "duplicate";
    }
    throw err;
  }
}

async function finalizeWebhookEvent(
  eventId: string,
  result: WebhookHandleResult,
): Promise<void> {
  await db
    .update(stripeWebhookEventsTable)
    .set({
      handled: result.handled,
      action: result.handled ? result.action : null,
      reason: result.handled ? null : result.reason,
    })
    .where(eq(stripeWebhookEventsTable.stripeEventId, eventId));
}

export async function handleStripeEvent(
  event: Stripe.Event,
): Promise<WebhookHandleResult> {
  const claim = await claimWebhookEvent(event);
  if (claim === "duplicate") {
    return { handled: true, action: "duplicate_event" };
  }

  let result: WebhookHandleResult;
  try {
    switch (event.type) {
      case "payment_intent.succeeded":
        result = await handlePaymentIntentSucceeded(
          event.data.object as Stripe.PaymentIntent,
        );
        break;
      case "payment_intent.payment_failed":
        result = await handlePaymentIntentPaymentFailed(
          event.data.object as Stripe.PaymentIntent,
        );
        break;
      case "checkout.session.completed":
        result = await handleCheckoutSessionCompleted(
          event.data.object as Stripe.Checkout.Session,
          async (id) => {
            const { getUncachableStripeClient } =
              await import("./stripeClient");
            const stripe = await getUncachableStripeClient();
            return stripe.paymentIntents.retrieve(id, {
              expand: ["latest_charge"],
            }) as Promise<Stripe.PaymentIntent>;
          },
        );
        break;
      case "invoice.paid":
        result = await handleInvoicePaid(event.data.object as Stripe.Invoice);
        break;
      case "account.updated":
        result = await handleAccountUpdated(
          event.data.object as Stripe.Account,
        );
        break;
      case "charge.refunded":
        result = await handleChargeRefundedEvent(
          event.data.object as Stripe.Charge,
        );
        break;
      case "refund.created":
      case "refund.updated":
        result = await handleRefundEvent(event.data.object as Stripe.Refund);
        break;
      case "payout.paid":
      case "payout.failed":
      case "payout.canceled":
      case "payout.updated":
        result = await handlePayoutEvent(
          event.data.object as Stripe.Payout,
          event.type,
          (event as Stripe.Event & { account?: string }).account ?? null,
        );
        break;
      case "transfer.created":
      case "transfer.updated":
      case "transfer.reversed":
        result = await handleTransferEvent(
          event.data.object as Stripe.Transfer,
          event.type,
        );
        break;
      default: {
        // Stripe API versions vary on transfer.paid / transfer.failed naming.
        if (String(event.type).startsWith("transfer.")) {
          result = await handleTransferEvent(
            event.data.object as unknown as Stripe.Transfer,
            event.type,
          );
        } else {
          result = { handled: false, reason: "ignored_event_type" };
        }
      }
    }
  } catch (err) {
    logger.error(
      { err, eventId: event.id, eventType: event.type },
      "Stripe event handler threw",
    );
    await finalizeWebhookEvent(event.id, {
      handled: false,
      reason: "handler_error",
    });
    throw err;
  }

  await finalizeWebhookEvent(event.id, result);
  return result;
}
