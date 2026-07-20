import { describe, it, expect, beforeEach, vi } from "vitest";
import express, { type Express } from "express";
import request from "supertest";

/**
 * End-to-end coverage for the customer-facing ACH (us_bank_account) capture flow,
 * mirroring the card-capture coverage in jobs.test.ts but for the bank rail.
 *
 * The flow under test spans two routers:
 *   1. account.ts  — POST /account/payment-method/bank-setup-intent mints a
 *      us_bank_account SetupIntent, then POST/PATCH /account/payment-method
 *      persists the resulting pm_… (Stripe-derived bank metadata, card columns
 *      nulled).
 *   2. jobs.ts     — POST /jobs/:id/charge charges that saved instrument
 *      off-session on the ACH rail (payment_method_types: ["us_bank_account"]).
 *
 * Stripe's browser-side collect/confirm (Financial Connections) can't run in
 * node, so the test represents the minted pm_… and exercises every server step
 * the real flow hits: SetupIntent creation, attach + read-back from Stripe,
 * persistence, and the off-session charge.
 */

/** Shared, mutable state for the hoisted db/Stripe mock factories. */
const h = vi.hoisted(() => ({
  /** Seeded/inserted rows keyed by table token. */
  store: new Map<unknown, any[]>(),
  /** Auto-increment id for inserted rows. */
  nextId: 1000,
  /** Every db.insert().values(...) payload, in call order. */
  inserts: [] as { table: unknown; vals: Record<string, unknown> }[],
  /** Every db.update().set(...) payload, in call order. */
  updates: [] as { table: unknown; vals: Record<string, unknown> }[],
}));

vi.mock("@workspace/db", () => {
  const makeTable = (name: string) =>
    new Proxy({}, { get: (_t, p) => `${name}.${String(p)}` });

  const rowsFor = (table: unknown) => h.store.get(table) ?? [];

  const db = {
    select: () => ({
      from: (table: unknown) => {
        const resolve = () => Promise.resolve(rowsFor(table));
        // Most reads are select().from().where(); a few add .orderBy(). Both
        // resolve to the seeded rows for the table (filters are no-ops here).
        const chain: any = {
          where: () => ({ ...thenable(rowsFor(table)), orderBy: resolve }),
          orderBy: resolve,
          leftJoin: () => chain,
          innerJoin: () => chain,
          then: (r: any) => r(rowsFor(table)),
        };
        return chain;
      },
    }),
    insert: (table: unknown) => ({
      values: (vals: Record<string, unknown>) => {
        const row = { id: h.nextId++, createdAt: new Date(), ...vals };
        const rows = rowsFor(table);
        rows.push(row);
        h.store.set(table, rows);
        h.inserts.push({ table, vals });
        return thenable([row]);
      },
    }),
    update: (table: unknown) => ({
      set: (vals: Record<string, unknown>) => {
        h.updates.push({ table, vals });
        return {
          where: () => {
            const rows = rowsFor(table);
            if (rows[0]) Object.assign(rows[0], vals);
            const merged = rows[0] ? [rows[0]] : [{ ...vals }];
            return thenable(merged);
          },
        };
      },
    }),
  };

  /** A value that is both awaitable and exposes .returning() (Drizzle shape). */
  function thenable(value: any) {
    return {
      then: (resolve: any) => resolve(value),
      returning: () => Promise.resolve(value),
    };
  }

  return {
    db,
    // Every table token imported by account.ts and jobs.ts. Tokens are opaque
    // strings; the db mock keys its store by identity, so unused ones are inert.
    jobsTable: makeTable("jobs"),
    profilesTable: makeTable("profiles"),
    requestsTable: makeTable("requests"),
    activityTable: makeTable("activity"),
    paymentMethodsTable: makeTable("paymentMethods"),
    ticketsTable: makeTable("tickets"),
    trucksTable: makeTable("trucks"),
    jobStatusUpdatesTable: makeTable("jobStatusUpdates"),
    w9SubmissionsTable: makeTable("w9Submissions"),
    insuranceSubmissionsTable: makeTable("insuranceSubmissions"),
    payoutAccountsTable: makeTable("payoutAccounts"),
    dotCdlTable: makeTable("dotCdl"),
    creditApplicationsTable: makeTable("creditApplications"),
  };
});

