import { describe, it, expect, beforeEach, vi } from "vitest";
import express, { type Express } from "express";
import request from "supertest";

/**
 * Shared, mutable test state for the (hoisted) `vi.mock` factories.
 * Mirrors the Proxy-table + mocked-Stripe pattern in jobs.test.ts.
 */
const h = vi.hoisted(() => ({
  /** Rows returned by `db.select().from(table).where()`, keyed by table token. */
  rows: new Map<unknown, unknown[]>(),
  /** Base row merged into every `db.update().set(...).returning()` result. */
  updateBase: {} as Record<string, unknown>,
  /** Base row merged into every `db.insert().values(...).returning()` result. */
  insertBase: {} as Record<string, unknown>,
  /** Every payload passed to `db.update().set(...)`, in call order. */
  updates: [] as Record<string, unknown>[],
  /** Every payload passed to `db.insert().values(...)`, in call order. */
  inserts: [] as Record<string, unknown>[],
  /** The authenticated profile injected by the requireProfile mock. */
  profile: {} as Record<string, unknown>,
}));

vi.mock("@workspace/db", () => {
  const makeTable = (name: string) =>
    new Proxy({}, { get: (_t, p) => `${name}.${String(p)}` });
  const db = {
    select: () => ({
      from: (table: unknown) => ({
        where: () => Promise.resolve(h.rows.get(table) ?? []),
      }),
    }),
    update: () => ({
      set: (vals: Record<string, unknown>) => {
        h.updates.push(vals);
        return {
          where: () => ({
            returning: () => Promise.resolve([{ ...h.updateBase, ...vals }]),
          }),
        };
      },
    }),
    insert: () => ({
      values: (vals: Record<string, unknown>) => {
        h.inserts.push(vals);
        return {
          returning: () => Promise.resolve([{ ...h.insertBase, ...vals }]),
        };
      },
    }),
  };
  return {
    db,
    w9SubmissionsTable: makeTable("w9Submissions"),
    insuranceSubmissionsTable: makeTable("insuranceSubmissions"),
    paymentMethodsTable: makeTable("paymentMethods"),
    payoutAccountsTable: makeTable("payoutAccounts"),
    profilesTable: makeTable("profiles"),
    dotCdlTable: makeTable("dotCdl"),
    creditApplicationsTable: makeTable("creditApplications"),
  };
});

vi.mock("../lib/stripeClient", () => ({
  getUncachableStripeClient: vi.fn(),
  getStripePublishableKey: vi.fn(async () => "pk_test_123"),
}));

// Inject an authenticated profile (mutable per test) without Clerk. A fresh copy
// is handed to the route so a route mutation (e.g. caching the new customer id on
// the profile) never leaks back into the shared fixture.
vi.mock("../middlewares/requireAuth", () => ({
  requireAuth: (_req: any, _res: any, next: any) => next(),
  requireProfile: (req: any, _res: any, next: any) => {
    req.profile = { ...h.profile };
    next();
  },
}));

vi.mock("../middlewares/requireAdmin", () => ({
  isAdmin: () => true,
  requireAdmin: (_req: any, _res: any, next: any) => next(),
}));

import accountRouter from "./account";
import { paymentMethodsTable } from "@workspace/db";
import { getUncachableStripeClient, getStripePublishableKey } from "../lib/stripeClient";

const PROFILE_ID = 1;

function makeApp(): Express {
  const app = express();
  app.use(express.json());
  app.use(accountRouter);
  return app;
}

beforeEach(() => {
  h.rows.clear();
  h.updates = [];
  h.inserts = [];
  h.updateBase = { id: 99, profileId: PROFILE_ID, methodType: "credit_card", createdAt: new Date() };
  h.insertBase = { id: 99, createdAt: new Date() };
  h.profile = { id: PROFILE_ID, email: "ops@acme.com", companyName: "Acme Hauling", contactName: "Pat" };
  vi.mocked(getUncachableStripeClient).mockReset();
  vi.mocked(getStripePublishableKey).mockClear();
});

// ── Card capture (setup-intent + set/update payment method) ───────────────────

/**
 * Builds a Stripe client mock covering the card-capture seams: lazy Customer
 * creation, SetupIntent creation, and PaymentMethod retrieve/attach. `pm` is the
 * object returned by paymentMethods.retrieve (set per test to control its
 * `customer` attachment and instrument metadata).
 */
