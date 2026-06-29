import { Router, type IRouter } from "express";
import { eq, and, or, sql, inArray } from "drizzle-orm";
import {
  db,
  jobsTable,
  profilesTable,
  requestsTable,
  bidsTable,
  activityTable,
  paymentMethodsTable,
  creditApplicationsTable,
  ticketsTable,
  trucksTable,
  jobStatusUpdatesTable,
  driverDocumentsTable,
} from "@workspace/db";
import { getRequestProfile, requireProfile } from "../middlewares/requireAuth";
import { isAdmin } from "../middlewares/requireAdmin";
import { buildJobInvoicePdf, canDownloadJobInvoice, jobIsInvoiceEligible } from "../lib/jobInvoice";
import { getUncachableStripeClient, getStripePublishableKey } from "../lib/stripeClient";
import { checkProviderPayoutReadiness } from "../lib/payoutStatus";
import { settleConfirmedPayout } from "../lib/payoutRetry";
import { returnUrlBase, isAllowedReturnTo } from "../lib/returnUrl";
import { loadJobIfMember, isOrgManager, DRIVER_SIDE, CUSTOMER_SIDE, canReviewCompletion, orgScopedActorIds, isDriverAssignedToJob } from "../lib/access";
import { recordJobTimelineEvent } from "../lib/jobTimeline";
import {
  ListJobsQueryParams,
  ListJobsResponse,
  GetJobParams,
  GetJobResponse,
  UpdateJobParams,
  UpdateJobBody,
  UpdateJobResponse,
  ChargeJobParams,
  ChargeJobResponse,
  ReleaseJobPaymentParams,
  ReleaseJobPaymentResponse,
  GetJobPaymentConfirmationParams,
  GetJobPaymentConfirmationResponse,
  ConfirmJobPaymentParams,
  ConfirmJobPaymentResponse,
  CreateJobCheckoutSessionParams,
  CreateJobCheckoutSessionBody,
  CreateJobCheckoutSessionResponse,
  VerifyJobCheckoutParams,
  VerifyJobCheckoutBody,
  VerifyJobCheckoutResponse,
  AssignJobBody,
  CreateJobStatusUpdateBody,
  ListJobStatusUpdatesResponse,
  ApproveJobCompletionResponse,
  FlagJobCompletionBody,
  FlagJobCompletionResponse,
  AcceptJobParams,
  AcceptJobResponse,
  DeclineJobParams,
  DeclineJobResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

const DEFAULT_FEE_RATE = 0.15;

function num(v: string | null | undefined): number | null {
  return v == null ? null : parseFloat(v);
}

function serializeJob(j: any, customerCompany: string, providerCompany: string) {
  return {
    ...j,
    ratePerHour: parseFloat(j.ratePerHour),
    estimatedHours: parseFloat(j.estimatedHours),
    totalHours: num(j.totalHours),
    totalAmount: num(j.totalAmount),
    platformFeeRate: num(j.platformFeeRate),
    platformFeeAmount: num(j.platformFeeAmount),
    customerTotalAmount: num(j.customerTotalAmount),
    providerNetAmount: num(j.providerNetAmount),
    customerCompany,
    providerCompany,
  };
}

async function companiesFor(job: { customerId: number; providerId: number }) {
  const [customer] = await db.select().from(profilesTable).where(eq(profilesTable.id, job.customerId));
  const [provider] = await db.select().from(profilesTable).where(eq(profilesTable.id, job.providerId));
  return { customerCompany: customer?.companyName ?? "", providerCompany: provider?.companyName ?? "" };
}

/**
 * Notify the customer in-app when their job's payment moves to "failed" (a
 * declined charge or a failed payout release). The activity feeds the customer's
 * dashboard, and relatedId points at the job so the entry links straight to the
 * job's payment panel where they can retry. Best-effort: a notification failure
 * must never mask the underlying payment error, so callers don't await a throw.
 */
async function notifyPaymentFailed(job: { id: number; customerId: number; materialType: string }): Promise<void> {
  try {
    await db.insert(activityTable).values({
      profileId: job.customerId,
      type: "payment_failed",
      description: `Payment failed for job #${job.id} — ${job.materialType} delivery. Open the job to retry.`,
      relatedId: job.id,
    });
  } catch (err) {
    console.error("Failed to record payment_failed notification", err);
  }
}

/**
 * Tells the customer their card needs an extra confirmation step (bank
 * authentication / 3-D Secure) before the charge can complete. This is a
 * recoverable prompt — NOT a hard decline — so the copy reassures them their
 * card is fine and points them to confirm. Notification failures must never mask
 * the payment flow, so callers don't await a throw.
 */
async function notifyPaymentRequiresAction(job: { id: number; customerId: number; materialType: string }): Promise<void> {
  try {
    await db.insert(activityTable).values({
      profileId: job.customerId,
      type: "payment_requires_action",
      description: `Your bank needs you to confirm the payment for job #${job.id} — ${job.materialType} delivery. Open the job to verify your card.`,
      relatedId: job.id,
    });
  } catch (err) {
    console.error("Failed to record payment_requires_action notification", err);
  }
}

/**
 * Tells the PROVIDER their payout is on hold because their payout account isn't
 * ready (Stripe Connect not connected, or payouts/charges not yet enabled). A
 * customer tried to pay for a completed job but we can't transfer funds until the
 * provider finishes payout setup — so we proactively nudge them to fix it.
 * relatedId points at the job. Best-effort: never let a notification failure mask
 * the payment error returned to the customer.
 */
async function notifyPayoutDelayed(
  job: { id: number; providerId: number; materialType: string },
  reason: string,
): Promise<void> {
  try {
    await db.insert(activityTable).values({
      profileId: job.providerId,
      type: "payout_delayed",
      description: `Payout delayed for job #${job.id} — ${job.materialType} delivery. ${reason} Set up your payout account to get paid.`,
      relatedId: job.id,
    });
  } catch (err) {
    console.error("Failed to record payout_delayed notification", err);
  }
}

/**
 * Broker-fee model: the customer is billed the work value PLUS a 15% broker fee.
 * HaulBrokr deducts that 15% from the customer's gross payment BEFORE the
 * provider/driver is paid, so the driver receives the full work value (net) and
 * HaulBrokr retains the fee.
 *   base  = ratePerHour * hours   (work value → provider net)
 *   fee   = base * feeRate        (HaulBrokr's retained profit)
 *   gross = base + fee            (what the customer pays)
 */
export function computeBreakdown(ratePerHour: number, hours: number, feeRate: number) {
  const base = Math.round(ratePerHour * hours * 100) / 100;
  const fee = Math.round(base * feeRate * 100) / 100;
  const gross = Math.round((base + fee) * 100) / 100;
  return { base, fee, gross };
}

/**
 * Funds the provider's net payout via Stripe Connect using separate
 * charge + transfer: charge the customer the GROSS on the platform account,
 * then transfer ONLY the net to the provider's connected account. The 15%
 * broker fee therefore never leaves the platform — it is retained by design.
 */
interface CustomerInstrument {
  stripeCustomerId: string | null;
  stripePaymentMethodId: string | null;
  methodType: string;
}

async function settleProviderPayout(job: any, stripeAccountId: string, customer: CustomerInstrument, attempt: number) {
  const stripe = await getUncachableStripeClient();
  const grossCents = Math.round(parseFloat(job.customerTotalAmount) * 100);
  const netCents = Math.round(parseFloat(job.providerNetAmount) * 100);

  // Prefer the customer's REAL saved instrument: a Stripe Customer + PaymentMethod
  // captured via SetupIntent. We charge it off-session, so a genuinely declined
  // card actually declines and a switched card actually succeeds.
  const hasRealInstrument = !!customer.stripeCustomerId && !!customer.stripePaymentMethodId;

  let chargeParams: Record<string, unknown>;
  if (hasRealInstrument) {
    // Constrain the PaymentIntent to the saved instrument's rail so Stripe reuses
    // the off-session mandate established at setup (required for ACH debits) and
    // doesn't fall back to other method types.
    const isAch = customer.methodType === "ach";
    chargeParams = {
      amount: grossCents,
      currency: "usd",
      confirm: true,
      customer: customer.stripeCustomerId,
      payment_method: customer.stripePaymentMethodId,
      payment_method_types: isAch ? ["us_bank_account"] : ["card"],
      off_session: true,
      description: `HaulBrokr job #${job.id}`,
      metadata: { jobId: String(job.id), attempt: String(attempt) },
    };
  } else {
    // No real instrument on file. In production we refuse rather than silently
    // fake a charge; the customer must add a card (Stripe SetupIntent) first.
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "No saved payment method on file. The customer must add a card before this job can be charged.",
      );
    }
    // Dev/demo only: stand in with a Stripe TEST token matching the method type.
    const isAch = customer.methodType === "ach";
    chargeParams = {
      amount: grossCents,
      currency: "usd",
      confirm: true,
      payment_method: isAch ? "pm_usBankAccount_success" : "pm_card_visa",
      payment_method_types: isAch ? ["us_bank_account"] : ["card"],
      description: `HaulBrokr job #${job.id}`,
      metadata: { jobId: String(job.id), attempt: String(attempt) },
    };
  }

  const pi = await stripe.paymentIntents.create(
    chargeParams as any,
    { idempotencyKey: `job-charge:${job.id}:${attempt}` },
  );

  const chargeId = typeof pi.latest_charge === "string" ? pi.latest_charge : pi.latest_charge?.id;

  const transfer = await stripe.transfers.create(
    {
      amount: netCents,
      currency: "usd",
      destination: stripeAccountId,
      source_transaction: chargeId,
      description: `HaulBrokr payout for job #${job.id} (net of 15% broker fee)`,
      metadata: { jobId: String(job.id), attempt: String(attempt) },
    },
    { idempotencyKey: `job-transfer:${job.id}:${attempt}` },
  );

  return { paymentIntentId: pi.id, transferId: transfer.id };
}

