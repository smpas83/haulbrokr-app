import { describe, it, expect, beforeEach, vi } from "vitest";
import express, { type Express } from "express";
import request from "supertest";
import { PAYOUTS_NOT_CONNECTED_MSG, PAYOUTS_NOT_ENABLED_MSG } from "../lib/payoutStatus";

/**
 * Shared, mutable test state for the (hoisted) `vi.mock` factories.
 */
const h = vi.hoisted(() => ({
  /** Rows returned by `db.select().from(table).where()`, keyed by table token. */
  rows: new Map<unknown, unknown[]>(),
  /** Controls what the payout-readiness guard reports for a test. */
  readiness: { ok: true, stripeAccountId: "acct_ok" } as
    | { ok: true; stripeAccountId: string }
    | { ok: false; reason: "not_connected" | "not_enabled"; message: string },
  /** Base row merged into every `db.update().set(...).returning()` result. */
  updateBase: {} as Record<string, unknown>,
  /** Every payload passed to `db.update().set(...)`, in call order. */
  updates: [] as Record<string, unknown>[],
  /** Every payload passed to `db.insert().values(...)`, in call order. */
  inserts: [] as Record<string, unknown>[],
}));

vi.mock("@workspace/db", () => {
  const makeTable = (name: string) =>
    new Proxy({}, { get: (_t, p) => `${name}.${String(p)}` });
  const jobsTable = makeTable("jobs");
  const paymentMethodsTable = makeTable("paymentMethods");
  const creditApplicationsTable = makeTable("creditApplications");
  const profilesTable = makeTable("profiles");
  const requestsTable = makeTable("requests");
  const activityTable = makeTable("activity");
  const paymentHistoryTable = makeTable("paymentHistory");
  const invoiceDocumentsTable = makeTable("invoiceDocuments");
  const vendorPayoutsTable = makeTable("vendorPayouts");
  const driverEarningsTable = makeTable("driverEarnings");
  const driverWalletTable = makeTable("driverWallet");
  const refundHistoryTable = makeTable("refundHistory");
  const ticketsTable = makeTable("tickets");
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
        return Promise.resolve(undefined);
      },
    }),
  };
  return {
    db,
    jobsTable,
    paymentMethodsTable,
    creditApplicationsTable,
    profilesTable,
    requestsTable,
    activityTable,
    paymentHistoryTable,
    invoiceDocumentsTable,
    vendorPayoutsTable,
    driverEarningsTable,
    driverWalletTable,
    refundHistoryTable,
    ticketsTable,
  };
});

// Isolate the route under test from the live Stripe/db readiness check; that
// function has its own unit tests in lib/payoutStatus.test.ts.
vi.mock("../lib/payoutStatus", async (importActual) => {
  const actual = await importActual<typeof import("../lib/payoutStatus")>();
  return {
    ...actual,
    checkProviderPayoutReadiness: vi.fn(async () => h.readiness),
  };
});

vi.mock("../lib/stripeClient", () => ({
  getUncachableStripeClient: vi.fn(),
  getStripePublishableKey: vi.fn(async () => "pk_test_123"),
}));

// Inject an authenticated customer profile (id 1) without Clerk.
vi.mock("../middlewares/requireAuth", () => ({
  requireAuth: (_req: any, _res: any, next: any) => next(),
  requireProfile: (req: any, _res: any, next: any) => {
    req.profile = { id: 1 };
    next();
  },
  getRequestProfile: (req: any) => req.profile,
}));

import jobsRouter, { computeBreakdown } from "./jobs";
import { jobsTable, paymentMethodsTable, creditApplicationsTable, profilesTable } from "@workspace/db";
import { getUncachableStripeClient } from "../lib/stripeClient";

const CUSTOMER_ID = 1;
const PROVIDER_ID = 2;
const JOB_ID = 10;

function makeApp(): Express {
  const app = express();
  app.use(express.json());
  app.use(jobsRouter);
  return app;
}

function baseJob(overrides: Record<string, unknown> = {}) {
  return {
    id: JOB_ID,
    requestId: 5,
    bidId: 7,
    customerId: CUSTOMER_ID,
    providerId: PROVIDER_ID,
    ratePerHour: "100.00",
    trucksAssigned: 1,
    status: "completed",
    materialType: "gravel",
    truckType: "dump_truck",
    pickupAddress: "1 Pit Rd",
    deliveryAddress: "2 Site Ave",
    scheduledDate: new Date("2026-06-01T00:00:00Z"),
    startTime: "08:00",
    estimatedHours: "8",
    createdAt: new Date("2026-05-01T00:00:00Z"),
    paymentStatus: "pending",
    customerTotalAmount: "115.00",
    providerNetAmount: "100.00",
    totalHours: "1",
    ...overrides,
  };
}

beforeEach(() => {
  h.rows.clear();
  h.readiness = { ok: true, stripeAccountId: "acct_ok" };
  h.updateBase = baseJob();
  h.updates = [];
  h.inserts = [];
  vi.mocked(getUncachableStripeClient).mockReset();
});

/** Builds a Stripe client mock whose create() calls return fixed ids. */
function mockStripe(ids = { paymentIntentId: "pi_test_1", chargeId: "ch_test_1", transferId: "tr_test_1" }) {
  const paymentIntents = {
    create: vi.fn(async (_args: any, _opts?: any) => ({ id: ids.paymentIntentId, latest_charge: ids.chargeId })),
  };
  const transfers = {
    create: vi.fn(async (_args: any, _opts?: any) => ({ id: ids.transferId })),
  };
  vi.mocked(getUncachableStripeClient).mockResolvedValue({ paymentIntents, transfers } as any);
  return { paymentIntents, transfers };
}

