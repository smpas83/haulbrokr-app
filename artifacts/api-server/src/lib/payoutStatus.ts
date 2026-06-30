import { eq } from "drizzle-orm";
import { db, payoutAccountsTable } from "@workspace/db";
import { getUncachableStripeClient } from "./stripeClient";

export const PAYOUTS_NOT_CONNECTED_MSG =
  "The provider hasn't connected a payout account yet, so the net payout can't be sent.";
export const PAYOUTS_NOT_ENABLED_MSG =
  "The provider's payout account isn't ready yet — Stripe hasn't enabled payouts. They need to finish their payout onboarding before this payment can be released.";

export type PayoutReadiness =
  | { ok: true; stripeAccountId: string }
  | { ok: false; reason: "not_connected" | "not_enabled" | "not_approved"; message: string };

/** A single outstanding Stripe onboarding step, in a provider-friendly shape. */
export type PayoutRequirement = {
  /** The raw Stripe requirement key, e.g. "external_account". */
  code: string;
  /** A short, human-readable description of what the provider must do. */
  label: string;
};

export type PayoutRequirements = {
  /** Steps the provider must complete now to keep payouts flowing. */
  currentlyDue: PayoutRequirement[];
  /** Items Stripe is actively reviewing — nothing for the provider to do. */
  pendingVerification: PayoutRequirement[];
  /** Stripe's machine reason payouts are disabled, if any (e.g. "requirements.past_due"). */
  disabledReason: string | null;
  /** Unix seconds by which currentlyDue items must be resolved, if Stripe set a deadline. */
  currentDeadline: number | null;
};

/**
 * Turn a raw Stripe requirement key into a friendly, action-oriented label a
 * provider can understand. Stripe keys are dotted paths like
 * "individual.verification.document" or "external_account". We match the most
 * specific known keys/prefixes first and fall back to a humanized version of
 * the key so new/unknown requirements still render something sensible.
 */
export function humanizeRequirement(code: string): string {
  const exact: Record<string, string> = {
    external_account: "Add a bank account to receive payouts",
    "business_profile.url": "Add a business website or product description",
    "business_profile.mcc": "Select your business category",
    "business_profile.product_description": "Describe what your business does",
    "individual.verification.document": "Upload a photo of your ID (driver's license or passport)",
    "individual.verification.additional_document": "Upload an additional identity document",
    "individual.id_number": "Provide your full Social Security or tax ID number",
    "individual.ssn_last_4": "Provide the last 4 digits of your SSN",
    "individual.phone": "Add a phone number",
    "individual.email": "Add an email address",
    "individual.first_name": "Provide your legal first name",
    "individual.last_name": "Provide your legal last name",
    "individual.political_exposure": "Answer the political exposure question",
    "tos_acceptance.date": "Accept the Stripe service agreement",
    "tos_acceptance.ip": "Accept the Stripe service agreement",
  };
  if (exact[code]) return exact[code];

  const prefixes: Array<[string, string]> = [
    ["individual.dob", "Confirm your date of birth"],
    ["individual.address", "Confirm your home address"],
    ["individual.verification", "Complete identity verification"],
    ["company.address", "Confirm your business address"],
    ["company.verification", "Verify your business details"],
    ["company.tax_id", "Provide your business tax ID (EIN)"],
    ["company.name", "Provide your legal business name"],
    ["company.phone", "Add a business phone number"],
    ["business_profile", "Complete your business profile"],
    ["tos_acceptance", "Accept the Stripe service agreement"],
    ["external_account", "Add a bank account to receive payouts"],
  ];
  for (const [prefix, label] of prefixes) {
    if (code === prefix || code.startsWith(prefix + ".")) return label;
  }

  // Fallback: humanize the dotted key (e.g. "person.relationship.title" →
  // "Provide person relationship title").
  const readable = code
    .replace(/_/g, " ")
    .replace(/\./g, " ")
    .trim();
  return `Provide ${readable}`;
}

/**
 * Map a Stripe account's `requirements` object into a friendly, de-duplicated
 * checklist the mobile app can render directly. Combines currently_due and
 * past_due (both are blocking) and exposes pending_verification separately so
 * the UI can tell "do this now" apart from "Stripe is reviewing this".
 */