/**
 * Stripe raises `authentication_required` when an off-session charge needs the
 * customer to complete bank authentication (3-D Secure) on-session. The pending
 * PaymentIntent is attached to the error; returning its id lets us park the job
 * in `requires_action` and resume once the customer confirms — distinct from a
 * hard decline, which has no recoverable PaymentIntent.
 */
function authRequiredPaymentIntent(err: any): string | null {
  if (err?.code !== "authentication_required") return null;
  const pi = err.payment_intent ?? err.raw?.payment_intent;
  return typeof pi?.id === "string" ? pi.id : null;
}

router.get("/jobs", requireProfile, async (req, res): Promise<void> => {
  const profile = getRequestProfile(req);
  const params = ListJobsQueryParams.safeParse(req.query);

  // Org members (driver / supervisor) see their whole company's jobs on the
  // relevant side; base accounts and owners/admins match their own id.
  const actorIds = await orgScopedActorIds(profile);
  const sideCondition = CUSTOMER_SIDE.has(profile.role)
    ? inArray(jobsTable.customerId, actorIds)
    : DRIVER_SIDE.has(profile.role)
      ? inArray(jobsTable.providerId, actorIds)
      : or(inArray(jobsTable.customerId, actorIds), inArray(jobsTable.providerId, actorIds))!;

  const conditions = [sideCondition];
  if (params.success && params.data.status) {
    conditions.push(eq(jobsTable.status, params.data.status as any));
  }

  const jobs = await db.select().from(jobsTable).where(and(...conditions)).orderBy(sql`${jobsTable.createdAt} desc`);

  const enriched = await Promise.all(jobs.map(async (j) => {
    const { customerCompany, providerCompany } = await companiesFor(j);
    return serializeJob(j, customerCompany, providerCompany);
  }));

  res.json(ListJobsResponse.parse(enriched));
});

/**
 * GET /jobs/checkout-return — HTTPS landing page Stripe Checkout redirects to on
 * success or cancel. It performs no writes (finalize is done by the authenticated
 * verify-checkout endpoint); it just bounces the browser back into the app via a
 * whitelisted return URL, carrying the Checkout Session id and an outcome marker.
 * Mirrors the /payouts/return pattern so the in-app browser auto-closes on mobile
 * and the SPA can pick up where it left off on web.
 *
 * Registered BEFORE /jobs/:id so "checkout-return" is never parsed as a job id.
 */
