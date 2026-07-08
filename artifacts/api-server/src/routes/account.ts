import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import {
  db,
  w9SubmissionsTable,
  insuranceSubmissionsTable,
  paymentMethodsTable,
  payoutAccountsTable,
  profilesTable,
  dotCdlTable,
  creditApplicationsTable,
} from "@workspace/db";
import {
  getRequestProfile,
  requireProfile,
  attachClerkProfileIfPresent,
} from "../middlewares/requireAuth";
import { hasPermission, requirePermission } from "../middlewares/requireAdmin";
import {
  attachStaffSession,
  requireStaffOrProfile,
} from "../middlewares/staffAuth";
import { computeProviderCanBid } from "../lib/providerCompliance";
import {
  getUncachableStripeClient,
  getStripePublishableKey,
} from "../lib/stripeClient";
import {
  GetW9Response,
  SubmitW9Body,
  UpdateW9Body,
  GetInsuranceResponse,
  SubmitInsuranceBody,
  UpdateInsuranceBody,
  GetPaymentMethodResponse,
  SetPaymentMethodBody,
  UpdatePaymentMethodBody,
  CreatePaymentMethodSetupIntentResponse,
  GetPayoutAccountResponse,
  SetPayoutAccountBody,
  UpdatePayoutAccountBody,
  GetAccountStatusResponse,
  SubmitComplianceBody,
  SubmitCreditApplicationBody,
  VerifyPaymentMethodMicrodepositsBody,
  VerifyPaymentMethodMicrodepositsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.use(attachStaffSession);
router.use(attachClerkProfileIfPresent);

// Compliance verification is staff-only (compliance permission).

// ── Account Status ────────────────────────────────────────────────────────────
router.get(
  "/account/status",
  requireProfile,
  async (req, res): Promise<void> => {
    const profile = getRequestProfile(req);

    const [w9] = await db
      .select()
      .from(w9SubmissionsTable)
      .where(eq(w9SubmissionsTable.profileId, profile.id));
    const [insurance] = await db
      .select()
      .from(insuranceSubmissionsTable)
      .where(eq(insuranceSubmissionsTable.profileId, profile.id));
    const [payment] = await db
      .select()
      .from(paymentMethodsTable)
      .where(eq(paymentMethodsTable.profileId, profile.id));
    const [payout] = await db
      .select()
      .from(payoutAccountsTable)
      .where(eq(payoutAccountsTable.profileId, profile.id));
    const [dotCdl] = await db
      .select()
      .from(dotCdlTable)
      .where(eq(dotCdlTable.profileId, profile.id));

    const profileComplete = !!(
      profile.companyName &&
      profile.contactName &&
      profile.phone &&
      profile.city &&
      profile.state
    );

    const w9Status = w9 ? w9.status : "not_submitted";
    const insuranceStatus = insurance ? insurance.status : "not_submitted";
    const paymentStatus = payment ? "set" : "not_set";
    const payoutStatus = payout ? payout.status : "not_submitted";
    const dotCdlStatus = dotCdl?.status ?? "not_submitted";

    const canBid = computeProviderCanBid({
      role: profile.role,
      w9Status,
      insuranceStatus,
      dotCdlStatus,
      payoutStatus,
    });

    const canPost =
      profile.role === "customer" && profileComplete && paymentStatus === "set";

    res.json(
      GetAccountStatusResponse.parse({
        profileComplete,
        w9Status,
        insuranceStatus,
        dotCdlStatus,
        paymentStatus,
        payoutStatus,
        canBid,
        canPost,
      }),
    );
  },
);

// ── W-9 ───────────────────────────────────────────────────────────────────────
router.get("/account/w9", requireProfile, async (req, res): Promise<void> => {
  const profile = getRequestProfile(req);
  const [w9] = await db
    .select()
    .from(w9SubmissionsTable)
    .where(eq(w9SubmissionsTable.profileId, profile.id));
  if (!w9) {
    res.status(404).json({ error: "W-9 not submitted" });
    return;
  }
  res.json(GetW9Response.parse(w9));
});

router.post("/account/w9", requireProfile, async (req, res): Promise<void> => {
  const profile = getRequestProfile(req);
  const parsed = SubmitW9Body.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const existing = await db
    .select()
    .from(w9SubmissionsTable)
    .where(eq(w9SubmissionsTable.profileId, profile.id));
  if (existing.length > 0) {
    res
      .status(409)
      .json({ error: "W-9 already submitted. Use PATCH to update." });
    return;
  }
  const [w9] = await db
    .insert(w9SubmissionsTable)
    .values({
      ...parsed.data,
      profileId: profile.id,
      status: "pending",
    })
    .returning();
  res.status(201).json(GetW9Response.parse(w9));
});

router.patch("/account/w9", requireProfile, async (req, res): Promise<void> => {
  const profile = getRequestProfile(req);
  const parsed = UpdateW9Body.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [w9] = await db
    .update(w9SubmissionsTable)
    .set({ ...parsed.data, status: "pending" })
    .where(eq(w9SubmissionsTable.profileId, profile.id))
    .returning();
  if (!w9) {
    res.status(404).json({ error: "W-9 not found" });
    return;
  }
  res.json(GetW9Response.parse(w9));
});

// ── Insurance ─────────────────────────────────────────────────────────────────
router.get(
  "/account/insurance",
  requireProfile,
  async (req, res): Promise<void> => {
    const profile = getRequestProfile(req);
    const [insurance] = await db
      .select()
      .from(insuranceSubmissionsTable)
      .where(eq(insuranceSubmissionsTable.profileId, profile.id));
    if (!insurance) {
      res.status(404).json({ error: "Insurance not submitted" });
      return;
    }
    res.json(
      GetInsuranceResponse.parse({
        ...insurance,
        glCoverageAmount: parseFloat(insurance.glCoverageAmount),
        autoCoverageAmount: insurance.autoCoverageAmount
          ? parseFloat(insurance.autoCoverageAmount)
          : null,
        bondAmount: insurance.bondAmount
          ? parseFloat(insurance.bondAmount)
          : null,
      }),
    );
  },
);

router.post(
  "/account/insurance",
  requireProfile,
  async (req, res): Promise<void> => {
    const profile = getRequestProfile(req);
    const parsed = SubmitInsuranceBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const existing = await db
      .select()
      .from(insuranceSubmissionsTable)
      .where(eq(insuranceSubmissionsTable.profileId, profile.id));
    if (existing.length > 0) {
      res
        .status(409)
        .json({ error: "Insurance already submitted. Use PATCH to update." });
      return;
    }
    const [insurance] = await db
      .insert(insuranceSubmissionsTable)
      .values({
        ...parsed.data,
        profileId: profile.id,
        status: "pending",
        glCoverageAmount: String(parsed.data.glCoverageAmount),
        autoCoverageAmount:
          parsed.data.autoCoverageAmount != null
            ? String(parsed.data.autoCoverageAmount)
            : undefined,
        bondAmount:
          parsed.data.bondAmount != null
            ? String(parsed.data.bondAmount)
            : undefined,
      })
      .returning();
    res.status(201).json(
      GetInsuranceResponse.parse({
        ...insurance,
        glCoverageAmount: parseFloat(insurance.glCoverageAmount),
        autoCoverageAmount: insurance.autoCoverageAmount
          ? parseFloat(insurance.autoCoverageAmount)
          : null,
        bondAmount: insurance.bondAmount
          ? parseFloat(insurance.bondAmount)
          : null,
      }),
    );
  },
);

router.patch(
  "/account/insurance",
  requireProfile,
  async (req, res): Promise<void> => {
    const profile = getRequestProfile(req);
    const parsed = UpdateInsuranceBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [insurance] = await db
      .update(insuranceSubmissionsTable)
      .set({
        ...parsed.data,
        status: "pending",
        glCoverageAmount: String(parsed.data.glCoverageAmount),
        autoCoverageAmount:
          parsed.data.autoCoverageAmount != null
            ? String(parsed.data.autoCoverageAmount)
            : undefined,
        bondAmount:
          parsed.data.bondAmount != null
            ? String(parsed.data.bondAmount)
            : undefined,
      })
      .where(eq(insuranceSubmissionsTable.profileId, profile.id))
      .returning();
    if (!insurance) {
      res.status(404).json({ error: "Insurance not found" });
      return;
    }
    res.json(
      GetInsuranceResponse.parse({
        ...insurance,
        glCoverageAmount: parseFloat(insurance.glCoverageAmount),
        autoCoverageAmount: insurance.autoCoverageAmount
          ? parseFloat(insurance.autoCoverageAmount)
          : null,
        bondAmount: insurance.bondAmount
          ? parseFloat(insurance.bondAmount)
          : null,
      }),
    );
  },
);

// ── Payment Method (Customer) ─────────────────────────────────────────────────

/**
 * Ensure the profile has a Stripe Customer (cus_…) and return its id. Created
 * lazily the first time a customer captures a card; saved cards attach to it and
 * settlement charges them off-session. Persisted on the profile so it is reused.
 */
async function ensureStripeCustomerId(profile: any): Promise<string> {
  if (profile.stripeCustomerId) return profile.stripeCustomerId;
  const stripe = await getUncachableStripeClient();
  const customer = await stripe.customers.create({
    email: profile.email ?? undefined,
    name: profile.companyName ?? profile.contactName ?? undefined,
    metadata: { profileId: String(profile.id) },
  });
  await db
    .update(profilesTable)
    .set({ stripeCustomerId: customer.id })
    .where(eq(profilesTable.id, profile.id));
  profile.stripeCustomerId = customer.id;
  return customer.id;
}

/**
 * Resolve a client-supplied Stripe PaymentMethod id into the columns we persist.
 * Works for both cards and US bank accounts (ACH). The instrument metadata is read
 * back FROM Stripe (never trusted from the client), and the PM is verified to
 * belong to — or attached to — this profile's Customer so a caller can't store
 * someone else's instrument. Card columns are populated for cards and bank columns
 * for us_bank_account; the unused side is nulled so a switched method type doesn't
 * leave stale display data. Returns the fields to merge in.
 */
type ResolvedInstrumentFields = {
  stripePaymentMethodId: string;
  stripeSetupIntentId: string | null;
  verificationStatus: string | null;
  cardBrand: string | null;
  cardLast4: string | null;
  cardExpMonth: string | null;
  cardExpYear: string | null;
  bankName: string | null;
  accountLast4: string | null;
  routingLast4: string | null;
};

async function resolveStripePaymentMethod(
  profile: any,
  paymentMethodId: string,
  setupIntentId?: string | null,
): Promise<ResolvedInstrumentFields> {
  const customerId = await ensureStripeCustomerId(profile);
  const stripe = await getUncachableStripeClient();
  const pmObj = await stripe.paymentMethods.retrieve(paymentMethodId);

  const attachedTo =
    typeof pmObj.customer === "string"
      ? pmObj.customer
      : (pmObj.customer?.id ?? null);
  if (attachedTo && attachedTo !== customerId) {
    throw Object.assign(
      new Error("Payment method does not belong to this account."),
      { status: 400 },
    );
  }
  if (!attachedTo) {
    await stripe.paymentMethods.attach(pmObj.id, { customer: customerId });
  }

  const card = pmObj.card ?? null;
  const bank = pmObj.us_bank_account ?? null;

  // For ACH the SetupIntent tells us whether the bank verified instantly or still
  // needs micro-deposit confirmation. We read it FROM Stripe (never trust the
  // client) and keep the id so the customer can finish verification later. Cards
  // never need this step, so their verification status stays null.
  let stripeSetupIntentId: string | null = null;
  let verificationStatus: string | null = null;
  if (bank) {
    // A real bank instrument can only be saved via the secure setup flow, which
    // yields the SetupIntent that minted THIS PaymentMethod. Requiring it (and
    // checking it links to this exact pm) stops a client from forging a
    // "verified" status by passing an unrelated succeeded SetupIntent.
    if (!setupIntentId) {
      throw Object.assign(
        new Error("Connect your bank account through the secure setup flow."),
        { status: 400 },
      );
    }
    const si = await stripe.setupIntents.retrieve(setupIntentId);
    const siCustomer =
      typeof si.customer === "string" ? si.customer : (si.customer?.id ?? null);
    if (siCustomer && siCustomer !== customerId) {
      throw Object.assign(
        new Error("Setup intent does not belong to this account."),
        { status: 400 },
      );
    }
    const siPm =
      typeof si.payment_method === "string"
        ? si.payment_method
        : (si.payment_method?.id ?? null);
    if (siPm !== pmObj.id) {
      throw Object.assign(
        new Error("Setup intent does not match this bank account."),
        { status: 400 },
      );
    }
    stripeSetupIntentId = si.id;
    verificationStatus = si.status === "succeeded" ? "verified" : "pending";
  }

  return {
    stripePaymentMethodId: pmObj.id,
    stripeSetupIntentId,
    verificationStatus,
    cardBrand: card?.brand ?? null,
    cardLast4: card?.last4 ?? null,
    cardExpMonth: card ? String(card.exp_month) : null,
    cardExpYear: card ? String(card.exp_year) : null,
    bankName: bank?.bank_name ?? null,
    accountLast4: bank?.last4 ?? null,
    routingLast4: bank?.routing_number ? bank.routing_number.slice(-4) : null,
  };
}

// Start a Stripe SetupIntent so the browser can securely capture a card with
// Stripe Elements. Returns the client secret to confirm with and the publishable
// key to boot Stripe.js. No card data ever touches our server.
router.post(
  "/account/payment-method/setup-intent",
  requireProfile,
  async (req, res): Promise<void> => {
    const profile = getRequestProfile(req);
    try {
      const customerId = await ensureStripeCustomerId(profile);
      const stripe = await getUncachableStripeClient();
      const intent = await stripe.setupIntents.create({
        customer: customerId,
        payment_method_types: ["card"],
        usage: "off_session",
      });
      const publishableKey = await getStripePublishableKey();
      res.json(
        CreatePaymentMethodSetupIntentResponse.parse({
          clientSecret: intent.client_secret,
          publishableKey,
        }),
      );
    } catch (err: any) {
      req.log?.error?.({ err }, "Failed to create SetupIntent");
      res
        .status(502)
        .json({ error: err?.message ?? "Could not start card setup" });
    }
  },
);

// Start a Stripe SetupIntent for a US bank account (ACH). Stripe.js drives
// verification on the client — instant via Financial Connections where supported,
// falling back to micro-deposits — and confirms the SetupIntent, minting a real
// us_bank_account PaymentMethod (pm_…) we can later charge off-session. No bank
// credentials ever touch our server.
router.post(
  "/account/payment-method/bank-setup-intent",
  requireProfile,
  async (req, res): Promise<void> => {
    const profile = getRequestProfile(req);
    try {
      const customerId = await ensureStripeCustomerId(profile);
      const stripe = await getUncachableStripeClient();
      const intent = await stripe.setupIntents.create({
        customer: customerId,
        payment_method_types: ["us_bank_account"],
        usage: "off_session",
        payment_method_options: {
          us_bank_account: {
            verification_method: "automatic",
          },
        },
      });
      const publishableKey = await getStripePublishableKey();
      res.json(
        CreatePaymentMethodSetupIntentResponse.parse({
          clientSecret: intent.client_secret,
          publishableKey,
        }),
      );
    } catch (err: any) {
      req.log?.error?.({ err }, "Failed to create bank SetupIntent");
      res
        .status(502)
        .json({ error: err?.message ?? "Could not start bank setup" });
    }
  },
);

router.get(
  "/account/payment-method",
  requireProfile,
  async (req, res): Promise<void> => {
    const profile = getRequestProfile(req);
    const [pm] = await db
      .select()
      .from(paymentMethodsTable)
      .where(eq(paymentMethodsTable.profileId, profile.id));
    if (!pm) {
      res.status(404).json({ error: "Payment method not set" });
      return;
    }
    res.json(GetPaymentMethodResponse.parse(pm));
  },
);

router.post(
  "/account/payment-method",
  requireProfile,
  async (req, res): Promise<void> => {
    const profile = getRequestProfile(req);
    const parsed = SetPaymentMethodBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const NET_TERMS = ["net_15", "net_30", "net_45"];
    if (NET_TERMS.includes(parsed.data.methodType)) {
      const [creditApp] = await db
        .select()
        .from(creditApplicationsTable)
        .where(eq(creditApplicationsTable.profileId, profile.id));
      if (!creditApp || creditApp.status !== "approved") {
        res.status(403).json({
          error: "Net invoicing terms require an approved credit application.",
        });
        return;
      }
    }
    const existing = await db
      .select()
      .from(paymentMethodsTable)
      .where(eq(paymentMethodsTable.profileId, profile.id));
    if (existing.length > 0) {
      res
        .status(409)
        .json({ error: "Payment method already set. Use PATCH to update." });
      return;
    }
    let stripeFields: ResolvedInstrumentFields | undefined;
    if (parsed.data.stripePaymentMethodId) {
      try {
        stripeFields = await resolveStripePaymentMethod(
          profile,
          parsed.data.stripePaymentMethodId,
          parsed.data.stripeSetupIntentId,
        );
      } catch (err: any) {
        res
          .status(err?.status ?? 502)
          .json({ error: err?.message ?? "Could not save card" });
        return;
      }
    }
    const [pm] = await db
      .insert(paymentMethodsTable)
      .values({
        ...parsed.data,
        ...(stripeFields ?? {}),
        profileId: profile.id,
      })
      .returning();
    res.status(201).json(GetPaymentMethodResponse.parse(pm));
  },
);

router.patch(
  "/account/payment-method",
  requireProfile,
  async (req, res): Promise<void> => {
    const profile = getRequestProfile(req);
    const parsed = UpdatePaymentMethodBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const NET_TERMS = ["net_15", "net_30", "net_45"];
    if (
      parsed.data.methodType != null &&
      NET_TERMS.includes(parsed.data.methodType)
    ) {
      const [creditApp] = await db
        .select()
        .from(creditApplicationsTable)
        .where(eq(creditApplicationsTable.profileId, profile.id));
      if (!creditApp || creditApp.status !== "approved") {
        res.status(403).json({
          error: "Net invoicing terms require an approved credit application.",
        });
        return;
      }
    }
    let stripeFields: ResolvedInstrumentFields | undefined;
    if (parsed.data.stripePaymentMethodId) {
      try {
        stripeFields = await resolveStripePaymentMethod(
          profile,
          parsed.data.stripePaymentMethodId,
          parsed.data.stripeSetupIntentId,
        );
      } catch (err: any) {
        res
          .status(err?.status ?? 502)
          .json({ error: err?.message ?? "Could not save card" });
        return;
      }
    }
    const [pm] = await db
      .update(paymentMethodsTable)
      .set({ ...parsed.data, ...(stripeFields ?? {}) })
      .where(eq(paymentMethodsTable.profileId, profile.id))
      .returning();
    if (!pm) {
      res.status(404).json({ error: "Payment method not found" });
      return;
    }
    res.json(GetPaymentMethodResponse.parse(pm));
  },
);

// Finish ACH micro-deposit verification. When a customer's bank can't be linked
// instantly, Stripe sends 1-2 tiny deposits; the customer enters the amounts (or
// the descriptor code) here to confirm ownership and make the bank chargeable.
router.post(
  "/account/payment-method/verify-microdeposits",
  requireProfile,
  async (req, res): Promise<void> => {
    const profile = getRequestProfile(req);
    const parsed = VerifyPaymentMethodMicrodepositsBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const hasAmounts =
      Array.isArray(parsed.data.amounts) && parsed.data.amounts.length === 2;
    const hasCode =
      typeof parsed.data.descriptorCode === "string" &&
      parsed.data.descriptorCode.length > 0;
    if (hasAmounts === hasCode) {
      res.status(400).json({
        error:
          "Provide either the two deposit amounts or the descriptor code, not both.",
      });
      return;
    }

    const [pm] = await db
      .select()
      .from(paymentMethodsTable)
      .where(eq(paymentMethodsTable.profileId, profile.id));
    if (
      !pm ||
      pm.methodType !== "ach" ||
      !pm.stripeSetupIntentId ||
      pm.verificationStatus !== "pending"
    ) {
      res
        .status(404)
        .json({ error: "No bank account is awaiting verification." });
      return;
    }

    const stripe = await getUncachableStripeClient();
    let si;
    try {
      si = await stripe.setupIntents.verifyMicrodeposits(
        pm.stripeSetupIntentId,
        hasAmounts
          ? { amounts: parsed.data.amounts }
          : { descriptor_code: parsed.data.descriptorCode },
      );
    } catch (err: any) {
      // Stripe returns a 400-class error for wrong amounts/code or too many attempts.
      res.status(400).json({
        error:
          err?.message ??
          "Verification failed. Double-check the amounts and try again.",
      });
      return;
    }

    if (si.status !== "succeeded") {
      res.status(400).json({
        error: "Verification could not be completed. Please try again.",
      });
      return;
    }

    const [updated] = await db
      .update(paymentMethodsTable)
      .set({ verificationStatus: "verified" })
      .where(eq(paymentMethodsTable.profileId, profile.id))
      .returning();
    res.json(VerifyPaymentMethodMicrodepositsResponse.parse(updated));
  },
);

// ── Payout Account (Provider) ─────────────────────────────────────────────────
router.get(
  "/account/payout",
  requireProfile,
  async (req, res): Promise<void> => {
    const profile = getRequestProfile(req);
    const [payout] = await db
      .select()
      .from(payoutAccountsTable)
      .where(eq(payoutAccountsTable.profileId, profile.id));
    if (!payout) {
      res.status(404).json({ error: "Payout account not set" });
      return;
    }
    res.json(GetPayoutAccountResponse.parse(payout));
  },
);

router.post(
  "/account/payout",
  requireProfile,
  async (req, res): Promise<void> => {
    const profile = getRequestProfile(req);
    const parsed = SetPayoutAccountBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const existing = await db
      .select()
      .from(payoutAccountsTable)
      .where(eq(payoutAccountsTable.profileId, profile.id));
    if (existing.length > 0) {
      res
        .status(409)
        .json({ error: "Payout account already set. Use PATCH to update." });
      return;
    }
    const routingLast4 = parsed.data.routingNumber.slice(-4);
    const accountLast4 = parsed.data.accountNumber.slice(-4);
    const { routingNumber, accountNumber, ...rest } = parsed.data;
    const [payout] = await db
      .insert(payoutAccountsTable)
      .values({
        ...rest,
        routingLast4,
        accountLast4,
        profileId: profile.id,
        status: "pending",
      })
      .returning();
    res.status(201).json(GetPayoutAccountResponse.parse(payout));
  },
);

router.patch(
  "/account/payout",
  requireProfile,
  async (req, res): Promise<void> => {
    const profile = getRequestProfile(req);
    const parsed = UpdatePayoutAccountBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const routingLast4 = parsed.data.routingNumber.slice(-4);
    const accountLast4 = parsed.data.accountNumber.slice(-4);
    const { routingNumber, accountNumber, ...rest } = parsed.data;
    const [payout] = await db
      .update(payoutAccountsTable)
      .set({ ...rest, routingLast4, accountLast4, status: "pending" })
      .where(eq(payoutAccountsTable.profileId, profile.id))
      .returning();
    if (!payout) {
      res.status(404).json({ error: "Payout account not found" });
      return;
    }
    res.json(GetPayoutAccountResponse.parse(payout));
  },
);

// ── Compliance (DOT / CDL / FMCSA) ────────────────────────────────────────────
router.get(
  "/account/compliance",
  requireProfile,
  async (req, res): Promise<void> => {
    const profile = getRequestProfile(req);
    const [rec] = await db
      .select()
      .from(dotCdlTable)
      .where(eq(dotCdlTable.profileId, profile.id));
    res.json(rec ?? null);
  },
);

router.post(
  "/account/compliance",
  requireProfile,
  async (req, res): Promise<void> => {
    const profile = getRequestProfile(req);
    const parsed = SubmitComplianceBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const d = parsed.data;
    const values: Record<string, unknown> = {
      dotNumber: d.dotNumber,
      mcNumber: d.mcNumber,
      cdlNumber: d.cdlNumber,
      cdlState: d.cdlState,
      cdlClass: d.cdlClass,
      cdlExpiry: d.cdlExpiry ? new Date(d.cdlExpiry) : undefined,
      status: "pending",
      submittedAt: new Date(),
    };
    const [existing] = await db
      .select()
      .from(dotCdlTable)
      .where(eq(dotCdlTable.profileId, profile.id));
    let rec;
    if (existing) {
      [rec] = await db
        .update(dotCdlTable)
        .set(values)
        .where(eq(dotCdlTable.profileId, profile.id))
        .returning();
    } else {
      [rec] = await db
        .insert(dotCdlTable)
        .values({ ...values, profileId: profile.id })
        .returning();
    }
    res.json(rec);
  },
);

// Staff manually verify carrier DOT/CDL after document review (no live FMCSA API yet).
router.patch(
  "/account/compliance/verify",
  requireStaffOrProfile,
  requirePermission("compliance"),
  async (req, res): Promise<void> => {
    if (!req.staffUser && !req.profile) {
      res.status(403).json({ error: "Staff access required." });
      return;
    }
    const targetProfileId =
      typeof req.body?.profileId === "number"
        ? req.body.profileId
        : req.profile?.id;
    if (!Number.isFinite(targetProfileId)) {
      res
        .status(400)
        .json({ error: "profileId is required for compliance verification." });
      return;
    }
    const now = new Date();
    const [rec] = await db
      .update(dotCdlTable)
      .set({
        dotVerified: true,
        dotVerifiedAt: now,
        cdlVerified: true,
        cdlVerifiedAt: now,
        fmcsaAuthority: "verified",
        insuranceActive: "verified",
        dotOperatingStatus: "verified",
        notSuspended: "verified",
        safetyRating: "Satisfactory",
        complianceCheckedAt: now,
        status: "verified",
      })
      .where(eq(dotCdlTable.profileId, targetProfileId))
      .returning();
    if (!rec) {
      res.status(404).json({
        error: "No compliance record to verify. Submit DOT/CDL details first.",
      });
      return;
    }
    res.json(rec);
  },
);

// ── Credit Application (Customer, for Net invoicing terms) ─────────────────────
router.get(
  "/account/credit-application",
  requireProfile,
  async (req, res): Promise<void> => {
    const profile = getRequestProfile(req);
    const [rec] = await db
      .select()
      .from(creditApplicationsTable)
      .where(eq(creditApplicationsTable.profileId, profile.id));
    if (!rec) {
      res.json(null);
      return;
    }
    res.json({
      ...rec,
      estimatedMonthlySpend: rec.estimatedMonthlySpend
        ? parseFloat(rec.estimatedMonthlySpend)
        : null,
    });
  },
);

router.post(
  "/account/credit-application",
  requireProfile,
  async (req, res): Promise<void> => {
    const profile = getRequestProfile(req);
    const parsed = SubmitCreditApplicationBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const d = parsed.data;
    const values: Record<string, unknown> = {
      wantsInvoicing: d.wantsInvoicing ?? false,
      tradeReferences: d.tradeReferences,
      bankReference: d.bankReference,
      estimatedMonthlySpend:
        d.estimatedMonthlySpend != null
          ? String(d.estimatedMonthlySpend)
          : undefined,
      status: "pending",
    };
    const [existing] = await db
      .select()
      .from(creditApplicationsTable)
      .where(eq(creditApplicationsTable.profileId, profile.id));
    let rec;
    if (existing) {
      [rec] = await db
        .update(creditApplicationsTable)
        .set(values)
        .where(eq(creditApplicationsTable.profileId, profile.id))
        .returning();
    } else {
      [rec] = await db
        .insert(creditApplicationsTable)
        .values({ ...values, profileId: profile.id })
        .returning();
    }
    res.json({
      ...rec,
      estimatedMonthlySpend: rec.estimatedMonthlySpend
        ? parseFloat(rec.estimatedMonthlySpend)
        : null,
    });
  },
);

export default router;