export function buildPayoutRequirements(acct: any): PayoutRequirements {
  const reqs = acct?.requirements ?? {};
  const dueCodes: string[] = [
    ...(Array.isArray(reqs.currently_due) ? reqs.currently_due : []),
    ...(Array.isArray(reqs.past_due) ? reqs.past_due : []),
  ];
  const pendingCodes: string[] = Array.isArray(reqs.pending_verification)
    ? reqs.pending_verification
    : [];

  const toRequirements = (codes: string[]): PayoutRequirement[] => {
    const seenLabels = new Set<string>();
    const out: PayoutRequirement[] = [];
    for (const code of codes) {
      const label = humanizeRequirement(code);
      // De-dupe by label so e.g. dob.day/dob.month/dob.year collapse to one row.
      if (seenLabels.has(label)) continue;
      seenLabels.add(label);
      out.push({ code, label });
    }
    return out;
  };

  return {
    currentlyDue: toRequirements(dueCodes),
    pendingVerification: toRequirements(pendingCodes),
    disabledReason: typeof reqs.disabled_reason === "string" ? reqs.disabled_reason : null,
    currentDeadline: typeof reqs.current_deadline === "number" ? reqs.current_deadline : null,
  };
}

export function onboardingStatusForAccount(acct: any): "complete" | "restricted" | "pending" {
  if (acct?.payouts_enabled && acct?.charges_enabled && acct?.details_submitted) return "complete";
  const reqs = buildPayoutRequirements(acct);
  if (reqs.currentlyDue.length > 0 || reqs.disabledReason) return "restricted";
  return acct?.details_submitted ? "pending" : "restricted";
}

/**
 * Refresh a connected account's capability flags from Stripe and persist them.
 * Returns the live Stripe account.
 */
export async function syncStripeStatus(stripeAccountId: string, profileId: number) {
  const stripe = await getUncachableStripeClient();
  const acct = await stripe.accounts.retrieve(stripeAccountId);
  const requirements = buildPayoutRequirements(acct);
  await db
    .update(payoutAccountsTable)
    .set({
      chargesEnabled: acct.charges_enabled ? 1 : 0,
      payoutsEnabled: acct.payouts_enabled ? 1 : 0,
      detailsSubmitted: acct.details_submitted ? 1 : 0,
      status: acct.payouts_enabled ? "verified" : "pending",
      onboardingStatus: onboardingStatusForAccount(acct),
      requirementsJson: JSON.stringify(requirements),
      disabledReason: requirements.disabledReason,
      lastStripeSyncAt: new Date(),
    })
    .where(eq(payoutAccountsTable.profileId, profileId));
  return acct;
}

/**
 * Server-side guard: a payout/transfer for a provider must NOT be attempted
 * unless their connected Stripe account actually has payouts enabled. This is
 * the source of truth — the mobile app's client-side warnings can be dismissed
 * ("Bid Anyway"), so the API must independently refuse to release funds.
 *
 * We refresh live from Stripe (and persist the flags). If Stripe is briefly
 * unreachable we fall back to the last-known stored flag rather than blocking a
 * provider who is already enabled.
 */
export async function checkProviderPayoutReadiness(
  providerId: number,
): Promise<PayoutReadiness> {
  const [row] = await db
    .select()
    .from(payoutAccountsTable)
    .where(eq(payoutAccountsTable.profileId, providerId));

  // Never connected: no Stripe Connect account exists for this provider.
  if (!row?.stripeAccountId) {
    return { ok: false, reason: "not_connected", message: PAYOUTS_NOT_CONNECTED_MSG };
  }

  // Connected: confirm payouts are actually enabled, preferring live Stripe data.
  let payoutsEnabled = row.payoutsEnabled === 1;
  let payoutStatus = row.status ?? (payoutsEnabled ? "verified" : "pending");
  try {
    const acct = await syncStripeStatus(row.stripeAccountId, providerId);
    payoutsEnabled = !!acct.payouts_enabled;
    payoutStatus = acct.payouts_enabled ? "verified" : "pending";
  } catch {
    // Stripe unreachable — fall back to the last persisted flag.
  }

  if (!payoutsEnabled) {
    return { ok: false, reason: "not_enabled", message: PAYOUTS_NOT_ENABLED_MSG };
  }

  if (payoutStatus !== "verified") {
    return {
      ok: false,
      reason: "not_approved",
      message: "The provider's payout account is not approved yet. HaulBrokr must approve the provider and Stripe onboarding must be complete before payout.",
    };
  }

  return { ok: true, stripeAccountId: row.stripeAccountId };
}