function mockStripe(opts: { newCustomerId?: string; pm?: any } = {}) {
  const customers = {
    create: vi.fn(async (_args: any) => ({ id: opts.newCustomerId ?? "cus_new_1" })),
  };
  const setupIntents = {
    create: vi.fn(async (_args: any) => ({ id: "seti_1", client_secret: "seti_1_secret" })),
  };
  const paymentMethods = {
    retrieve: vi.fn(async (_id: string) => opts.pm),
    attach: vi.fn(async (_id: string, _args: any) => ({})),
  };
  vi.mocked(getUncachableStripeClient).mockResolvedValue({ customers, setupIntents, paymentMethods } as any);
  return { customers, setupIntents, paymentMethods };
}

function cardPm(overrides: Record<string, any> = {}) {
  return {
    id: "pm_card_1",
    customer: null,
    card: { brand: "visa", last4: "4242", exp_month: 12, exp_year: 2030 },
    us_bank_account: null,
    ...overrides,
  };
}

describe("POST /account/payment-method/setup-intent", () => {
  it("creates a Stripe Customer lazily and returns clientSecret + publishableKey", async () => {
    // Profile has no stripeCustomerId yet → a Customer must be minted on demand.
    const stripe = mockStripe({ newCustomerId: "cus_new_42" });

    const res = await request(makeApp()).post("/account/payment-method/setup-intent");

    expect(res.status).toBe(200);
    expect(res.body.clientSecret).toBe("seti_1_secret");
    expect(res.body.publishableKey).toBe("pk_test_123");

    // The Customer is created with the profile's identity for Stripe-side lookup.
    expect(stripe.customers.create).toHaveBeenCalledTimes(1);
    const [custArgs] = stripe.customers.create.mock.calls[0];
    expect(custArgs.email).toBe("ops@acme.com");
    expect(custArgs.name).toBe("Acme Hauling");
    expect(custArgs.metadata).toEqual({ profileId: String(PROFILE_ID) });

    // The new id is persisted on the profile so it is reused next time.
    const persisted = h.updates.find((u) => u.stripeCustomerId === "cus_new_42");
    expect(persisted).toBeTruthy();

    // The SetupIntent is bound to that Customer and saved off-session for reuse.
    expect(stripe.setupIntents.create).toHaveBeenCalledTimes(1);
    const [intentArgs] = stripe.setupIntents.create.mock.calls[0];
    expect(intentArgs.customer).toBe("cus_new_42");
    expect(intentArgs.payment_method_types).toEqual(["card"]);
    expect(intentArgs.usage).toBe("off_session");
  });

  it("reuses an existing stripeCustomerId instead of creating a new Customer", async () => {
    h.profile.stripeCustomerId = "cus_existing_7";
    const stripe = mockStripe();

    const res = await request(makeApp()).post("/account/payment-method/setup-intent");

    expect(res.status).toBe(200);
    // No new Customer is created; the SetupIntent targets the saved one.
    expect(stripe.customers.create).not.toHaveBeenCalled();
    expect(stripe.setupIntents.create.mock.calls[0][0].customer).toBe("cus_existing_7");
    // The profile is not re-written with a customer id it already has.
    expect(h.updates.some((u) => "stripeCustomerId" in u)).toBe(false);
  });

  it("returns 502 when Stripe fails to start card setup", async () => {
    vi.mocked(getUncachableStripeClient).mockRejectedValue(new Error("Stripe is down"));

    const res = await request(makeApp()).post("/account/payment-method/setup-intent");

    expect(res.status).toBe(502);
    expect(res.body.error).toBe("Stripe is down");
  });
});