// Provider payout-readiness is validated live from Stripe in prod; stub it green
// (its own unit tests live in lib/payoutStatus.test.ts).
vi.mock("../lib/payoutStatus", async (importActual) => {
  const actual = await importActual<typeof import("../lib/payoutStatus")>();
  return {
    ...actual,
    checkProviderPayoutReadiness: vi.fn(async () => ({ ok: true, stripeAccountId: "acct_provider_ok" })),
  };
});

vi.mock("../lib/stripeClient", () => ({
  getUncachableStripeClient: vi.fn(),
  getStripePublishableKey: vi.fn(async () => "pk_test_e2e"),
}));

// Authenticated customer (id 1) with a Stripe Customer already provisioned, so
// ensureStripeCustomerId returns it without minting a new one.
vi.mock("../middlewares/staffAuth", () => ({
  attachStaffSession: (_req: any, _res: any, next: any) => next(),
  requireStaffOrProfile: (req: any, _res: any, next: any) => {
    req.profile = req.profile ?? {
      id: 1,
      stripeCustomerId: CUSTOMER_STRIPE_ID,
      email: "ops@acme.test",
      companyName: "Acme Hauling",
      contactName: "Acme Owner",
    };
    next();
  },
}));

vi.mock("../middlewares/requireAuth", () => ({
  attachClerkProfileIfPresent: (req: any, _res: any, next: any) => {
    req.profile = {
      id: 1,
      stripeCustomerId: CUSTOMER_STRIPE_ID,
      email: "ops@acme.test",
      companyName: "Acme Hauling",
      contactName: "Acme Owner",
    };
    next();
  },
  requireAuth: (_req: any, _res: any, next: any) => next(),
  requireProfile: (req: any, _res: any, next: any) => {
    req.profile = {
      id: 1,
      stripeCustomerId: CUSTOMER_STRIPE_ID,
      email: "ops@acme.test",
      companyName: "Acme Hauling",
      contactName: "Acme Owner",
    };
    next();
  },
  getRequestProfile: (req: any) => req.profile,
}));

import accountRouter from "./account";
import jobsRouter from "./jobs";
import { jobsTable, paymentMethodsTable, profilesTable } from "@workspace/db";
import { getUncachableStripeClient } from "../lib/stripeClient";

const CUSTOMER_ID = 1;
const PROVIDER_ID = 2;
const JOB_ID = 10;
const CUSTOMER_STRIPE_ID = "cus_e2e_customer";

function makeApp(): Express {
  const app = express();
  app.use(express.json());
  app.use(accountRouter);
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
    notes: "Use the south gate after 7am.",
    createdAt: new Date("2026-05-01T00:00:00Z"),
    paymentStatus: "unpaid",
    customerTotalAmount: "115.00",
    providerNetAmount: "100.00",
    totalHours: "1",
    paymentAttempts: 0,
    invoicedAt: null,
    ...overrides,
  };
}

/**
 * Stripe mock covering every call the ACH capture→charge chain makes. The bank
 * read-back varies its last4 by pm id so the "switch bank" path can be told
 * apart from the original.
 */