router.get("/jobs/checkout-return", (req, res): void => {
  const rawReturnTo = typeof req.query.returnTo === "string" ? req.query.returnTo : "";
  const returnTo = rawReturnTo && isAllowedReturnTo(rawReturnTo) ? rawReturnTo : "";
  const sessionId = typeof req.query.session_id === "string" ? req.query.session_id : "";
  const cancelled = req.query.status === "cancel";

  let deepLink = "";
  if (returnTo) {
    const marker = cancelled
      ? "checkout=cancel"
      : `checkout=done${sessionId ? `&session_id=${encodeURIComponent(sessionId)}` : ""}`;
    deepLink = returnTo + (returnTo.includes("?") ? "&" : "?") + marker;
  }
  const safeDeepLink = deepLink.replace(/"/g, "%22");
  const redirectScript = deepLink
    ? `<script>setTimeout(function(){location.replace(${JSON.stringify(deepLink)})},250)</script>
<noscript><meta http-equiv="refresh" content="0;url=${safeDeepLink}"></noscript>`
    : "";
  const cta = deepLink
    ? `<p>Returning you to the HaulBrokr app…</p>
<p style="margin-top:16px"><a href="${safeDeepLink}" style="color:#e9a600;font-weight:600;text-decoration:none">Tap here if it doesn't open automatically</a></p>`
    : `<p>You can close this window and return to the HaulBrokr app.</p>`;
  const heading = cancelled ? "Checkout cancelled" : "Payment received";
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(`<!doctype html><html><head><title>HaulBrokr</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
${redirectScript}
<style>body{font-family:system-ui;background:#0a0a0a;color:#fafafa;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:24px;text-align:center}
.card{max-width:380px;padding:32px;background:#171717;border:1px solid #262626;border-radius:16px}
h1{margin:0 0 8px;font-size:20px}p{margin:0;color:#a3a3a3;line-height:1.5;font-size:14px}a{color:#e9a600}</style>
</head><body><div class="card"><h1>${heading}</h1>
${cta}</div></body></html>`);
});

router.get("/jobs/:id", requireProfile, async (req, res): Promise<void> => {
  const profile = getRequestProfile(req);
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetJobParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const job = await loadJobIfMember(params.data.id, profile);
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  const { customerCompany, providerCompany } = await companiesFor(job);
  res.json(GetJobResponse.parse(serializeJob(job, customerCompany, providerCompany)));
});

/**
 * GET /jobs/:id/carrier-documents — the awarded carrier's shareable compliance
 * documents (COI / W-9 / DOT authority) for a job. Visible to the job's customer
 * (and any job member / staff) once a carrier has been assigned. Only documents
 * the customer needs to see are returned, and unverified files are flagged.
 */
const CUSTOMER_VISIBLE_DOC_TYPES = ["coi", "w9", "dot_authority"] as const;

router.get("/jobs/:id/carrier-documents", requireProfile, async (req, res): Promise<void> => {
  const profile = getRequestProfile(req);
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetJobParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const job = await loadJobIfMember(params.data.id, profile);
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  if (!job.providerId) {
    // No carrier assigned yet — nothing to share.
    res.json({ providerId: null, providerCompany: null, documents: [] });
    return;
  }

  const [providerCompany] = await db
    .select({ id: profilesTable.id, companyName: profilesTable.companyName, contactName: profilesTable.contactName })
    .from(profilesTable)
    .where(eq(profilesTable.id, job.providerId));

  const docs = await db
    .select({
      docType: driverDocumentsTable.docType,
      status: driverDocumentsTable.status,
      fileName: driverDocumentsTable.fileName,
      objectPath: driverDocumentsTable.objectPath,
      expiry: driverDocumentsTable.expiry,
      updatedAt: driverDocumentsTable.updatedAt,
    })
    .from(driverDocumentsTable)
    .where(
      and(
        eq(driverDocumentsTable.profileId, job.providerId),
        inArray(driverDocumentsTable.docType, CUSTOMER_VISIBLE_DOC_TYPES as unknown as string[]),
      ),
    );

  res.json({
    providerId: job.providerId,
    providerCompany: providerCompany?.companyName ?? providerCompany?.contactName ?? null,
    documents: docs,
  });
});

/**
 * GET /jobs/:id/invoice — download a PDF invoice for a completed or invoiced job.
 * Available to the customer, assigned hauling company, and HaulBrokr staff admins.
 */
router.get("/jobs/:id/invoice", requireProfile, async (req, res): Promise<void> => {
  const profile = getRequestProfile(req);
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetJobParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [job] = await db.select().from(jobsTable).where(eq(jobsTable.id, params.data.id));
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  if (!jobIsInvoiceEligible(job)) {
    res.status(400).json({ error: "Invoices are available only for completed or invoiced jobs." });
    return;
  }

  const staff = await isAdmin(req);
  if (!staff && !(await canDownloadJobInvoice(job, profile))) {
    res.status(403).json({ error: "You do not have permission to download this invoice." });
    return;
  }

  try {
    const built = await buildJobInvoicePdf(job.id);
    if (!built) {
      res.status(404).json({ error: "Job not found" });
      return;
    }
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${built.invoiceNumber}.pdf"`);
    res.send(Buffer.from(built.pdf));
  } catch (err) {
    req.log?.error?.({ err, jobId: job.id }, "Job invoice PDF generation failed");
    res.status(500).json({ error: "Could not generate invoice PDF." });
  }
});

router.post("/jobs/:id/accept", requireProfile, async (req, res): Promise<void> => {
  const profile = getRequestProfile(req);
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = AcceptJobParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const job = await loadJobIfMember(params.data.id, profile);
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  if (profile.role === "provider" && job.providerId !== profile.id) {
    res.status(403).json({ error: "Only the awarded hauler may accept this job" });
    return;
  }
  if (job.status !== "awarded") {
    res.status(400).json({ error: "Job is not awaiting hauler acceptance" });
    return;
  }

  const [updated] = await db
    .update(jobsTable)
    .set({ status: "accepted" })
    .where(and(eq(jobsTable.id, job.id), eq(jobsTable.providerId, profile.id)))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  await db.update(requestsTable).set({ status: "accepted" }).where(eq(requestsTable.id, job.requestId));
  await db.update(bidsTable).set({ status: "accepted" }).where(eq(bidsTable.id, job.bidId));

  await db.insert(activityTable).values({
    profileId: profile.id,
    type: "job_accepted",
    description: `Accepted awarded job #${job.id} — ${job.materialType} delivery`,
    relatedId: job.id,
  });
  await db.insert(activityTable).values({
    profileId: job.customerId,
    type: "job_accepted",
    description: `Hauler accepted job #${job.id} — ${job.materialType} delivery`,
    relatedId: job.id,
  });

  const { customerCompany, providerCompany } = await companiesFor(updated);
  res.json(AcceptJobResponse.parse(serializeJob(updated, customerCompany, providerCompany)));
});

router.post("/jobs/:id/decline", requireProfile, async (req, res): Promise<void> => {
  const profile = getRequestProfile(req);
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = DeclineJobParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const job = await loadJobIfMember(params.data.id, profile);
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  if (profile.role === "provider" && job.providerId !== profile.id) {
    res.status(403).json({ error: "Only the awarded hauler may decline this job" });
    return;
  }
  if (job.status !== "awarded") {
    res.status(400).json({ error: "Job is not awaiting hauler acceptance" });
    return;
  }

  const [updated] = await db
    .update(jobsTable)
    .set({ status: "declined" })
    .where(and(eq(jobsTable.id, job.id), eq(jobsTable.providerId, profile.id)))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  await db.update(bidsTable).set({ status: "rejected" }).where(eq(bidsTable.id, job.bidId));

  const pendingBids = await db
    .select({ id: bidsTable.id })
    .from(bidsTable)
    .where(and(eq(bidsTable.requestId, job.requestId), eq(bidsTable.status, "pending")));
  const nextRequestStatus = pendingBids.length > 0 ? "bid_received" : "open";
  await db.update(requestsTable).set({ status: nextRequestStatus }).where(eq(requestsTable.id, job.requestId));

  await db.insert(activityTable).values({
    profileId: profile.id,
    type: "job_declined",
    description: `Declined awarded job #${job.id} — ${job.materialType} delivery`,
    relatedId: job.id,
  });
  await db.insert(activityTable).values({
    profileId: job.customerId,
    type: "job_declined",
    description: `Hauler declined job #${job.id} — ${job.materialType} delivery`,
    relatedId: job.id,
  });

  const { customerCompany, providerCompany } = await companiesFor(updated);
  res.json(DeclineJobResponse.parse(serializeJob(updated, customerCompany, providerCompany)));
});

router.patch("/jobs/:id", requireProfile, async (req, res): Promise<void> => {
  const profile = getRequestProfile(req);
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = UpdateJobParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateJobBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const existingJob = await loadJobIfMember(params.data.id, profile);
  if (!existingJob) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  const isProvider = existingJob.providerId === profile.id;
  const isAssignedDriver = profile.role === "driver" && await isDriverAssignedToJob(params.data.id, profile.id);
  if (!isProvider && !isAssignedDriver) {
    res.status(403).json({ error: "Only the hauling company or an assigned driver can update this job." });
    return;
  }
  if (isAssignedDriver && !isProvider && (parsed.data.totalHours !== undefined || parsed.data.notes !== undefined)) {
    res.status(403).json({ error: "Drivers can only update job status." });
    return;
  }

  if (parsed.data.status === "in_progress" && !["accepted", "active"].includes(existingJob.status)) {
    res.status(400).json({ error: "Job must be accepted before starting" });
    return;
  }

  const updates: Record<string, any> = { ...parsed.data };
  if (parsed.data.totalHours !== undefined) updates.totalHours = String(parsed.data.totalHours);

  if (parsed.data.status === "in_progress") {
    updates.startedAt = new Date();
  } else if (parsed.data.status === "completed") {
    updates.completedAt = new Date();
    const hours = parsed.data.totalHours ?? (existingJob.totalHours ? parseFloat(existingJob.totalHours) : null);
    if (hours != null) {
      const rate = parseFloat(existingJob.ratePerHour);
      const feeRate = existingJob.platformFeeRate ? parseFloat(existingJob.platformFeeRate) : DEFAULT_FEE_RATE;
      const { base, fee, gross } = computeBreakdown(rate, hours, feeRate);
      updates.totalHours = String(hours);
      updates.totalAmount = String(base);
      updates.customerTotalAmount = String(gross);
      updates.platformFeeAmount = String(fee);
      updates.providerNetAmount = String(base);
    }
  }

  const [job] = await db
    .update(jobsTable)
    .set(updates)
    .where(eq(jobsTable.id, params.data.id))
    .returning();

  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  if (parsed.data.status === "completed") {
    await db.update(requestsTable).set({ status: "completed" }).where(eq(requestsTable.id, job.requestId));
    await db.insert(activityTable).values({
      profileId: profile.id,
      type: "job_completed",
      description: `Completed job #${job.id} — ${job.materialType} delivery`,
      relatedId: job.id,
    });
    await recordJobTimelineEvent(job.id, profile.id, "completed", { note: "Job marked complete" });
  } else if (parsed.data.status === "in_progress") {
    await db.update(requestsTable).set({ status: "in_progress" }).where(eq(requestsTable.id, job.requestId));
    await db.insert(activityTable).values({
      profileId: profile.id,
      type: "job_started",
      description: `Started job #${job.id} — ${job.materialType} delivery`,
      relatedId: job.id,
    });
    await recordJobTimelineEvent(job.id, profile.id, "started", { note: "Work started" });
  }

  const { customerCompany, providerCompany } = await companiesFor(job);
  res.json(UpdateJobResponse.parse(serializeJob(job, customerCompany, providerCompany)));
});

/**
 * POST /jobs/:id/charge — customer pays for a completed job.
 * - Instant methods (credit_card / ach): charge gross, immediately transfer net
 *   to the provider (15% retained). Marks job released.
 * - Net terms (net_15/30/45): create an invoice with a due date. No money moves
 *   and the provider is NOT paid until the customer's invoice is paid (release).
 */
router.post("/jobs/:id/charge", requireProfile, async (req, res): Promise<void> => {
  const profile = getRequestProfile(req);
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = ChargeJobParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [job] = await db.select().from(jobsTable)
    .where(and(eq(jobsTable.id, params.data.id), eq(jobsTable.customerId, profile.id)));
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  if (job.status !== "completed") {
    res.status(400).json({ error: "Job must be completed before it can be charged." });
    return;
  }
  if (job.customerTotalAmount == null || job.providerNetAmount == null) {
    res.status(400).json({ error: "Job has no computed amount. Mark it completed with hours first." });
    return;
  }
  if (job.paymentStatus === "paid" || job.paymentStatus === "released") {
    res.status(409).json({ error: "This job has already been paid." });
    return;
  }
  // A job that already has an open invoice (its payout release failed) must be
  // retried through /release, not re-charged — re-charging would reset the
  // invoice instead of re-attempting the deferred payout.
  if (job.paymentStatus === "failed" && job.invoicedAt != null) {
    res.status(409).json({ error: "This job has an open invoice. Release the payout to retry." });
    return;
  }

  // Determine payment terms from the customer's saved payment method.
  const [pm] = await db.select().from(paymentMethodsTable).where(eq(paymentMethodsTable.profileId, job.customerId));
  const netDaysByMethod: Record<string, number> = { net_15: 15, net_30: 30, net_45: 45 };
  const NET_TERMS = Object.keys(netDaysByMethod);
  const savedIsNetTerms = !!pm && NET_TERMS.includes(pm.methodType);

  // If the saved method is a net-terms type, re-verify that the customer still
  // has an active approved credit application before honouring deferred payment.
  // This catches pre-existing records and post-rejection cases.
  let isNetTerms = savedIsNetTerms;
  if (savedIsNetTerms) {
    const [creditApp] = await db.select().from(creditApplicationsTable).where(eq(creditApplicationsTable.profileId, job.customerId));
    if (!creditApp || creditApp.status !== "approved") {
      isNetTerms = false;
    }
  }

  if (isNetTerms) {
    const days = netDaysByMethod[pm!.methodType];
    const now = new Date();
    const due = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    const [updated] = await db.update(jobsTable)
      .set({ paymentStatus: "invoiced", invoicedAt: now, paymentDueDate: due })
      .where(eq(jobsTable.id, job.id)).returning();
    const { customerCompany, providerCompany } = await companiesFor(updated);
    res.json(ChargeJobResponse.parse(serializeJob(updated, customerCompany, providerCompany)));
    return;
  }

  // An ACH bank account that still needs micro-deposit verification can't be
  // charged. Block here with a clear message so the customer finishes verifying
  // (Account → payment method) before we attempt to capture funds.
  if (pm?.methodType === "ach" && pm.verificationStatus === "pending") {
    res.status(409).json({ error: "Your bank account is still being verified. Finish verifying it in Account before paying." });
    return;
  }

  // Instant payment — provider's Stripe account must have payouts enabled.
  // Validated server-side (live from Stripe) BEFORE any charge so we never
  // capture the customer's money and then fail to transfer the provider's net.
  const readiness = await checkProviderPayoutReadiness(job.providerId);
  if (!readiness.ok) {
    await notifyPayoutDelayed(job, readiness.message);
    res.status(409).json({ error: readiness.message });
    return;
  }

  // Each attempt gets its own Stripe idempotency key so a retry (e.g. after the
  // customer switches to a different card) is a FRESH charge, not a replay of the
  // previously declined PaymentIntent.
  const attempt = (job.paymentAttempts ?? 0) + 1;

  // The customer's Stripe Customer id lives on their profile; the saved
  // PaymentMethod id on the payment-method row. Together they let us charge the
  // real card off-session.
  const [customerProfile] = await db.select().from(profilesTable).where(eq(profilesTable.id, job.customerId));
  const instrument = {
    stripeCustomerId: customerProfile?.stripeCustomerId ?? null,
    stripePaymentMethodId: pm?.stripePaymentMethodId ?? null,
    methodType: pm?.methodType ?? "credit_card",
  };

  try {
    const { paymentIntentId, transferId } = await settleProviderPayout(job, readiness.stripeAccountId, instrument, attempt);
    const now = new Date();
    const [updated] = await db.update(jobsTable)
      .set({
        paymentStatus: "released",
        paidAt: now,
        releasedAt: now,
        paymentAttempts: attempt,
        stripePaymentIntentId: paymentIntentId,
        stripeTransferId: transferId,
      })
      .where(eq(jobsTable.id, job.id)).returning();
    const { customerCompany, providerCompany } = await companiesFor(updated);
    res.json(ChargeJobResponse.parse(serializeJob(updated, customerCompany, providerCompany)));
  } catch (err: any) {
    // The customer's bank wants them to authenticate this charge (3-D Secure).
    // Park the job in `requires_action` (NOT failed) so the UI can prompt them to
    // confirm the same card on-session, then resume via /confirm-payment.
    const authPi = authRequiredPaymentIntent(err);
    if (authPi) {
      const [updated] = await db.update(jobsTable)
        .set({ paymentStatus: "requires_action", paymentAttempts: attempt, stripePaymentIntentId: authPi })
        .where(eq(jobsTable.id, job.id)).returning();
      await notifyPaymentRequiresAction(job);
      const { customerCompany, providerCompany } = await companiesFor(updated);
      res.json(ChargeJobResponse.parse(serializeJob(updated, customerCompany, providerCompany)));
      return;
    }
    req.log?.error?.({ err }, "Job charge failed");
    await db.update(jobsTable).set({ paymentStatus: "failed", paymentAttempts: attempt }).where(eq(jobsTable.id, job.id));
    await notifyPaymentFailed(job);
    res.status(502).json({ error: err?.message ?? "Payment processing failed" });
  }
});

/**
 * POST /jobs/:id/release — release the provider's net payout for a Net-terms
 * invoice once the customer has paid it. The 15% broker fee is retained.
 */
router.post("/jobs/:id/release", requireProfile, async (req, res): Promise<void> => {
  const profile = getRequestProfile(req);
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = ReleaseJobPaymentParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [job] = await db.select().from(jobsTable)
    .where(and(eq(jobsTable.id, params.data.id), eq(jobsTable.customerId, profile.id)));
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  // Release an open invoice, or retry one whose payout previously failed (a
  // failed release leaves paymentStatus:"failed" with the invoice still set).
  const hasOpenInvoice = job.paymentStatus === "invoiced" || (job.paymentStatus === "failed" && job.invoicedAt != null);
  if (!hasOpenInvoice) {
    res.status(400).json({ error: "There is no open invoice to release for this job." });
    return;
  }
  if (job.customerTotalAmount == null || job.providerNetAmount == null) {
    res.status(400).json({ error: "Job has no computed amount." });
    return;
  }

  const [custPm] = await db.select().from(paymentMethodsTable).where(eq(paymentMethodsTable.profileId, job.customerId));

  // A net-terms invoice settled by ACH can't be released while the bank account
  // is still pending micro-deposit verification.
  if (custPm?.methodType === "ach" && custPm.verificationStatus === "pending") {
    res.status(409).json({ error: "The bank account on file is still being verified. Finish verifying it in Account before releasing payment." });
    return;
  }

  // Provider's Stripe account must have payouts enabled before we release funds.
  const readiness = await checkProviderPayoutReadiness(job.providerId);
  if (!readiness.ok) {
    await notifyPayoutDelayed(job, readiness.message);
    res.status(409).json({ error: readiness.message });
    return;
  }

  const [customerProfile] = await db.select().from(profilesTable).where(eq(profilesTable.id, job.customerId));
  const instrument = {
    stripeCustomerId: customerProfile?.stripeCustomerId ?? null,
    stripePaymentMethodId: custPm?.stripePaymentMethodId ?? null,
    methodType: custPm?.methodType ?? "credit_card",
  };

  // Fresh idempotency key per attempt so retrying a failed release (optionally
  // after updating the payment method) is a new Stripe attempt, not a replay.
  const attempt = (job.paymentAttempts ?? 0) + 1;

  try {
    const { paymentIntentId, transferId } = await settleProviderPayout(job, readiness.stripeAccountId, instrument, attempt);
    const now = new Date();
    const [updated] = await db.update(jobsTable)
      .set({
        paymentStatus: "released",
        paidAt: now,
        releasedAt: now,
        paymentAttempts: attempt,
        stripePaymentIntentId: paymentIntentId,
        stripeTransferId: transferId,
      })
      .where(eq(jobsTable.id, job.id)).returning();
    const { customerCompany, providerCompany } = await companiesFor(updated);
    res.json(ReleaseJobPaymentResponse.parse(serializeJob(updated, customerCompany, providerCompany)));
  } catch (err: any) {
    // Bank wants the customer to authenticate this charge — park in
    // `requires_action` so they can confirm on-session and resume the release.
    const authPi = authRequiredPaymentIntent(err);
    if (authPi) {
      const [updated] = await db.update(jobsTable)
        .set({ paymentStatus: "requires_action", paymentAttempts: attempt, stripePaymentIntentId: authPi })
        .where(eq(jobsTable.id, job.id)).returning();
      await notifyPaymentRequiresAction(job);
      const { customerCompany, providerCompany } = await companiesFor(updated);
      res.json(ReleaseJobPaymentResponse.parse(serializeJob(updated, customerCompany, providerCompany)));
      return;
    }
    req.log?.error?.({ err }, "Job payout release failed");
    await db.update(jobsTable).set({ paymentStatus: "failed", paymentAttempts: attempt }).where(eq(jobsTable.id, job.id));
    await notifyPaymentFailed(job);
    res.status(502).json({ error: err?.message ?? "Payout release failed" });
  }
});

/**
 * GET /jobs/:id/payment-confirmation — hand the client the PaymentIntent client
 * secret it needs to complete bank authentication (3-D Secure) on-session for a
 * job parked in `requires_action`.
 */
router.get("/jobs/:id/payment-confirmation", requireProfile, async (req, res): Promise<void> => {
  const profile = getRequestProfile(req);
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetJobPaymentConfirmationParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [job] = await db.select().from(jobsTable)
    .where(and(eq(jobsTable.id, params.data.id), eq(jobsTable.customerId, profile.id)));
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  if (job.paymentStatus !== "requires_action" || !job.stripePaymentIntentId) {
    res.status(409).json({ error: "This job has no payment awaiting confirmation." });
    return;
  }
  const stripe = await getUncachableStripeClient();
  const pi = await stripe.paymentIntents.retrieve(job.stripePaymentIntentId);
  const publishableKey = await getStripePublishableKey();
  res.json(GetJobPaymentConfirmationResponse.parse({
    clientSecret: pi.client_secret,
    publishableKey,
    paymentIntentId: pi.id,
  }));
});

/**
 * POST /jobs/:id/confirm-payment — finalize a job after the customer has
 * re-authenticated the card on-session. The charge is already captured; here we
 * verify the PaymentIntent succeeded and release the provider's net payout
 * (15% broker fee retained), marking the job released.
 */
router.post("/jobs/:id/confirm-payment", requireProfile, async (req, res): Promise<void> => {
  const profile = getRequestProfile(req);
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = ConfirmJobPaymentParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [job] = await db.select().from(jobsTable)
    .where(and(eq(jobsTable.id, params.data.id), eq(jobsTable.customerId, profile.id)));
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  if (job.paymentStatus !== "requires_action" || !job.stripePaymentIntentId) {
    res.status(409).json({ error: "This job has no payment awaiting confirmation." });
    return;
  }
  if (job.providerNetAmount == null) {
    res.status(400).json({ error: "Job has no computed amount." });
    return;
  }
  // Capture into a const so the non-null narrowing survives the awaits below.
  const providerNetAmount = job.providerNetAmount;

  const stripe = await getUncachableStripeClient();
  const pi = await stripe.paymentIntents.retrieve(job.stripePaymentIntentId);
  if (pi.status !== "succeeded") {
    res.status(409).json({ error: "Payment has not been authenticated yet. Please complete the confirmation and try again." });
    return;
  }

  // Provider's Stripe account must still be ready before we move their money.
  const readiness = await checkProviderPayoutReadiness(job.providerId);
  if (!readiness.ok) {
    res.status(409).json({ error: readiness.message });
    return;
  }

  try {
    // Transfer-only release against the already-succeeded charge. Shared with the
    // background stuck-payout retry so both use the same idempotency key (attempt
    // unchanged) and can never re-charge the customer.
    const updated = await settleConfirmedPayout({ ...job, providerNetAmount }, readiness.stripeAccountId, pi as any);
    const { customerCompany, providerCompany } = await companiesFor(updated);
    res.json(ConfirmJobPaymentResponse.parse(serializeJob(updated, customerCompany, providerCompany)));
  } catch (err: any) {
    req.log?.error?.({ err }, "Confirm-payment payout release failed");
    // The customer's charge has ALREADY succeeded — only the provider transfer
    // failed. Do NOT move the job to `failed`: that would route it back through
    // /charge and re-charge the customer. Leave it in `requires_action` so the
    // only retry path is /confirm-payment, which re-attempts the transfer alone
    // under the same idempotency key (`job-transfer:<id>:<attempt>`) — Stripe
    // dedupes, so the card is never charged twice. We also skip the
    // payment-failed notice since the customer's payment did go through.
    res.status(502).json({
      error: "Your payment was confirmed, but releasing the provider payout didn't complete. Please try again in a moment.",
    });
  }
});

/**
 * POST /jobs/:id/checkout-session — create a Stripe-hosted Checkout Session as a
 * SECOND, additive way for the customer to pay a completed job. Unlike the
 * off-session /charge flow (charge on the platform + a separate Transfer of the
 * net), Checkout uses a DESTINATION CHARGE: the gross is charged on the platform
 * and the net is routed to the provider's connected account automatically, with
 * the 15% broker fee taken as the application fee. The provider nets the same
 * amount either way; the fee never leaves the platform.
 *
 * Gating mirrors /charge so a job that is already paid/released/awaiting
 * authentication can't start a Checkout (prevents double payment). No money
 * moves here — it moves only when the customer completes the hosted page, which
 * is verified on return via /verify-checkout.
 */
router.post("/jobs/:id/checkout-session", requireProfile, async (req, res): Promise<void> => {
  const profile = getRequestProfile(req);
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = CreateJobCheckoutSessionParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsedBody = CreateJobCheckoutSessionBody.safeParse(req.body ?? {});
  if (!parsedBody.success) {
    res.status(400).json({ error: parsedBody.error.message });
    return;
  }

  const [job] = await db.select().from(jobsTable)
    .where(and(eq(jobsTable.id, params.data.id), eq(jobsTable.customerId, profile.id)));
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  if (job.status !== "completed") {
    res.status(400).json({ error: "Job must be completed before it can be charged." });
    return;
  }
  if (job.customerTotalAmount == null || job.providerNetAmount == null) {
    res.status(400).json({ error: "Job has no computed amount. Mark it completed with hours first." });
    return;
  }
  // Same double-payment guard as /charge: a job that is already paid, released,
  // or awaiting on-session card authentication must not start a fresh Checkout.
  if (job.paymentStatus === "paid" || job.paymentStatus === "released") {
    res.status(409).json({ error: "This job has already been paid." });
    return;
  }
  if (job.paymentStatus === "requires_action") {
    res.status(409).json({ error: "This job has a payment awaiting card authentication. Finish confirming it before starting a new checkout." });
    return;
  }

  // Provider's connected account must be able to receive funds BEFORE we let the
  // customer pay — a destination charge needs the provider's account ready, same
  // as the Transfer-based flow.
  const readiness = await checkProviderPayoutReadiness(job.providerId);
  if (!readiness.ok) {
    await notifyPayoutDelayed(job, readiness.message);
    res.status(409).json({ error: readiness.message });
    return;
  }

  const grossCents = Math.round(parseFloat(job.customerTotalAmount) * 100);
  const netCents = Math.round(parseFloat(job.providerNetAmount) * 100);
  const feeCents = grossCents - netCents; // the retained 15% broker fee

  const base = returnUrlBase(req);
  const rawReturnTo = parsedBody.data.returnTo ?? "";
  const returnTo = rawReturnTo && isAllowedReturnTo(rawReturnTo) ? rawReturnTo : "";
  const returnToParam = returnTo ? `&returnTo=${encodeURIComponent(returnTo)}` : "";

  try {
    const stripe = await getUncachableStripeClient();
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: grossCents,
            product_data: {
              name: `HaulBrokr job #${job.id} — ${job.materialType} delivery`,
              description: "Includes the 15% HaulBrokr broker fee.",
            },
          },
          quantity: 1,
        },
      ],
      payment_intent_data: {
        application_fee_amount: feeCents,
        transfer_data: { destination: readiness.stripeAccountId },
        description: `HaulBrokr job #${job.id} (gross, net of 15% fee routed to provider)`,
        metadata: { jobId: String(job.id), kind: "checkout" },
      },
      metadata: { jobId: String(job.id), kind: "checkout" },
      success_url: `${base}/api/jobs/checkout-return?status=done&session_id={CHECKOUT_SESSION_ID}${returnToParam}`,
      cancel_url: `${base}/api/jobs/checkout-return?status=cancel${returnToParam}`,
    });

    if (!session.url) {
      res.status(502).json({ error: "Stripe did not return a Checkout URL." });
      return;
    }
    res.json(CreateJobCheckoutSessionResponse.parse({ url: session.url }));
  } catch (err: any) {
    req.log?.error?.({ err }, "Create Checkout Session failed");
    res.status(502).json({ error: err?.message ?? "Could not start Checkout." });
  }
});