/**
 * Builds a Stripe client mock that simulates a real failure: the named step
 * rejects while the other (if reached) would succeed. Used to exercise the
 * 502 + paymentStatus:"failed" catch branch in charge/release.
 */
function mockStripeFailure(failAt: "paymentIntent" | "transfer", message = "Stripe is down") {
  const paymentIntents = {
    create: vi.fn(async (_args: any, _opts?: any) => {
      if (failAt === "paymentIntent") throw new Error(message);
      return { id: "pi_test_1", latest_charge: "ch_test_1" };
    }),
  };
  const transfers = {
    create: vi.fn(async (_args: any, _opts?: any) => {
      if (failAt === "transfer") throw new Error(message);
      return { id: "tr_test_1" };
    }),
  };
  vi.mocked(getUncachableStripeClient).mockResolvedValue({ paymentIntents, transfers } as any);
  return { paymentIntents, transfers };
}

/**
 * Builds a Stripe client mock whose off-session charge throws Stripe's
 * `authentication_required` error (the failed PaymentIntent attached), and whose
 * retrieve() returns a now-succeeded intent — simulating the customer having
 * completed bank authentication on-session.
 */
function mockStripeAuthRequired(pi = { id: "pi_auth_1", client_secret: "pi_auth_1_secret", latest_charge: "ch_auth_1" }) {
  const paymentIntents = {
    create: vi.fn(async (_args: any, _opts?: any) => {
      const err: any = new Error("This payment requires authentication.");
      err.code = "authentication_required";
      err.payment_intent = { id: pi.id, client_secret: pi.client_secret };
      throw err;
    }),
    retrieve: vi.fn(async (_id: string) => ({ id: pi.id, client_secret: pi.client_secret, status: "succeeded", latest_charge: pi.latest_charge })),
  };
  const transfers = {
    create: vi.fn(async (_args: any, _opts?: any) => ({ id: "tr_auth_1" })),
  };
  vi.mocked(getUncachableStripeClient).mockResolvedValue({ paymentIntents, transfers } as any);
  return { paymentIntents, transfers };
}

const notReadyCases = [
  { reason: "not_connected" as const, message: PAYOUTS_NOT_CONNECTED_MSG },
  { reason: "not_enabled" as const, message: PAYOUTS_NOT_ENABLED_MSG },
];