function mockStripe() {
  const setupIntents = {
    create: vi.fn(async (_args: any) => ({ id: "seti_bank_e2e", client_secret: "seti_bank_e2e_secret" })),
    // The save path REQUIRES the SetupIntent that minted the pm and verifies the
    // linkage (si.payment_method === pm.id) — read it back from Stripe. The pm id
    // is derived from the seti id so "switch bank" resolves to the new account.
    retrieve: vi.fn(async (id: string) => ({
      id,
      status: "succeeded",
      customer: CUSTOMER_STRIPE_ID,
      payment_method: id.includes("new") ? "pm_bank_new" : "pm_bank_e2e",
    })),
  };
  const customers = {
    create: vi.fn(async (_args: any) => ({ id: CUSTOMER_STRIPE_ID })),
  };
  const paymentMethods = {
    retrieve: vi.fn(async (id: string) => ({
      id,
      customer: null, // not yet attached → exercises the attach branch
      card: null,
      us_bank_account: {
        bank_name: "STRIPE TEST BANK",
        last4: id.includes("new") ? "6789" : "4321",
        routing_number: "110000000",
      },
    })),
    attach: vi.fn(async (_id: string, _opts: any) => ({})),
  };
  const paymentIntents = {
    create: vi.fn(async (_args: any, _opts?: any) => ({
      id: "pi_ach_e2e",
      status: "succeeded",
      latest_charge: "ch_ach_e2e",
    })),
  };
  const transfers = {
    create: vi.fn(async (_args: any, _opts?: any) => ({ id: "tr_ach_e2e" })),
  };
  vi.mocked(getUncachableStripeClient).mockResolvedValue({
    setupIntents,
    customers,
    paymentMethods,
    paymentIntents,
    transfers,
  } as any);
  return { setupIntents, customers, paymentMethods, paymentIntents, transfers };
}

beforeEach(() => {
  h.store.clear();
  h.inserts = [];
  h.updates = [];
  h.nextId = 1000;
  // Customer (with Stripe id) first so single-row profile reads resolve to it;
  // provider present for company-name enrichment on the charge response.
  h.store.set(profilesTable, [
    { id: CUSTOMER_ID, stripeCustomerId: CUSTOMER_STRIPE_ID, companyName: "Acme Hauling" },
    { id: PROVIDER_ID, stripeCustomerId: null, companyName: "Bob's Trucking" },
  ]);
  vi.mocked(getUncachableStripeClient).mockReset();
});

describe("ACH capture → charge (account page)", () => {
  it("starts a us_bank_account SetupIntent for the bank-setup-intent endpoint", async () => {
    const stripe = mockStripe();

    const res = await request(makeApp()).post("/account/payment-method/bank-setup-intent");

    expect(res.status).toBe(200);
    expect(res.body.clientSecret).toBe("seti_bank_e2e_secret");
    expect(res.body.publishableKey).toBe("pk_test_e2e");

    // The SetupIntent is constrained to the bank rail, off-session, with automatic
    // (instant → micro-deposit fallback) verification.
    const [args] = stripe.setupIntents.create.mock.calls[0];
    expect(args.customer).toBe(CUSTOMER_STRIPE_ID);
    expect(args.payment_method_types).toEqual(["us_bank_account"]);
    expect(args.usage).toBe("off_session");
    expect(args.payment_method_options.us_bank_account.verification_method).toBe("automatic");
  });

  it("connects a bank, persists the us_bank_account PaymentMethod, then charges the ACH job off-session", async () => {
    h.store.set(jobsTable, [baseJob()]);
    h.store.set(paymentMethodsTable, []); // no method yet → POST/insert path
    const stripe = mockStripe();

    // Step 1: server mints the SetupIntent the browser would confirm.
    const setup = await request(makeApp()).post("/account/payment-method/bank-setup-intent");
    expect(setup.status).toBe(200);

    // Step 2: Stripe.js minted pm_bank_e2e; persist it as the saved instrument.
    const save = await request(makeApp())
      .post("/account/payment-method")
      .send({ methodType: "ach", stripePaymentMethodId: "pm_bank_e2e", stripeSetupIntentId: "seti_bank_e2e" });

    expect(save.status).toBe(201);
    expect(save.body.methodType).toBe("ach");
    // Bank metadata is read back FROM Stripe — never trusted from the client.
    expect(save.body.bankName).toBe("STRIPE TEST BANK");
    expect(save.body.accountLast4).toBe("4321");
    expect(save.body.routingLast4).toBe("0000");
    expect(save.body.stripePaymentMethodId).toBe("pm_bank_e2e");
    // The unused card side is nulled so switching method type leaves no stale data.
    expect(save.body.cardBrand ?? null).toBeNull();
    expect(save.body.cardLast4 ?? null).toBeNull();
    // The pm is attached to THIS customer before it is saved.
    expect(stripe.paymentMethods.attach).toHaveBeenCalledWith("pm_bank_e2e", { customer: CUSTOMER_STRIPE_ID });

    // Step 3: charge the completed job — it must hit the ACH rail off-session.
    const charge = await request(makeApp()).post(`/jobs/${JOB_ID}/charge`);

    expect(charge.status).toBe(200);
    expect(charge.body.paymentStatus).toBe("released");

    expect(stripe.paymentIntents.create).toHaveBeenCalledTimes(1);
    const [piArgs, piOpts] = stripe.paymentIntents.create.mock.calls[0];
    expect(piArgs.customer).toBe(CUSTOMER_STRIPE_ID);
    expect(piArgs.payment_method).toBe("pm_bank_e2e");
    expect(piArgs.off_session).toBe(true);
    expect(piArgs.amount).toBe(11500); // gross ($115.00)
    expect(piArgs.payment_method_types).toEqual(["us_bank_account"]);
    expect(piOpts.idempotencyKey).toBe(`job-charge:${JOB_ID}:1`);

    // Only the provider's net is transferred; the 15% broker fee is retained.
    const [trArgs] = stripe.transfers.create.mock.calls[0];
    expect(trArgs.amount).toBe(10000);
    expect(trArgs.destination).toBe("acct_provider_ok");
    expect(trArgs.source_transaction).toBe("ch_ach_e2e");
  });
});