/**
 * POST /jobs/:id/verify-checkout — finalize a job after the customer returns
 * from the hosted Checkout page. Retrieves the Session, confirms it was paid and
 * belongs to this job, records the resulting PaymentIntent and marks the job
 * released. The provider's net already moved via the destination charge, so this
 * only records state.
 *
 * Idempotent: an already-released job is returned as-is, so re-hitting the
 * return URL (or both web + mobile verifying) never double-finalizes. Honours the
 * coupling rule — once the Checkout payment succeeded the job is never flipped to
 * `failed`. An unpaid/incomplete session leaves the job untouched and payable.
 */
router.post("/jobs/:id/verify-checkout", requireProfile, async (req, res): Promise<void> => {
  const profile = getRequestProfile(req);
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = VerifyJobCheckoutParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsedBody = VerifyJobCheckoutBody.safeParse(req.body);
  if (!parsedBody.success) {
    res.status(400).json({ error: parsedBody.error.message });
    return;
  }

  const [job] = await db.select().from(jobsTable)
    .where(and(eq(jobsTable.id, params.data.id), eq(jobsTable.customerId, profile.id)));
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  // Idempotent short-circuit: already finalized — never re-process or risk a flip.
  if (job.paymentStatus === "released" || job.paymentStatus === "paid") {
    const { customerCompany, providerCompany } = await companiesFor(job);
    res.json(VerifyJobCheckoutResponse.parse(serializeJob(job, customerCompany, providerCompany)));
    return;
  }

  try {
    const stripe = await getUncachableStripeClient();
    const session = await stripe.checkout.sessions.retrieve(parsedBody.data.sessionId, {
      expand: ["payment_intent", "payment_intent.latest_charge"],
    });

    // The session must belong to THIS job — guards against a session id for a
    // different job being replayed against this one.
    if (session.metadata?.jobId !== String(job.id)) {
      res.status(409).json({ error: "This checkout session does not belong to this job." });
      return;
    }
    if (session.payment_status !== "paid") {
      // Abandoned / not completed — leave the job untouched and still payable.
      res.status(409).json({ error: "This checkout has not been paid. The job is still payable." });
      return;
    }

    const pi = typeof session.payment_intent === "string" ? null : session.payment_intent;
    const paymentIntentId = typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id ?? null;
    const charge = pi && typeof pi.latest_charge !== "string" ? pi.latest_charge : null;
    const transferId = charge && typeof charge.transfer === "string"
      ? charge.transfer
      : charge && charge.transfer && typeof charge.transfer === "object"
        ? charge.transfer.id
        : null;

    const now = new Date();
    const [updated] = await db.update(jobsTable)
      .set({
        paymentStatus: "released",
        paidAt: now,
        releasedAt: now,
        stripePaymentIntentId: paymentIntentId,
        ...(transferId ? { stripeTransferId: transferId } : {}),
        // A successful payment clears any prior stuck-payout failure tracking.
        payoutRetryFailures: 0,
        payoutAlertSentAt: null,
      })
      .where(eq(jobsTable.id, job.id)).returning();
    const { customerCompany, providerCompany } = await companiesFor(updated);
    res.json(VerifyJobCheckoutResponse.parse(serializeJob(updated, customerCompany, providerCompany)));
  } catch (err: any) {
    // We never mark the job `failed` here: if the Checkout payment actually
    // succeeded, flipping to failed would route it back through /charge and risk
    // a double charge. A transient verify error just leaves the job as-is so the
    // customer can retry the verify (idempotent) without re-paying.
    req.log?.error?.({ err }, "Verify Checkout Session failed");
    res.status(502).json({ error: err?.message ?? "Could not verify the checkout." });
  }
});