describe("POST /jobs/:id/charge", () => {
  for (const c of notReadyCases) {
    it(`returns 409 with the guard message when the provider is ${c.reason}`, async () => {
      h.rows.set(jobsTable, [baseJob()]);
      // Instant method (not net terms) → readiness is checked before charging.
      h.rows.set(paymentMethodsTable, [{ profileId: CUSTOMER_ID, methodType: "credit_card" }]);
      h.readiness = { ok: false, reason: c.reason, message: c.message };

      const res = await request(makeApp()).post(`/jobs/${JOB_ID}/charge`);

      expect(res.status).toBe(409);
      expect(res.body.error).toBe(c.message);

      // The provider is proactively alerted that their payout is on hold.
      const alert = h.inserts.find((i) => i.type === "payout_delayed");
      expect(alert).toBeTruthy();
      expect(alert!.profileId).toBe(PROVIDER_ID);
      expect(alert!.relatedId).toBe(JOB_ID);
    });
  }

  it("charges gross, transfers only the net, and marks the job released (instant, provider ready)", async () => {
    h.rows.set(jobsTable, [baseJob()]);
    h.rows.set(paymentMethodsTable, [{ profileId: CUSTOMER_ID, methodType: "credit_card" }]);
    const stripe = mockStripe();

    const res = await request(makeApp()).post(`/jobs/${JOB_ID}/charge`);

    expect(res.status).toBe(200);
    expect(res.body.paymentStatus).toBe("released");

    // Customer is charged the GROSS ($115.00 → 11500 cents) on the platform.
    expect(stripe.paymentIntents.create).toHaveBeenCalledTimes(1);
    const [piArgs] = stripe.paymentIntents.create.mock.calls[0];
    expect(piArgs.amount).toBe(11500);
    expect(piArgs.confirm).toBe(true);

    // Only the NET ($100.00 → 10000 cents) is transferred to the provider; the
    // 15% broker fee is retained on the platform.
    expect(stripe.transfers.create).toHaveBeenCalledTimes(1);
    const [trArgs] = stripe.transfers.create.mock.calls[0];
    expect(trArgs.amount).toBe(10000);
    expect(trArgs.destination).toBe("acct_ok");
    expect(trArgs.source_transaction).toBe("ch_test_1");

    // The Stripe payment-intent + transfer ids are persisted on the job.
    const released = h.updates.find((u) => u.paymentStatus === "released");
    expect(released).toBeTruthy();
    expect(released!.stripePaymentIntentId).toBe("pi_test_1");
    expect(released!.stripeTransferId).toBe("tr_test_1");
    expect(released!.paidAt).toBeInstanceOf(Date);
    expect(released!.releasedAt).toBeInstanceOf(Date);
  });

  it("charges the customer's saved card off-session when a real Stripe instrument is on file", async () => {
    h.rows.set(jobsTable, [baseJob()]);
    h.rows.set(paymentMethodsTable, [
      { profileId: CUSTOMER_ID, methodType: "credit_card", stripePaymentMethodId: "pm_real_123" },
    ]);
    h.rows.set(profilesTable, [{ id: CUSTOMER_ID, stripeCustomerId: "cus_real_123" }]);
    const stripe = mockStripe();

    const res = await request(makeApp()).post(`/jobs/${JOB_ID}/charge`);

    expect(res.status).toBe(200);
    expect(res.body.paymentStatus).toBe("released");

    // The real saved instrument is charged off-session — NOT a test token.
    const [piArgs] = stripe.paymentIntents.create.mock.calls[0];
    expect(piArgs.customer).toBe("cus_real_123");
    expect(piArgs.payment_method).toBe("pm_real_123");
    expect(piArgs.off_session).toBe(true);
    expect(piArgs.amount).toBe(11500);
    expect(piArgs.payment_method_types).toEqual(["card"]);
  });

  it("charges the customer's saved bank account (ACH) off-session when a real Stripe instrument is on file", async () => {
    h.rows.set(jobsTable, [baseJob()]);
    h.rows.set(paymentMethodsTable, [
      { profileId: CUSTOMER_ID, methodType: "ach", stripePaymentMethodId: "pm_bank_real_123" },
    ]);
    h.rows.set(profilesTable, [{ id: CUSTOMER_ID, stripeCustomerId: "cus_real_123" }]);
    const stripe = mockStripe();

    const res = await request(makeApp()).post(`/jobs/${JOB_ID}/charge`);

    expect(res.status).toBe(200);
    expect(res.body.paymentStatus).toBe("released");

    // The real saved us_bank_account instrument is charged off-session on the
    // ACH rail — NOT the dev-only pm_usBankAccount_success test token.
    const [piArgs] = stripe.paymentIntents.create.mock.calls[0];
    expect(piArgs.customer).toBe("cus_real_123");
    expect(piArgs.payment_method).toBe("pm_bank_real_123");
    expect(piArgs.off_session).toBe(true);
    expect(piArgs.payment_method_types).toEqual(["us_bank_account"]);
  });

  it("creates a net-terms invoice without moving money (net_30)", async () => {
    h.rows.set(jobsTable, [baseJob()]);
    h.rows.set(paymentMethodsTable, [{ profileId: CUSTOMER_ID, methodType: "net_30" }]);
    h.rows.set(creditApplicationsTable, [{ profileId: CUSTOMER_ID, status: "approved" }]);
    const stripe = mockStripe();

    const res = await request(makeApp()).post(`/jobs/${JOB_ID}/charge`);

    // The job is invoiced, not paid/released.
    expect(res.status).toBe(200);
    expect(res.body.paymentStatus).toBe("invoiced");

    // No money moves on net terms — payout is deferred until release.
    expect(getUncachableStripeClient).not.toHaveBeenCalled();
    expect(stripe.paymentIntents.create).not.toHaveBeenCalled();
    expect(stripe.transfers.create).not.toHaveBeenCalled();

    // The invoice records when it was issued and a due date ~30 days out.
    const invoiced = h.updates.find((u) => u.paymentStatus === "invoiced");
    expect(invoiced).toBeTruthy();
    expect(invoiced!.invoicedAt).toBeInstanceOf(Date);
    expect(invoiced!.paymentDueDate).toBeInstanceOf(Date);
    const DAY_MS = 24 * 60 * 60 * 1000;
    const deltaMs =
      (invoiced!.paymentDueDate as Date).getTime() - (invoiced!.invoicedAt as Date).getTime();
    expect(deltaMs).toBe(30 * DAY_MS);
  });

  const chargeFailureCases = [
    { failAt: "paymentIntent" as const, label: "paymentIntents.create rejects" },
    { failAt: "transfer" as const, label: "transfers.create rejects" },
  ];
  for (const c of chargeFailureCases) {
    it(`returns 502 and marks the job failed when ${c.label} (instant)`, async () => {
      h.rows.set(jobsTable, [baseJob()]);
      h.rows.set(paymentMethodsTable, [{ profileId: CUSTOMER_ID, methodType: "credit_card" }]);
      const stripe = mockStripeFailure(c.failAt);

      const res = await request(makeApp()).post(`/jobs/${JOB_ID}/charge`);

      // The customer is told the charge failed (bad-gateway, not a 200).
      expect(res.status).toBe(502);
      expect(res.body.error).toBe("Stripe is down");

      // The job is left in a recoverable "failed" state, never "released".
      const failed = h.updates.find((u) => u.paymentStatus === "failed");
      expect(failed).toBeTruthy();
      expect(h.updates.some((u) => u.paymentStatus === "released")).toBe(false);

      // A transfer is never attempted when the charge itself fails.
      if (c.failAt === "paymentIntent") {
        expect(stripe.transfers.create).not.toHaveBeenCalled();
      }

      // The customer is notified in-app, with a link back to the job to retry.
      const note = h.inserts.find((i) => i.type === "payment_failed");
      expect(note).toBeTruthy();
      expect(note!.profileId).toBe(CUSTOMER_ID);
      expect(note!.relatedId).toBe(JOB_ID);
    });
  }

  it("parks the job in requires_action (not failed) when the bank demands re-authentication", async () => {
    h.rows.set(jobsTable, [baseJob()]);
    h.rows.set(paymentMethodsTable, [
      { profileId: CUSTOMER_ID, methodType: "credit_card", stripePaymentMethodId: "pm_real_123" },
    ]);
    h.rows.set(profilesTable, [{ id: CUSTOMER_ID, stripeCustomerId: "cus_real_123" }]);
    const stripe = mockStripeAuthRequired();

    const res = await request(makeApp()).post(`/jobs/${JOB_ID}/charge`);

    // Recoverable, so it is surfaced as a 200 in requires_action — never failed.
    expect(res.status).toBe(200);
    expect(res.body.paymentStatus).toBe("requires_action");

    const action = h.updates.find((u) => u.paymentStatus === "requires_action");
    expect(action).toBeTruthy();
    // The failed PaymentIntent id is stored so the client can confirm it.
    expect(action!.stripePaymentIntentId).toBe("pi_auth_1");

    // No money is moved and the customer is NOT told the payment hard-failed.
    expect(stripe.transfers.create).not.toHaveBeenCalled();
    expect(h.updates.some((u) => u.paymentStatus === "failed")).toBe(false);
    expect(h.inserts.some((i) => i.type === "payment_failed")).toBe(false);

    // The customer IS prompted (distinct from a hard decline) to confirm.
    const note = h.inserts.find((i) => i.type === "payment_requires_action");
    expect(note).toBeTruthy();
    expect(note!.profileId).toBe(CUSTOMER_ID);
    expect(note!.relatedId).toBe(JOB_ID);
  });

  it("retries an instant payment that previously failed and marks it released", async () => {
    // A prior instant-terms attempt left the job "failed" (no invoice on it).
    h.rows.set(jobsTable, [baseJob({ paymentStatus: "failed", invoicedAt: null })]);
    h.rows.set(paymentMethodsTable, [{ profileId: CUSTOMER_ID, methodType: "credit_card" }]);
    const stripe = mockStripe();

    const res = await request(makeApp()).post(`/jobs/${JOB_ID}/charge`);

    expect(res.status).toBe(200);
    expect(res.body.paymentStatus).toBe("released");
    expect(stripe.paymentIntents.create).toHaveBeenCalledTimes(1);
    expect(stripe.transfers.create).toHaveBeenCalledTimes(1);
  });

  it("uses a FRESH idempotency key per attempt so a retry isn't a replayed decline", async () => {
    // The job has already had 1 failed attempt; the retry must be attempt #2 and
    // carry idempotency keys distinct from the first attempt's.
    h.rows.set(jobsTable, [baseJob({ paymentStatus: "failed", invoicedAt: null, paymentAttempts: 1 })]);
    h.rows.set(paymentMethodsTable, [{ profileId: CUSTOMER_ID, methodType: "credit_card" }]);
    const stripe = mockStripe();

    const res = await request(makeApp()).post(`/jobs/${JOB_ID}/charge`);

    expect(res.status).toBe(200);
    const [, piOpts] = stripe.paymentIntents.create.mock.calls[0];
    const [, trOpts] = stripe.transfers.create.mock.calls[0];
    expect(piOpts.idempotencyKey).toBe(`job-charge:${JOB_ID}:2`);
    expect(trOpts.idempotencyKey).toBe(`job-transfer:${JOB_ID}:2`);

    // The bumped attempt count is persisted so the next retry gets a new key.
    const released = h.updates.find((u) => u.paymentStatus === "released");
    expect(released!.paymentAttempts).toBe(2);
  });

  it("persists the bumped attempt count even when the charge fails", async () => {
    h.rows.set(jobsTable, [baseJob({ paymentAttempts: 0 })]);
    h.rows.set(paymentMethodsTable, [{ profileId: CUSTOMER_ID, methodType: "credit_card" }]);
    mockStripeFailure("paymentIntent");

    const res = await request(makeApp()).post(`/jobs/${JOB_ID}/charge`);

    expect(res.status).toBe(502);
    const failed = h.updates.find((u) => u.paymentStatus === "failed");
    expect(failed!.paymentAttempts).toBe(1);
  });

  it("refuses to re-charge a failed job that still has an open invoice", async () => {
    // A failed payout-release leaves "failed" WITH an invoice — must use /release.
    h.rows.set(jobsTable, [baseJob({ paymentStatus: "failed", invoicedAt: new Date() })]);
    h.rows.set(paymentMethodsTable, [{ profileId: CUSTOMER_ID, methodType: "net_30" }]);
    const stripe = mockStripe();

    const res = await request(makeApp()).post(`/jobs/${JOB_ID}/charge`);

    expect(res.status).toBe(409);
    expect(stripe.paymentIntents.create).not.toHaveBeenCalled();
  });

  const dueDateCases = [
    { methodType: "net_15", days: 15 },
    { methodType: "net_45", days: 45 },
  ];
  for (const c of dueDateCases) {
    it(`sets the invoice due date ${c.days} days out for ${c.methodType}`, async () => {
      h.rows.set(jobsTable, [baseJob()]);
      h.rows.set(paymentMethodsTable, [{ profileId: CUSTOMER_ID, methodType: c.methodType }]);
      h.rows.set(creditApplicationsTable, [{ profileId: CUSTOMER_ID, status: "approved" }]);
      const stripe = mockStripe();

      const res = await request(makeApp()).post(`/jobs/${JOB_ID}/charge`);

      expect(res.status).toBe(200);
      expect(res.body.paymentStatus).toBe("invoiced");
      expect(stripe.paymentIntents.create).not.toHaveBeenCalled();
      expect(stripe.transfers.create).not.toHaveBeenCalled();

      const invoiced = h.updates.find((u) => u.paymentStatus === "invoiced");
      expect(invoiced).toBeTruthy();
      const DAY_MS = 24 * 60 * 60 * 1000;
      const deltaMs =
        (invoiced!.paymentDueDate as Date).getTime() - (invoiced!.invoicedAt as Date).getTime();
      expect(deltaMs).toBe(c.days * DAY_MS);
    });
  }
});

