import { eq, and, isNotNull, inArray } from "drizzle-orm";
import { db, jobsTable, profilesTable, activityTable } from "@workspace/db";
import { getUncachableStripeClient } from "./stripeClient";
import { getUncachableResendClient } from "./resendClient";
import { checkProviderPayoutReadiness } from "./payoutStatus";
import { logger } from "./logger";
import { chargeIdFromPaymentIntent } from "./stripePayments";

/**
 * Number of CONSECUTIVE transfer-leg failures (across sweeps) a stuck payout may
 * accumulate before we proactively alert admins. With the 5-minute sweep this is
 * ~15 minutes of repeated failure — long enough to rule out a transient blip,
 * short enough that money isn't silently stuck for hours.
 */
export const ALERT_AFTER_FAILURES = 3;

/**
 * Release the provider's net payout for a job whose customer charge has ALREADY
 * succeeded (PaymentIntent `succeeded`). This moves money ONLY via a transfer —
 * it never creates a new PaymentIntent, so the customer is never re-charged.
 *
 * The transfer reuses the SAME per-attempt idempotency key
 * (`job-transfer:<id>:<attempt>`, attempt = the job's existing paymentAttempts)
 * that the original on-session confirmation would have used, so Stripe dedupes:
 * retrying a transfer that actually went through is a no-op, never a double pay.
 * Throws if the transfer or the DB write fails — callers decide how to surface it.
 */
export async function settleConfirmedPayout(
  job: { id: number; providerNetAmount: string; paymentAttempts?: number | null },
  stripeAccountId: string,
  pi: { id: string; latest_charge?: string | { id: string } | null },
) {
  const stripe = await getUncachableStripeClient();
  const netCents = Math.round(parseFloat(job.providerNetAmount) * 100);
  const chargeId = chargeIdFromPaymentIntent(pi as any);
  if (!chargeId) {
    throw new Error("Stripe PaymentIntent has no charge to transfer from.");
  }
  // The attempt is UNCHANGED — this is the same logical settlement, only the
  // transfer leg is being (re)tried. Bumping it would change the idempotency key
  // and defeat Stripe's dedupe protection against a double transfer.
  const attempt = job.paymentAttempts ?? 0;

  const transfer = await stripe.transfers.create(
    {
      amount: netCents,
      currency: "usd",
      destination: stripeAccountId,
      source_transaction: chargeId,
      description: `HaulBrokr payout for job #${job.id} (net of marketplace fees)`,
      metadata: { jobId: String(job.id), attempt: String(attempt) },
    },
    { idempotencyKey: `job-transfer:${job.id}:${attempt}` },
  );

  const now = new Date();
  const [updated] = await db
    .update(jobsTable)
    .set({
      paymentStatus: "released",
      paidAt: now,
      releasedAt: now,
      stripePaymentIntentId: pi.id,
      stripeChargeId: chargeId,
      stripeTransferId: transfer.id,
      payoutStatus: "paid",
      // A successful release clears any stuck-payout failure tracking so a later
      // (unrelated) hiccup starts counting fresh and never carries a stale alert.
      payoutRetryFailures: 0,
      payoutAlertSentAt: null,
    })
    .where(eq(jobsTable.id, job.id))
    .returning();
  return updated;
}