// ── Driver / truck assignment ───────────────────────────────────────────────
router.post("/jobs/:id/assign", requireProfile, async (req, res): Promise<void> => {
  const profile = getRequestProfile(req);
  const jobId = parseInt(String(req.params.id), 10);
  if (!Number.isFinite(jobId)) { res.status(400).json({ error: "Invalid job id" }); return; }
  if (!DRIVER_SIDE.has(profile.role) || !isOrgManager(profile)) {
    res.status(403).json({ error: "Only a provider owner or admin can assign drivers and trucks." });
    return;
  }
  const job = await loadJobIfMember(jobId, profile);
  if (!job) { res.status(404).json({ error: "Job not found" }); return; }

  const parsed = AssignJobBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  // Driver must belong to the provider organisation (or be the provider owner).
  const [driver] = await db.select().from(profilesTable).where(eq(profilesTable.id, parsed.data.driverProfileId));
  const [providerProfile] = await db.select().from(profilesTable).where(eq(profilesTable.id, job.providerId));
  const driverOk = driver && (
    driver.id === job.providerId ||
    (driver.role === "driver" && driver.organizationId != null && driver.organizationId === providerProfile?.organizationId)
  );
  if (!driverOk) { res.status(400).json({ error: "Driver is not part of your company." }); return; }

  let truckId: number | null = null;
  if (parsed.data.truckId != null) {
    const [truck] = await db.select().from(trucksTable).where(eq(trucksTable.id, parsed.data.truckId));
    if (!truck || truck.ownerId !== job.providerId) {
      res.status(400).json({ error: "Truck is not part of your fleet." });
      return;
    }
    truckId = truck.id;
    await db.update(trucksTable).set({ assignedDriverId: parsed.data.driverProfileId }).where(eq(trucksTable.id, truck.id));
  }

  const existing = await db.select({ ln: ticketsTable.loadNumber }).from(ticketsTable).where(eq(ticketsTable.jobId, jobId));
  const nextLoad = existing.reduce((m, r) => Math.max(m, r.ln), 0) + 1;

  const [ticket] = await db.insert(ticketsTable).values({
    jobId,
    driverProfileId: parsed.data.driverProfileId,
    truckId,
    loadNumber: nextLoad,
    status: "pending",
  }).returning();

  res.status(201).json({
    ...ticket,
    weightTons: ticket.weightTons != null ? parseFloat(ticket.weightTons) : null,
  });
});