describe("POST /jobs/:id/release", () => {
  for (const c of notReadyCases) {
    it(`returns 409 with the guard message when the provider is ${c.reason}`, async () => {
      h.rows.set(jobsTable, [baseJob({ paymentStatus: "invoiced" })]);
      h.readiness = { ok: false, reason: c.reason, message: c.message };

      const res = await request(makeApp()).post(`/jobs/${JOB_ID}/release`);

      expect(res.status).toBe(409);
      expect(res.body.error).toBe(c.message);

      // The provider is proactively alerted that their payout is on hold.
      const alert = h.inserts.find((i) => i.type === "payout_delayed");
      expect(alert).toBeTruthy();
      expect(alert!.profileId).toBe(PROVIDER_ID);
      expect(alert!.relatedId).toBe(JOB_ID);
    });
  }

  it("settles an open net-terms invoice by transferring the net and marking released", async () => {
    h.rows.set(jobsTable, [baseJob({ paymentStatus: "invoiced" })]);
    h.updateBase = baseJob({ paymentStatus: "invoiced" });
    h.rows.set(paymentMethodsTable, [{ profileId: CUSTOMER_ID, methodType: "net_30" }]);
    const stripe = mockStripe();

    const res = await request(makeApp()).post(`/jobs/${JOB_ID}/release`);

    expect(res.status).toBe(200);
    expect(res.body.paymentStatus).toBe("released");

    // Net terms transfer only the provider's net of the retained 15% fee.
    expect(stripe.paymentIntents.create).toHaveBeenCalledTimes(1);
    expect(stripe.paymentIntents.create.mock.calls[0][0].amount).toBe(11500);
    expect(stripe.transfers.create).toHaveBeenCalledTimes(1);
    expect(stripe.transfers.create.mock.calls[0][0].amount).toBe(10000);

    const released = h.updates.find((u) => u.paymentStatus === "released");
    expect(released).toBeTruthy();
    expect(released!.stripePaymentIntentId).toBe("pi_test_1");
    expect(released!.stripeTransferId).toBe("tr_test_1");
  });

  it("charges the saved card off-session when releasing an invoice with a real instrument", async () => {
    h.rows.set(jobsTable, [baseJob({ paymentStatus: "invoiced" })]);
    h.updateBase = baseJob({ paymentStatus: "invoiced" });
    h.rows.set(paymentMethodsTable, [
      { profileId: CUSTOMER_ID, methodType: "credit_card", stripePaymentMethodId: "pm_real_456" },
    ]);
    h.rows.set(profilesTable, [{ id: CUSTOMER_ID, stripeCustomerId: "cus_real_456" }]);
    const stripe = mockStripe();

    const res = await request(makeApp()).post(`/jobs/${JOB_ID}/release`);

    expect(res.status).toBe(200);
    const [piArgs] = stripe.paymentIntents.create.mock.calls[0];
    expect(piArgs.customer).toBe("cus_real_456");
    expect(piArgs.payment_method).toBe("pm_real_456");
    expect(piArgs.off_session).toBe(true);
  });

  const releaseFailureCases = [
    { failAt: "paymentIntent" as const, label: "paymentIntents.create rejects" },
    { failAt: "transfer" as const, label: "transfers.create rejects" },
  ];
  for (const c of releaseFailureCases) {
    it(`returns 502 and marks the job failed when ${c.label}`, async () => {
      h.rows.set(jobsTable, [baseJob({ paymentStatus: "invoiced" })]);
      h.updateBase = baseJob({ paymentStatus: "invoiced" });
      h.rows.set(paymentMethodsTable, [{ profileId: CUSTOMER_ID, methodType: "net_30" }]);
      const stripe = mockStripeFailure(c.failAt);

      const res = await request(makeApp()).post(`/jobs/${JOB_ID}/release`);

      // The release fails loudly (502), not silently as a success.
      expect(res.status).toBe(502);
      expect(res.body.error).toBe("Stripe is down");

      // The invoice is moved to "failed", never to "released".
      const failed = h.updates.find((u) => u.paymentStatus === "failed");
      expect(failed).toBeTruthy();
      expect(h.updates.some((u) => u.paymentStatus === "released")).toBe(false);

      if (c.failAt === "paymentIntent") {
        expect(stripe.transfers.create).not.toHaveBeenCalled();
      }

      // The customer is notified in-app, with a link back to the job to retry.
      const note = h.inserts.find((i) => i.type === "payment_failed");
      expect(note).toBeTruthy();
      expect(note!.profileId).toBe(CUSTOMER_ID);
      expect(note!.relatedId).toBe(JOB_ID);
    });
  }

  it("retries a payout release that previously failed on an open invoice", async () => {
    // A failed release leaves the job "failed" but the invoice is still set.
    h.rows.set(jobsTable, [baseJob({ paymentStatus: "failed", invoicedAt: new Date() })]);
    h.updateBase = baseJob({ paymentStatus: "failed", invoicedAt: new Date() });
    h.rows.set(paymentMethodsTable, [{ profileId: CUSTOMER_ID, methodType: "net_30" }]);
    const stripe = mockStripe();

    const res = await request(makeApp()).post(`/jobs/${JOB_ID}/release`);

    expect(res.status).toBe(200);
    expect(res.body.paymentStatus).toBe("released");
    expect(stripe.paymentIntents.create).toHaveBeenCalledTimes(1);
    expect(stripe.transfers.create).toHaveBeenCalledTimes(1);
  });

  it("retried release uses a fresh idempotency key tied to the new attempt", async () => {
    h.rows.set(jobsTable, [baseJob({ paymentStatus: "failed", invoicedAt: new Date(), paymentAttempts: 1 })]);
    h.updateBase = baseJob({ paymentStatus: "failed", invoicedAt: new Date(), paymentAttempts: 1 });
    h.rows.set(paymentMethodsTable, [{ profileId: CUSTOMER_ID, methodType: "net_30" }]);
    const stripe = mockStripe();

    const res = await request(makeApp()).post(`/jobs/${JOB_ID}/release`);

    expect(res.status).toBe(200);
    expect(stripe.paymentIntents.create.mock.calls[0][1].idempotencyKey).toBe(`job-charge:${JOB_ID}:2`);
    expect(stripe.transfers.create.mock.calls[0][1].idempotencyKey).toBe(`job-transfer:${JOB_ID}:2`);
    const released = h.updates.find((u) => u.paymentStatus === "released");
    expect(released!.paymentAttempts).toBe(2);
  });

  it("rejects a release when there is no open invoice", async () => {
    h.rows.set(jobsTable, [baseJob({ paymentStatus: "pending" })]);

    const res = await request(makeApp()).post(`/jobs/${JOB_ID}/release`);

    expect(res.status).toBe(400);
    expect(getUncachableStripeClient).not.toHaveBeenCalled();
  });

  it("parks an invoice in requires_action and notifies when the bank demands re-authentication", async () => {
    h.rows.set(jobsTable, [baseJob({ paymentStatus: "invoiced" })]);
    h.updateBase = baseJob({ paymentStatus: "invoiced" });
    h.rows.set(paymentMethodsTable, [
      { profileId: CUSTOMER_ID, methodType: "credit_card", stripePaymentMethodId: "pm_real_123" },
    ]);
    h.rows.set(profilesTable, [{ id: CUSTOMER_ID, stripeCustomerId: "cus_real_123" }]);
    const stripe = mockStripeAuthRequired();

    const res = await request(makeApp()).post(`/jobs/${JOB_ID}/release`);

    expect(res.status).toBe(200);
    expect(res.body.paymentStatus).toBe("requires_action");
    expect(stripe.transfers.create).not.toHaveBeenCalled();
    expect(h.updates.some((u) => u.paymentStatus === "failed")).toBe(false);
    expect(h.inserts.some((i) => i.type === "payment_failed")).toBe(false);

    const note = h.inserts.find((i) => i.type === "payment_requires_action");
    expect(note).toBeTruthy();
    expect(note!.profileId).toBe(CUSTOMER_ID);
    expect(note!.relatedId).toBe(JOB_ID);
  });

  it("rejects a release for a failed instant job that never had an invoice", async () => {
    h.rows.set(jobsTable, [baseJob({ paymentStatus: "failed", invoicedAt: null })]);

    const res = await request(makeApp()).post(`/jobs/${JOB_ID}/release`);

    expect(res.status).toBe(400);
    expect(getUncachableStripeClient).not.toHaveBeenCalled();
  });
});