describe("ACH capture → charge (failed-job \"use a different bank\" path)", () => {
  it("replaces the saved bank via PATCH and the retry charges the new account off-session", async () => {
    // A prior instant-terms attempt left the job failed (no invoice) and the
    // customer already had a bank on file — the job-detail flow uses PATCH.
    h.store.set(jobsTable, [baseJob({ paymentStatus: "failed", paymentAttempts: 1 })]);
    h.store.set(paymentMethodsTable, [
      {
        id: 500,
        profileId: CUSTOMER_ID,
        methodType: "ach",
        stripePaymentMethodId: "pm_bank_old",
        bankName: "STRIPE TEST BANK",
        accountLast4: "4321",
        routingLast4: "0000",
        createdAt: new Date(),
      },
    ]);
    const stripe = mockStripe();

    // Customer connects a different bank account on the failed job's panel.
    const update = await request(makeApp())
      .patch("/account/payment-method")
      .send({ methodType: "ach", stripePaymentMethodId: "pm_bank_new", stripeSetupIntentId: "seti_bank_new" });

    expect(update.status).toBe(200);
    expect(update.body.methodType).toBe("ach");
    expect(update.body.stripePaymentMethodId).toBe("pm_bank_new");
    expect(update.body.accountLast4).toBe("6789"); // the new account's last4
    expect(stripe.paymentMethods.attach).toHaveBeenCalledWith("pm_bank_new", { customer: CUSTOMER_STRIPE_ID });

    // The persisted instrument now points at the new bank.
    const pmUpdate = h.updates.find((u) => u.table === paymentMethodsTable);
    expect(pmUpdate).toBeTruthy();
    expect((pmUpdate!.vals as any).stripePaymentMethodId).toBe("pm_bank_new");

    // Retrying the charge uses the NEW bank account, still on the ACH rail, and a
    // FRESH idempotency key (attempt #2) so it isn't a replayed decline.
    const retry = await request(makeApp()).post(`/jobs/${JOB_ID}/charge`);

    expect(retry.status).toBe(200);
    expect(retry.body.paymentStatus).toBe("released");

    const [piArgs, piOpts] = stripe.paymentIntents.create.mock.calls[0];
    expect(piArgs.payment_method).toBe("pm_bank_new");
    expect(piArgs.payment_method_types).toEqual(["us_bank_account"]);
    expect(piArgs.off_session).toBe(true);
    expect(piOpts.idempotencyKey).toBe(`job-charge:${JOB_ID}:2`);
  });
});