// ── Driver status-update timeline ───────────────────────────────────────────
router.get("/jobs/:id/status-updates", requireProfile, async (req, res): Promise<void> => {
  const profile = getRequestProfile(req);
  const jobId = parseInt(String(req.params.id), 10);
  if (!Number.isFinite(jobId)) { res.status(400).json({ error: "Invalid job id" }); return; }
  const job = await loadJobIfMember(jobId, profile);
  if (!job) { res.status(404).json({ error: "Job not found" }); return; }

  const rows = await db
    .select({
      id: jobStatusUpdatesTable.id,
      jobId: jobStatusUpdatesTable.jobId,
      ticketId: jobStatusUpdatesTable.ticketId,
      actorProfileId: jobStatusUpdatesTable.actorProfileId,
      status: jobStatusUpdatesTable.status,
      note: jobStatusUpdatesTable.note,
      createdAt: jobStatusUpdatesTable.createdAt,
      actorName: profilesTable.contactName,
      actorCompany: profilesTable.companyName,
    })
    .from(jobStatusUpdatesTable)
    .leftJoin(profilesTable, eq(profilesTable.id, jobStatusUpdatesTable.actorProfileId))
    .where(eq(jobStatusUpdatesTable.jobId, jobId))
    .orderBy(sql`${jobStatusUpdatesTable.createdAt} asc`);

  const enriched = rows.map(({ actorCompany, actorName, ...r }) => ({ ...r, actorName: actorName ?? actorCompany }));
  res.json(ListJobStatusUpdatesResponse.parse(enriched));
});