describe("GET /jobs/:id/payment-confirmation", () => {
  it("returns the client secret + publishable key for a job awaiting confirmation", async () => {
    h.rows.set(jobsTable, [baseJob({ paymentStatus: "requires_action", stripePaymentIntentId: "pi_auth_1" })]);
    const stripe = mockStripeAuthRequired();

    const res = await request(makeApp()).get(`/jobs/${JOB_ID}/payment-confirmation`);

    expect(res.status).toBe(200);
    expect(res.body.clientSecret).toBe("pi_auth_1_secret");
    expect(res.body.paymentIntentId).toBe("pi_auth_1");
    expect(typeof res.body.publishableKey).toBe("string");
    expect(stripe.paymentIntents.retrieve).toHaveBeenCalledWith("pi_auth_1");
  });

  it("rejects (409) when the job is not awaiting confirmation", async () => {
    h.rows.set(jobsTable, [baseJob({ paymentStatus: "released" })]);

    const res = await request(makeApp()).get(`/jobs/${JOB_ID}/payment-confirmation`);

    expect(res.status).toBe(409);
  });
});

describe("POST /jobs/:id/confirm-payment", () => {
  it("transfers the net and marks released after the customer re-authenticates", async () => {
    h.rows.set(jobsTable, [baseJob({ paymentStatus: "requires_action", stripePaymentIntentId: "pi_auth_1" })]);
    h.updateBase = baseJob({ paymentStatus: "requires_action", stripePaymentIntentId: "pi_auth_1" });
    const stripe = mockStripeAuthRequired();

    const res = await request(makeApp()).post(`/jobs/${JOB_ID}/confirm-payment`);

    expect(res.status).toBe(200);
    expect(res.body.paymentStatus).toBe("released");

    // The card is NOT re-charged — we only move the net to the provider against
    // the already-succeeded charge.
    expect(stripe.paymentIntents.create).not.toHaveBeenCalled();
    expect(stripe.transfers.create).toHaveBeenCalledTimes(1);
    const [trArgs] = stripe.transfers.create.mock.calls[0];
    expect(trArgs.amount).toBe(10000);
    expect(trArgs.source_transaction).toBe("ch_auth_1");

    const released = h.updates.find((u) => u.paymentStatus === "released");
    expect(released!.stripeTransferId).toBe("tr_auth_1");
    expect(released!.paidAt).toBeInstanceOf(Date);
    expect(released!.releasedAt).toBeInstanceOf(Date);
  });

  it("does NOT re-charge or mark failed when the payout transfer fails after a succeeded charge", async () => {
    h.rows.set(jobsTable, [baseJob({ paymentStatus: "requires_action", stripePaymentIntentId: "pi_auth_1" })]);
    const paymentIntents = {
      create: vi.fn(),
      retrieve: vi.fn(async () => ({ id: "pi_auth_1", status: "succeeded", latest_charge: "ch_auth_1" })),
    };
    const transfers = { create: vi.fn(async () => { throw new Error("Transfer is down"); }) };
    vi.mocked(getUncachableStripeClient).mockResolvedValue({ paymentIntents, transfers } as any);

    const res = await request(makeApp()).post(`/jobs/${JOB_ID}/confirm-payment`);

    expect(res.status).toBe(502);
    // The card is NEVER re-charged — only the transfer was retried and failed.
    expect(paymentIntents.create).not.toHaveBeenCalled();
    // Crucially the job must stay in requires_action (NOT failed), otherwise the
    // /charge retry path would create a brand-new charge and double-bill.
    expect(h.updates.some((u) => u.paymentStatus === "failed")).toBe(false);
    expect(h.updates.some((u) => u.paymentStatus === "released")).toBe(false);
    // The customer is not told their payment failed — it succeeded.
    expect(h.inserts.some((i) => i.type === "payment_failed")).toBe(false);
  });

  it("returns 409 when the PaymentIntent has not succeeded yet", async () => {
    h.rows.set(jobsTable, [baseJob({ paymentStatus: "requires_action", stripePaymentIntentId: "pi_auth_1" })]);
    const paymentIntents = {
      retrieve: vi.fn(async () => ({ id: "pi_auth_1", status: "requires_action", latest_charge: null })),
    };
    const transfers = { create: vi.fn() };
    vi.mocked(getUncachableStripeClient).mockResolvedValue({ paymentIntents, transfers } as any);

    const res = await request(makeApp()).post(`/jobs/${JOB_ID}/confirm-payment`);

    expect(res.status).toBe(409);
    expect(transfers.create).not.toHaveBeenCalled();
    expect(h.updates.some((u) => u.paymentStatus === "released")).toBe(false);
  });

  it("rejects (409) when the job is not awaiting confirmation", async () => {
    h.rows.set(jobsTable, [baseJob({ paymentStatus: "released" })]);

    const res = await request(makeApp()).post(`/jobs/${JOB_ID}/confirm-payment`);

    expect(res.status).toBe(409);
    expect(getUncachableStripeClient).not.toHaveBeenCalled();
  });
});