describe("POST /account/payment-method (stripePaymentMethodId)", () => {
  it("derives brand/last4/exp from Stripe and ignores client-supplied card metadata", async () => {
    h.profile.stripeCustomerId = "cus_real_1";
    h.rows.set(paymentMethodsTable, []); // no existing method → POST allowed
    const stripe = mockStripe({ pm: cardPm({ customer: "cus_real_1" }) });

    const res = await request(makeApp())
      .post("/account/payment-method")
      .send({
        methodType: "credit_card",
        stripePaymentMethodId: "pm_card_1",
        // Bogus client-supplied values that must be overwritten by Stripe truth.
        cardBrand: "amex",
        cardLast4: "0000",
        cardExpMonth: "01",
        cardExpYear: "2000",
      });

    expect(res.status).toBe(201);

    const inserted = h.inserts[0];
    expect(inserted.stripePaymentMethodId).toBe("pm_card_1");
    // Persisted card details come FROM Stripe, never from the request body.
    expect(inserted.cardBrand).toBe("visa");
    expect(inserted.cardLast4).toBe("4242");
    expect(inserted.cardExpMonth).toBe("12");
    expect(inserted.cardExpYear).toBe("2030");
    // The PM already belongs to this customer, so no re-attach is attempted.
    expect(stripe.paymentMethods.attach).not.toHaveBeenCalled();
  });

  it("attaches an unattached PaymentMethod to the profile's Customer", async () => {
    h.profile.stripeCustomerId = "cus_real_1";
    h.rows.set(paymentMethodsTable, []);
    const stripe = mockStripe({ pm: cardPm({ customer: null }) });

    const res = await request(makeApp())
      .post("/account/payment-method")
      .send({ methodType: "credit_card", stripePaymentMethodId: "pm_card_1" });

    expect(res.status).toBe(201);
    expect(stripe.paymentMethods.attach).toHaveBeenCalledTimes(1);
    const [attachId, attachArgs] = stripe.paymentMethods.attach.mock.calls[0];
    expect(attachId).toBe("pm_card_1");
    expect(attachArgs.customer).toBe("cus_real_1");
  });

  it("rejects a PaymentMethod attached to a different customer (400)", async () => {
    h.profile.stripeCustomerId = "cus_real_1";
    h.rows.set(paymentMethodsTable, []);
    const stripe = mockStripe({ pm: cardPm({ customer: "cus_someone_else" }) });

    const res = await request(makeApp())
      .post("/account/payment-method")
      .send({ methodType: "credit_card", stripePaymentMethodId: "pm_card_1" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/does not belong to this account/i);
    // The foreign instrument is never attached or stored.
    expect(stripe.paymentMethods.attach).not.toHaveBeenCalled();
    expect(h.inserts).toHaveLength(0);
  });
});

describe("PATCH /account/payment-method (stripePaymentMethodId)", () => {
  it("derives card metadata from Stripe on update and ignores client-supplied values", async () => {
    h.profile.stripeCustomerId = "cus_real_1";
    const stripe = mockStripe({ pm: cardPm({ id: "pm_card_2", customer: "cus_real_1", card: { brand: "mastercard", last4: "5454", exp_month: 6, exp_year: 2031 } }) });

    const res = await request(makeApp())
      .patch("/account/payment-method")
      .send({
        methodType: "credit_card",
        stripePaymentMethodId: "pm_card_2",
        cardBrand: "discover",
        cardLast4: "1111",
      });

    expect(res.status).toBe(200);
    const updated = h.updates.find((u) => u.stripePaymentMethodId === "pm_card_2");
    expect(updated).toBeTruthy();
    expect(updated!.cardBrand).toBe("mastercard");
    expect(updated!.cardLast4).toBe("5454");
    expect(updated!.cardExpMonth).toBe("6");
    expect(updated!.cardExpYear).toBe("2031");
    expect(stripe.paymentMethods.attach).not.toHaveBeenCalled();
  });

  it("rejects updating to a PaymentMethod owned by another customer (400)", async () => {
    h.profile.stripeCustomerId = "cus_real_1";
    mockStripe({ pm: cardPm({ id: "pm_card_2", customer: "cus_someone_else" }) });

    const res = await request(makeApp())
      .patch("/account/payment-method")
      .send({ methodType: "credit_card", stripePaymentMethodId: "pm_card_2" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/does not belong to this account/i);
    expect(h.updates.some((u) => u.stripePaymentMethodId === "pm_card_2")).toBe(false);
  });
});

// ── ACH micro-deposit verification ────────────────────────────────────────────

function pendingAchPm(overrides: Record<string, unknown> = {}) {
  return {
    id: 5,
    profileId: PROFILE_ID,
    methodType: "ach",
    stripePaymentMethodId: "pm_bank_1",
    stripeSetupIntentId: "seti_123",
    verificationStatus: "pending",
    bankName: "Test Bank",
    accountLast4: "6789",
    createdAt: new Date("2026-06-01T00:00:00Z"),
    ...overrides,
  };
}

/** Stripe mock whose verifyMicrodeposits resolves to the given status (or throws). */
function mockMicrodepositStripe(opts: { status?: string; throwMessage?: string } = {}) {
  const verifyMicrodeposits = vi.fn(async () => {
    if (opts.throwMessage) throw new Error(opts.throwMessage);
    return { id: "seti_123", status: opts.status ?? "succeeded" };
  });
  vi.mocked(getUncachableStripeClient).mockResolvedValue({ setupIntents: { verifyMicrodeposits } } as any);
  return { verifyMicrodeposits };
}

const VERIFY = "/account/payment-method/verify-microdeposits";

describe("POST /account/payment-method/verify-microdeposits", () => {
  beforeEach(() => {
    h.updateBase = pendingAchPm();
  });

  it("verifies with deposit amounts and marks the method verified", async () => {
    h.rows.set(paymentMethodsTable, [pendingAchPm()]);
    const { verifyMicrodeposits } = mockMicrodepositStripe({ status: "succeeded" });

    const res = await request(makeApp()).post(VERIFY).send({ amounts: [32, 45] });

    expect(res.status).toBe(200);
    expect(res.body.verificationStatus).toBe("verified");
    expect(verifyMicrodeposits).toHaveBeenCalledWith("seti_123", { amounts: [32, 45] });
    expect(h.updates[0]).toEqual({ verificationStatus: "verified" });
  });

  it("verifies with a descriptor code", async () => {
    h.rows.set(paymentMethodsTable, [pendingAchPm()]);
    const { verifyMicrodeposits } = mockMicrodepositStripe({ status: "succeeded" });

    const res = await request(makeApp()).post(VERIFY).send({ descriptorCode: "sm11aa" });

    expect(res.status).toBe(200);
    expect(verifyMicrodeposits).toHaveBeenCalledWith("seti_123", { descriptor_code: "sm11aa" });
  });

  it("rejects when both amounts and a descriptor code are supplied", async () => {
    h.rows.set(paymentMethodsTable, [pendingAchPm()]);
    mockMicrodepositStripe();

    const res = await request(makeApp()).post(VERIFY).send({ amounts: [32, 45], descriptorCode: "sm11aa" });

    expect(res.status).toBe(400);
    expect(getUncachableStripeClient).not.toHaveBeenCalled();
  });

  it("rejects when neither amounts nor a code are supplied", async () => {
    h.rows.set(paymentMethodsTable, [pendingAchPm()]);

    const res = await request(makeApp()).post(VERIFY).send({});

    expect(res.status).toBe(400);
    expect(getUncachableStripeClient).not.toHaveBeenCalled();
  });

  it("returns 404 when there is no pending ACH method", async () => {
    h.rows.set(paymentMethodsTable, [pendingAchPm({ verificationStatus: "verified" })]);

    const res = await request(makeApp()).post(VERIFY).send({ amounts: [32, 45] });

    expect(res.status).toBe(404);
    expect(getUncachableStripeClient).not.toHaveBeenCalled();
  });

  it("returns 404 when no payment method exists", async () => {
    const res = await request(makeApp()).post(VERIFY).send({ amounts: [32, 45] });

    expect(res.status).toBe(404);
  });

  it("returns 400 when Stripe rejects the amounts", async () => {
    h.rows.set(paymentMethodsTable, [pendingAchPm()]);
    mockMicrodepositStripe({ throwMessage: "The amounts provided do not match." });

    const res = await request(makeApp()).post(VERIFY).send({ amounts: [11, 22] });

    expect(res.status).toBe(400);
    expect(h.updates).toHaveLength(0);
  });

  it("returns 400 when verification does not reach succeeded", async () => {
    h.rows.set(paymentMethodsTable, [pendingAchPm()]);
    mockMicrodepositStripe({ status: "requires_action" });

    const res = await request(makeApp()).post(VERIFY).send({ amounts: [32, 45] });

    expect(res.status).toBe(400);
    expect(h.updates).toHaveLength(0);
  });
});