router.post("/jobs/:id/status-updates", requireProfile, async (req, res): Promise<void> => {
  const profile = getRequestProfile(req);
  const jobId = parseInt(String(req.params.id), 10);
  if (!Number.isFinite(jobId)) { res.status(400).json({ error: "Invalid job id" }); return; }
  if (!DRIVER_SIDE.has(profile.role)) {
    res.status(403).json({ error: "Only drivers and providers can report status updates." });
    return;
  }
  const job = await loadJobIfMember(jobId, profile);
  if (!job) { res.status(404).json({ error: "Job not found" }); return; }

  const parsed = CreateJobStatusUpdateBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  if (parsed.data.ticketId != null) {
    const [ticket] = await db.select().from(ticketsTable).where(eq(ticketsTable.id, parsed.data.ticketId));
    if (!ticket || ticket.jobId !== jobId) {
      res.status(400).json({ error: "Ticket does not belong to this job." });
      return;
    }
  }

  const [update] = await db.insert(jobStatusUpdatesTable).values({
    jobId,
    ticketId: parsed.data.ticketId ?? null,
    actorProfileId: profile.id,
    status: parsed.data.status,
    note: parsed.data.note ?? null,
  }).returning();

  res.status(201).json({ ...update, actorName: profile.contactName ?? profile.companyName });
});