describe("computeBreakdown (15% broker-fee model)", () => {
  it("splits a clean amount into base, fee, and gross", () => {
    expect(computeBreakdown(100, 1, 0.15)).toEqual({ base: 100, fee: 15, gross: 115 });
  });

  it("keeps the provider net equal to the base (work value)", () => {
    const { base } = computeBreakdown(50, 2.5, 0.15);
    expect(base).toBe(125);
    expect(computeBreakdown(50, 2.5, 0.15)).toEqual({ base: 125, fee: 18.75, gross: 143.75 });
  });

  it("rounds the fee to cents (no sub-cent drift)", () => {
    // 99.99 * 0.15 = 14.9985 → 15.00; gross 99.99 + 15.00 = 114.99
    expect(computeBreakdown(33.33, 3, 0.15)).toEqual({ base: 99.99, fee: 15, gross: 114.99 });
  });

  it("avoids floating-point artifacts in the gross", () => {
    // 19.99 * 0.15 = 2.9985 → 3.00; gross 22.99 (not 22.990000000000002)
    expect(computeBreakdown(19.99, 1, 0.15)).toEqual({ base: 19.99, fee: 3, gross: 22.99 });
  });
});

/**
 * Builds a Stripe client mock exposing checkout.sessions.create/retrieve for the
 * hosted-Checkout flow. `retrieved` shapes what retrieve() returns (payment
 * status, metadata, expanded payment_intent.latest_charge).
 */