/** Clerk user ids configured as admins (the same allowlist used to gate /admin). */
function adminClerkIds(): string[] {
  return (process.env.ADMIN_USER_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Email every admin (that has an address on file) that a provider payout keeps
 * failing to retry. This is the off-app escalation companion to the in-app
 * activity alert: it reaches admins who aren't logged in. Best-effort — if
 * Resend isn't connected, no admin has an email, or sending errors, we log and
 * return without throwing so the sweep is never broken by a mail failure.
 *
 * Fired from the SAME `payoutAlertSentAt` gate as the in-app alert, so an admin
 * is emailed exactly once per stuck job (no duplicates across sweeps).
 */
async function emailAdminsOfStuckPayout(
  job: { id: number },
  admins: Array<{ email?: string | null; companyName?: string | null }>,
  providerName: string,
  failures: number,
  reason: string,
): Promise<void> {
  const recipients = admins
    .map((a) => a.email?.trim())
    .filter((e): e is string => !!e);
  if (recipients.length === 0) {
    logger.warn(
      { jobId: job.id },
      "Stuck payout crossed the alert threshold but no admin profiles have an email on file to escalate to",
    );
    return;
  }
  try {
    const { client, fromEmail } = await getUncachableResendClient();
    const subject = `[HaulBrokr] Payout stuck for job #${job.id} — ${failures} failed retries`;
    const text =
      `A provider payout keeps failing to retry and needs attention.\n\n` +
      `Job: #${job.id}\n` +
      `Provider: ${providerName}\n` +
      `Consecutive failed retries: ${failures}\n` +
      `Latest error: ${reason}\n\n` +
      `The customer charge already succeeded; only the provider transfer is failing, ` +
      `so no one has been re-charged. Open the admin Payouts tab to investigate.`;
    const html =
      `<p>A provider payout keeps failing to retry and needs attention.</p>` +
      `<ul>` +
      `<li><strong>Job:</strong> #${job.id}</li>` +
      `<li><strong>Provider:</strong> ${providerName}</li>` +
      `<li><strong>Consecutive failed retries:</strong> ${failures}</li>` +
      `<li><strong>Latest error:</strong> ${reason}</li>` +
      `</ul>` +
      `<p>The customer charge already succeeded; only the provider transfer is failing, ` +
      `so no one has been re-charged. Open the admin Payouts tab to investigate.</p>`;
    const { error } = await client.emails.send({
      from: fromEmail,
      to: recipients,
      subject,
      text,
      html,
    });
    if (error) {
      logger.error({ jobId: job.id, error }, "Resend rejected the stuck-payout admin email");
      return;
    }
    logger.info(
      { jobId: job.id, recipients: recipients.length, failures },
      "Emailed admins about a stuck payout",
    );
  } catch (err) {
    logger.error({ err, jobId: job.id }, "Failed to email admins about a stuck payout");
  }
}

/**
 * Create an in-app notification for every configured admin telling them a
 * provider payout keeps failing to retry. Reuses the activity-feed pattern from
 * the admin routes (one activity row per recipient profile). Best-effort: an
 * alert failure must never break the sweep, so all errors are swallowed/logged.
 *
 * Admins are configured as Clerk user ids (ADMIN_USER_IDS); we resolve those to
 * profile ids so the alert shows up in their dashboard activity feed. If no
 * admins are configured/resolvable (e.g. local dev), we log and move on.
 */
async function notifyAdminsOfStuckPayout(
  job: { id: number; providerId: number; materialType?: string | null },
  failures: number,
  reason: string,
): Promise<void> {
  try {
    const clerkIds = adminClerkIds();
    if (clerkIds.length === 0) {
      logger.warn(
        { jobId: job.id },
        "Stuck payout crossed the alert threshold but no ADMIN_USER_IDS are configured to notify",
      );
      return;
    }
    const admins = await db
      .select()
      .from(profilesTable)
      .where(inArray(profilesTable.clerkId, clerkIds));
    if (admins.length === 0) {
      logger.warn(
        { jobId: job.id },
        "Stuck payout crossed the alert threshold but no admin profiles match ADMIN_USER_IDS",
      );
      return;
    }
    const [provider] = await db
      .select()
      .from(profilesTable)
      .where(eq(profilesTable.id, job.providerId));
    const providerName = provider?.companyName ?? `provider #${job.providerId}`;
    const material = job.materialType ? `${job.materialType} ` : "";
    const description =
      `Payout stuck for job #${job.id} — ${providerName}'s ${material}payout transfer has failed ` +
      `${failures} times in a row. Latest error: ${reason}`;
    await db.insert(activityTable).values(
      admins.map((a) => ({
        profileId: a.id,
        type: "payout_stuck_alert" as const,
        description,
        relatedId: job.id,
      })),
    );
    logger.info({ jobId: job.id, admins: admins.length, failures }, "Alerted admins to a stuck payout");
    // Off-app escalation: also email admins so the alert reaches anyone who
    // isn't logged in. Fired under the same gate as the in-app alert, so it's
    // sent at most once per stuck job. Best-effort — never breaks the sweep.
    await emailAdminsOfStuckPayout(job, admins, providerName, failures, reason);
  } catch (err) {
    logger.error({ err, jobId: job.id }, "Failed to record stuck-payout admin alert");
  }
}

/**
 * Record one more consecutive transfer-leg failure for a stuck payout and, once
 * the count crosses {@link ALERT_AFTER_FAILURES}, alert admins exactly once.
 *
 * This ONLY touches the failure-tracking columns — never `paymentStatus` — so it
 * preserves the invariant that a stuck job stays in `requires_action` (never
 * routed back through /charge). Best-effort: it never throws, keeping
 * `retryStuckPayout`'s never-throw contract intact.
 */
async function recordPayoutTransferFailure(
  job: { id: number; providerId: number; materialType?: string | null; payoutRetryFailures?: number | null; payoutAlertSentAt?: Date | null },
  reason: string,
): Promise<void> {
  try {
    const failures = (job.payoutRetryFailures ?? 0) + 1;
    const alreadyAlerted = job.payoutAlertSentAt != null;
    const shouldAlert = failures >= ALERT_AFTER_FAILURES && !alreadyAlerted;
    await db
      .update(jobsTable)
      .set({
        payoutRetryFailures: failures,
        ...(shouldAlert ? { payoutAlertSentAt: new Date() } : {}),
      })
      .where(eq(jobsTable.id, job.id));
    if (shouldAlert) {
      await notifyAdminsOfStuckPayout(job, failures, reason);
    }
  } catch (err) {
    logger.error({ err, jobId: job.id }, "Failed to record stuck-payout failure count");
  }
}

export type RetryOutcome = "released" | "skipped" | "failed";

export interface RetryResult {
  jobId: number;
  outcome: RetryOutcome;
  /** Human-readable explanation, suitable for an admin to read. */
  message: string;
}

/**
 * Attempt to release ONE stuck provider payout without involving the customer.
 *
 * A job is "stuck" when it sits in `requires_action` with a PaymentIntent that
 * already succeeded: the customer's money was captured but the provider transfer
 * never completed (e.g. a transient Stripe error during /confirm-payment). The
 * customer has no reason to come back, so this retries the transfer leg alone.
 *
 * Never throws — every path returns a {@link RetryResult} so a sweep can report
 * each job's fate. `skipped` means "not actually ready/eligible right now"
 * (PaymentIntent not yet succeeded, provider payouts disabled); `failed` means
 * the transfer was attempted and errored (logged for an admin to chase).
 */
export async function retryStuckPayout(job: any): Promise<RetryResult> {
  const jobId = job.id as number;

  if (job.paymentStatus !== "requires_action" || !job.stripePaymentIntentId) {
    return { jobId, outcome: "skipped", message: "Job is not awaiting a payout release." };
  }
  if (job.providerNetAmount == null) {
    return { jobId, outcome: "skipped", message: "Job has no computed payout amount." };
  }

  try {
    const stripe = await getUncachableStripeClient();
    const pi = await stripe.paymentIntents.retrieve(job.stripePaymentIntentId);
    if (pi.status !== "succeeded") {
      // The charge hasn't completed (still needs the customer to authenticate) —
      // there is nothing safe to release yet, so leave it untouched.
      return { jobId, outcome: "skipped", message: "Customer charge has not succeeded yet." };
    }

    const readiness = await checkProviderPayoutReadiness(job.providerId);
    if (!readiness.ok) {
      return { jobId, outcome: "skipped", message: readiness.message };
    }

    await settleConfirmedPayout(job, readiness.stripeAccountId, pi as any);
    logger.info({ jobId }, "Auto-released stuck provider payout");
    return { jobId, outcome: "released", message: "Provider payout released." };
  } catch (err: any) {
    // The charge already succeeded; only the transfer failed. We deliberately
    // leave the job in `requires_action` (never `failed`) so it is never routed
    // back through /charge and re-billed — the next sweep just tries the
    // transfer again under the same idempotency key.
    logger.error({ err, jobId }, "Failed to auto-release stuck provider payout");
    const message = err?.message ?? "Releasing the provider payout failed.";
    // Count this consecutive failure and, once it crosses the threshold, alert
    // admins once so a silently-failing payout can't slip past the sweep forever.
    await recordPayoutTransferFailure(job, message);
    return { jobId, outcome: "failed", message };
  }
}

/**
 * Find every job whose provider payout is stuck: parked in `requires_action`
 * with a PaymentIntent on file. (Whether that intent has actually succeeded is
 * confirmed per-job at retry time against live Stripe.)
 */
export async function findStuckPayoutJobs() {
  return db
    .select()
    .from(jobsTable)
    .where(and(eq(jobsTable.paymentStatus, "requires_action"), isNotNull(jobsTable.stripePaymentIntentId)));
}

/**
 * Sweep all stuck provider payouts and retry each transfer. Returns a result per
 * job so the caller (scheduler or admin trigger) can log/surface the outcome.
 */
export async function sweepStuckPayouts(): Promise<RetryResult[]> {
  const jobs = await findStuckPayoutJobs();
  if (jobs.length === 0) return [];

  const results: RetryResult[] = [];
  for (const job of jobs) {
    results.push(await retryStuckPayout(job));
  }

  const released = results.filter((r) => r.outcome === "released").length;
  const failed = results.filter((r) => r.outcome === "failed").length;
  const skipped = results.filter((r) => r.outcome === "skipped").length;
  logger.info({ total: results.length, released, failed, skipped }, "Stuck-payout sweep complete");
  return results;
}