// ── Completion approval (foreman / customer) ────────────────────────────────
router.post("/jobs/:id/approve-completion", requireProfile, async (req, res): Promise<void> => {
  const profile = getRequestProfile(req);
  const jobId = parseInt(String(req.params.id), 10);
  if (!Number.isFinite(jobId)) { res.status(400).json({ error: "Invalid job id" }); return; }
  if (!CUSTOMER_SIDE.has(profile.role)) {
    res.status(403).json({ error: "Only a customer or foreman can approve completion." });
    return;
  }
  const job = await loadJobIfMember(jobId, profile);
  if (!job) { res.status(404).json({ error: "Job not found" }); return; }
  if (job.status !== "completed") {
    res.status(409).json({ error: "The job must be marked completed before it can be reviewed." });
    return;
  }
  if (!(await canReviewCompletion(job, profile))) {
    res.status(403).json({ error: "You are not assigned to review this job's completion." });
    return;
  }

  const [updated] = await db.update(jobsTable)
    .set({
      completionApproval: "approved",
      approvedByProfileId: profile.id,
      completionApprovedAt: new Date(),
      flagReason: null,
    })
    .where(eq(jobsTable.id, jobId))
    .returning();

  const { customerCompany, providerCompany } = await companiesFor(updated);
  res.json(ApproveJobCompletionResponse.parse(serializeJob(updated, customerCompany, providerCompany)));
});

router.post("/jobs/:id/flag-completion", requireProfile, async (req, res): Promise<void> => {
  const profile = getRequestProfile(req);
  const jobId = parseInt(String(req.params.id), 10);
  if (!Number.isFinite(jobId)) { res.status(400).json({ error: "Invalid job id" }); return; }
  if (!CUSTOMER_SIDE.has(profile.role)) {
    res.status(403).json({ error: "Only a customer or foreman can flag completion." });
    return;
  }
  const job = await loadJobIfMember(jobId, profile);
  if (!job) { res.status(404).json({ error: "Job not found" }); return; }
  if (job.status !== "completed") {
    res.status(409).json({ error: "The job must be marked completed before it can be reviewed." });
    return;
  }
  if (!(await canReviewCompletion(job, profile))) {
    res.status(403).json({ error: "You are not assigned to review this job's completion." });
    return;
  }

  const parsed = FlagJobCompletionBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [updated] = await db.update(jobsTable)
    .set({
      completionApproval: "flagged",
      approvedByProfileId: profile.id,
      completionApprovedAt: new Date(),
      flagReason: parsed.data.reason,
    })
    .where(eq(jobsTable.id, jobId))
    .returning();

  const { customerCompany, providerCompany } = await companiesFor(updated);
  res.json(FlagJobCompletionResponse.parse(serializeJob(updated, customerCompany, providerCompany)));
});

export default router;