function mockStripeCheckout(opts: {
  createUrl?: string | null;
  retrieved?: any;
} = {}) {
  const sessions = {
    create: vi.fn(async (_args: any) => ({ id: "cs_test_1", url: opts.createUrl ?? "https://checkout.stripe.com/c/pay/cs_test_1" })),
    retrieve: vi.fn(async (_id: string, _opts?: any) => opts.retrieved),
  };
  vi.mocked(getUncachableStripeClient).mockResolvedValue({ checkout: { sessions } } as any);
  return { sessions };
}

describe("POST /jobs/:id/checkout-session", () => {
  it("creates a destination-charge Checkout Session: gross line item, 15% application fee, transfer to provider", async () => {
    h.rows.set(jobsTable, [baseJob({ paymentStatus: "unpaid" })]);
    const stripe = mockStripeCheckout();

    const res = await request(makeApp())
      .post(`/jobs/${JOB_ID}/checkout-session`)
      .send({ returnTo: "https://app.replit.dev/job/10" });

    expect(res.status).toBe(200);
    expect(res.body.url).toContain("checkout.stripe.com");

    expect(stripe.sessions.create).toHaveBeenCalledTimes(1);
    const [args] = stripe.sessions.create.mock.calls[0];
    expect(args.mode).toBe("payment");
    // Customer pays the GROSS ($115.00 → 11500 cents).
    expect(args.line_items[0].price_data.unit_amount).toBe(11500);
    // The 15% broker fee ($15.00 → 1500 cents) is the application fee.
    expect(args.payment_intent_data.application_fee_amount).toBe(1500);
    // Net is routed to the provider's connected account (destination charge).
    expect(args.payment_intent_data.transfer_data.destination).toBe("acct_ok");
    expect(args.metadata.jobId).toBe(String(JOB_ID));
    // success/cancel bounce through the return endpoint carrying the allowlisted returnTo.
    expect(args.success_url).toContain("/jobs/checkout-return");
    expect(args.success_url).toContain("session_id={CHECKOUT_SESSION_ID}");
    expect(decodeURIComponent(args.success_url)).toContain("https://app.replit.dev/job/10");
    expect(args.cancel_url).toContain("status=cancel");
  });

  it("returns 409 (no session created) when the job is already released", async () => {
    h.rows.set(jobsTable, [baseJob({ paymentStatus: "released" })]);
    const stripe = mockStripeCheckout();

    const res = await request(makeApp()).post(`/jobs/${JOB_ID}/checkout-session`).send({});

    expect(res.status).toBe(409);
    expect(stripe.sessions.create).not.toHaveBeenCalled();
  });

  it("returns 409 when a payment is awaiting card authentication (requires_action)", async () => {
    h.rows.set(jobsTable, [baseJob({ paymentStatus: "requires_action" })]);
    const stripe = mockStripeCheckout();

    const res = await request(makeApp()).post(`/jobs/${JOB_ID}/checkout-session`).send({});

    expect(res.status).toBe(409);
    expect(stripe.sessions.create).not.toHaveBeenCalled();
  });

  it("returns 400 when the job is not completed", async () => {
    h.rows.set(jobsTable, [baseJob({ status: "in_progress", paymentStatus: "unpaid" })]);
    mockStripeCheckout();

    const res = await request(makeApp()).post(`/jobs/${JOB_ID}/checkout-session`).send({});

    expect(res.status).toBe(400);
  });

  it("returns 409 and alerts the provider when payouts aren't ready", async () => {
    h.rows.set(jobsTable, [baseJob({ paymentStatus: "unpaid" })]);
    h.readiness = { ok: false, reason: "not_enabled", message: PAYOUTS_NOT_ENABLED_MSG };
    const stripe = mockStripeCheckout();

    const res = await request(makeApp()).post(`/jobs/${JOB_ID}/checkout-session`).send({});

    expect(res.status).toBe(409);
    expect(res.body.error).toBe(PAYOUTS_NOT_ENABLED_MSG);
    expect(stripe.sessions.create).not.toHaveBeenCalled();
    expect(h.inserts.find((i) => i.type === "payout_delayed")).toBeTruthy();
  });
});

describe("POST /jobs/:id/verify-checkout", () => {
  it("finalizes a paid session: records the PaymentIntent/transfer and marks the job released", async () => {
    h.rows.set(jobsTable, [baseJob({ paymentStatus: "unpaid" })]);
    mockStripeCheckout({
      retrieved: {
        payment_status: "paid",
        metadata: { jobId: String(JOB_ID) },
        payment_intent: { id: "pi_co_1", latest_charge: { id: "ch_co_1", transfer: "tr_co_1" } },
      },
    });

    const res = await request(makeApp())
      .post(`/jobs/${JOB_ID}/verify-checkout`)
      .send({ sessionId: "cs_test_1" });

    expect(res.status).toBe(200);
    expect(res.body.paymentStatus).toBe("released");
    const released = h.updates.find((u) => u.paymentStatus === "released");
    expect(released).toBeTruthy();
    expect(released!.stripePaymentIntentId).toBe("pi_co_1");
    expect(released!.stripeTransferId).toBe("tr_co_1");
    expect(released!.paidAt).toBeInstanceOf(Date);
    expect(released!.releasedAt).toBeInstanceOf(Date);
  });

  it("is idempotent: an already-released job returns the job without re-processing", async () => {
    h.rows.set(jobsTable, [baseJob({ paymentStatus: "released" })]);
    const stripe = mockStripeCheckout();

    const res = await request(makeApp())
      .post(`/jobs/${JOB_ID}/verify-checkout`)
      .send({ sessionId: "cs_test_1" });

    expect(res.status).toBe(200);
    expect(res.body.paymentStatus).toBe("released");
    // No Stripe call, no write — purely idempotent short-circuit.
    expect(stripe.sessions.retrieve).not.toHaveBeenCalled();
    expect(h.updates).toHaveLength(0);
  });

  it("rejects a session whose metadata jobId belongs to a different job", async () => {
    h.rows.set(jobsTable, [baseJob({ paymentStatus: "unpaid" })]);
    mockStripeCheckout({
      retrieved: { payment_status: "paid", metadata: { jobId: "999" }, payment_intent: { id: "pi_x" } },
    });

    const res = await request(makeApp())
      .post(`/jobs/${JOB_ID}/verify-checkout`)
      .send({ sessionId: "cs_test_1" });

    expect(res.status).toBe(409);
    // Never flips the job; it stays payable.
    expect(h.updates.find((u) => u.paymentStatus === "released")).toBeFalsy();
    expect(h.updates.find((u) => u.paymentStatus === "failed")).toBeFalsy();
  });

  it("leaves the job payable (and never failed) when the session was not paid", async () => {
    h.rows.set(jobsTable, [baseJob({ paymentStatus: "unpaid" })]);
    mockStripeCheckout({
      retrieved: { payment_status: "unpaid", metadata: { jobId: String(JOB_ID) }, payment_intent: null },
    });

    const res = await request(makeApp())
      .post(`/jobs/${JOB_ID}/verify-checkout`)
      .send({ sessionId: "cs_test_1" });

    expect(res.status).toBe(409);
    expect(h.updates.find((u) => u.paymentStatus === "failed")).toBeFalsy();
    expect(h.updates.find((u) => u.paymentStatus === "released")).toBeFalsy();
  });

  it("never marks the job failed if verify throws after a real payment", async () => {
    h.rows.set(jobsTable, [baseJob({ paymentStatus: "unpaid" })]);
    const sessions = {
      create: vi.fn(),
      retrieve: vi.fn(async () => { throw new Error("Stripe timeout"); }),
    };
    vi.mocked(getUncachableStripeClient).mockResolvedValue({ checkout: { sessions } } as any);

    const res = await request(makeApp())
      .post(`/jobs/${JOB_ID}/verify-checkout`)
      .send({ sessionId: "cs_test_1" });

    expect(res.status).toBe(502);
    expect(h.updates.find((u) => u.paymentStatus === "failed")).toBeFalsy();
  });
});
