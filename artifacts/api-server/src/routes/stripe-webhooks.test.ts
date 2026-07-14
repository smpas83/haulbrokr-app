import { describe, it, expect, beforeEach, vi } from "vitest";
import express, { type Express } from "express";
import request from "supertest";
import Stripe from "stripe";

const h = vi.hoisted(() => ({
  rows: new Map<unknown, unknown[]>(),
  updates: [] as Record<string, unknown>[],
  inserts: [] as Record<string, unknown>[],
  updateBase: {} as Record<string, unknown>,
  readiness: { ok: true, stripeAccountId: "acct_ok" } as
    | { ok: true; stripeAccountId: string }
    | { ok: false; reason: "not_connected" | "not_enabled"; message: string },
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
        return Promise.resolve(undefined);
      },
    }),
  };
  return {
    db,
    jobsTable: makeTable("jobs"),
    payoutAccountsTable: makeTable("payoutAccounts"),
    activityTable: makeTable("activity"),
    stripeWebhookEventsTable: makeTable("stripeWebhookEvents"),
    notificationPreferencesTable: makeTable("notificationPreferences"),
    profilesTable: makeTable("profiles"),
    deviceTokensTable: makeTable("deviceTokens"),
  };
});

vi.mock("../lib/notificationPlatform", () => ({
  notifyUser: vi.fn(async (input: any) => {
    h.inserts.push({
      profileId: input.profileId,
      type: input.type,
      description: input.description,
      relatedId: input.relatedId,
    });
  }),
  recordActivity: vi.fn(async (activity: any) => {
    h.inserts.push(activity);
  }),
}));

vi.mock("../lib/payoutStatus", async (importActual) => {
  const actual = await importActual<typeof import("../lib/payoutStatus")>();
  return {
    ...actual,
    checkProviderPayoutReadiness: vi.fn(async () => h.readiness),
    syncStripeStatus: vi.fn(async () => ({
      charges_enabled: true,
      payouts_enabled: true,
      details_submitted: true,
    })),
  };
});

vi.mock("../lib/payoutRetry", () => ({
  settleConfirmedPayout: vi.fn(async (job: any) => ({
    id: job.id,
    paymentStatus: "released",
    stripeTransferId: "tr_webhook_1",
  })),
}));

vi.mock("../lib/stripeClient", () => ({
  getUncachableStripeClient: vi.fn(async () => ({
    paymentIntents: {
      retrieve: vi.fn(async (id: string) => ({
        id,
        latest_charge: {
          id: "ch_checkout_1",
          transfer: "tr_checkout_1",
        },
      })),
    },
  })),
}));

import stripeWebhooksRouter from "./stripe-webhooks";
import {
  handlePaymentIntentSucceeded,
  handlePaymentIntentPaymentFailed,
  handleCheckoutSessionCompleted,
  handleAccountUpdated,
  handleStripeEvent,
  handleInvoicePaid,
  handlePayoutEvent,
  handleTransferEvent,
} from "../lib/stripeWebhooks";
import { jobsTable, payoutAccountsTable, stripeWebhookEventsTable } from "@workspace/db";
import { checkProviderPayoutReadiness, syncStripeStatus } from "../lib/payoutStatus";
import { settleConfirmedPayout } from "../lib/payoutRetry";

const WEBHOOK_SECRET = "whsec_test_secret";

function makeApp(): Express {
  const app = express();
  app.use(express.raw({ type: "application/json" }));
  app.use(stripeWebhooksRouter);
  return app;
}

function baseJob(overrides: Record<string, unknown> = {}) {
  return {
    id: 10,
    customerId: 1,
    providerId: 2,
    materialType: "gravel",
    status: "completed",
    paymentStatus: "requires_action",
    customerTotalAmount: "115.00",
    providerNetAmount: "100.00",
    paymentAttempts: 1,
    stripePaymentIntentId: "pi_action_1",
    stripeTransferId: null,
    invoicedAt: null,
    ...overrides,
  };
}

beforeEach(() => {
  h.rows.clear();
  h.updates = [];
  h.inserts = [];
  h.updateBase = baseJob();
  h.readiness = { ok: true, stripeAccountId: "acct_ok" };
  process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET;
  vi.mocked(checkProviderPayoutReadiness).mockClear();
  vi.mocked(syncStripeStatus).mockClear();
  vi.mocked(settleConfirmedPayout).mockClear();
});

describe("POST / (stripe webhook route)", () => {
  it("returns 503 when webhook secret is not configured", async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    const res = await request(makeApp())
      .post("/")
      .set("Content-Type", "application/json")
      .send("{}");
    expect(res.status).toBe(503);
  });

  it("returns 400 when Stripe-Signature header is missing", async () => {
    const res = await request(makeApp())
      .post("/")
      .set("Content-Type", "application/json")
      .send("{}");
    expect(res.status).toBe(400);
  });

  it("returns 400 when signature verification fails", async () => {
    const payload = JSON.stringify({ id: "evt_bad", type: "payment_intent.succeeded", data: { object: {} } });
    const res = await request(makeApp())
      .post("/")
      .set("Content-Type", "application/json")
      .set("Stripe-Signature", "bad_sig")
      .send(payload);
    expect(res.status).toBe(400);
  });

  it("processes a verified event and returns the handler result", async () => {
    h.rows.set(jobsTable, [baseJob({ paymentStatus: "released" })]);
    const event = {
      id: "evt_1",
      type: "payment_intent.succeeded",
      data: {
        object: {
          id: "pi_action_1",
          metadata: { jobId: "10" },
        },
      },
    };
    const payload = JSON.stringify(event);
    const signature = Stripe.webhooks.generateTestHeaderString({
      payload,
      secret: WEBHOOK_SECRET,
    });

    const res = await request(makeApp())
      .post("/")
      .set("Content-Type", "application/json")
      .set("Stripe-Signature", signature)
      .send(payload);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      received: true,
      handled: true,
      action: "already_finalized",
    });
  });
});

describe("handlePaymentIntentSucceeded", () => {
  it("is idempotent when the job is already released", async () => {
    h.rows.set(jobsTable, [baseJob({ paymentStatus: "released", stripeTransferId: "tr_existing" })]);
    const result = await handlePaymentIntentSucceeded({
      id: "pi_action_1",
      metadata: { jobId: "10" },
    } as any);
    expect(result).toEqual({ handled: true, action: "already_finalized" });
    expect(settleConfirmedPayout).not.toHaveBeenCalled();
  });

  it("completes the transfer for a requires_action job", async () => {
    h.rows.set(jobsTable, [baseJob()]);
    const result = await handlePaymentIntentSucceeded({
      id: "pi_action_1",
      latest_charge: "ch_1",
      metadata: { jobId: "10" },
    } as any);
    expect(result).toEqual({ handled: true, action: "transfer_completed" });
    expect(settleConfirmedPayout).toHaveBeenCalledWith(
      { id: 10, providerNetAmount: "100.00", paymentAttempts: 1 },
      "acct_ok",
      expect.objectContaining({ id: "pi_action_1" }),
    );
  });

  it("finalizes checkout destination charges without a transfer call", async () => {
    h.rows.set(jobsTable, [baseJob({ paymentStatus: "unpaid", stripePaymentIntentId: null })]);
    const result = await handlePaymentIntentSucceeded({
      id: "pi_checkout_1",
      metadata: { jobId: "10", kind: "checkout" },
      latest_charge: {
        id: "ch_checkout_1",
        transfer: "tr_checkout_1",
      },
    } as any);
    expect(result).toEqual({ handled: true, action: "checkout_finalized" });
    expect(settleConfirmedPayout).not.toHaveBeenCalled();
    expect(h.updates.at(-1)).toMatchObject({
      paymentStatus: "released",
      stripePaymentIntentId: "pi_checkout_1",
      stripeTransferId: "tr_checkout_1",
    });
  });

  it("returns job_not_found when metadata has no job id", async () => {
    const result = await handlePaymentIntentSucceeded({ id: "pi_x", metadata: {} } as any);
    expect(result).toEqual({ handled: false, reason: "job_not_found" });
  });
});

describe("handlePaymentIntentPaymentFailed", () => {
  it("marks the job failed and notifies the customer", async () => {
    h.rows.set(jobsTable, [baseJob({ paymentStatus: "requires_action" })]);
    const result = await handlePaymentIntentPaymentFailed({
      id: "pi_action_1",
      metadata: { jobId: "10" },
    } as any);
    expect(result).toEqual({ handled: true, action: "marked_failed" });
    expect(h.updates.at(-1)).toMatchObject({
      paymentStatus: "failed",
      stripePaymentIntentId: "pi_action_1",
    });
    expect(h.inserts.at(-1)).toMatchObject({
      profileId: 1,
      type: "payment_failed",
      relatedId: 10,
    });
  });

  it("does not overwrite an already released job", async () => {
    h.rows.set(jobsTable, [baseJob({ paymentStatus: "released" })]);
    const result = await handlePaymentIntentPaymentFailed({
      id: "pi_action_1",
      metadata: { jobId: "10" },
    } as any);
    expect(result).toEqual({ handled: true, action: "already_finalized" });
    expect(h.updates).toHaveLength(0);
  });
});

describe("handleCheckoutSessionCompleted", () => {
  it("finalizes a paid checkout session for the job", async () => {
    h.rows.set(jobsTable, [baseJob({ paymentStatus: "unpaid" })]);
    const result = await handleCheckoutSessionCompleted(
      {
        payment_status: "paid",
        payment_intent: "pi_checkout_1",
        metadata: { jobId: "10", kind: "checkout" },
      } as any,
      async (id) =>
        ({
          id,
          latest_charge: { id: "ch_checkout_1", transfer: "tr_checkout_1" },
        }) as any,
    );
    expect(result).toEqual({ handled: true, action: "checkout_session_finalized" });
    expect(h.updates.at(-1)).toMatchObject({
      paymentStatus: "released",
      stripePaymentIntentId: "pi_checkout_1",
      stripeTransferId: "tr_checkout_1",
    });
  });

  it("skips unpaid checkout sessions without changing the job", async () => {
    h.rows.set(jobsTable, [baseJob({ paymentStatus: "unpaid" })]);
    const result = await handleCheckoutSessionCompleted(
      {
        payment_status: "unpaid",
        metadata: { jobId: "10", kind: "checkout" },
      } as any,
      vi.fn(),
    );
    expect(result).toEqual({ handled: true, action: "checkout_unpaid_skipped" });
    expect(h.updates).toHaveLength(0);
  });
});

describe("handleAccountUpdated", () => {
  it("syncs payout status using profileId metadata", async () => {
    const result = await handleAccountUpdated({
      id: "acct_123",
      metadata: { profileId: "42" },
    } as any);
    expect(result).toEqual({ handled: true, action: "payout_status_synced" });
    expect(syncStripeStatus).toHaveBeenCalledWith("acct_123", 42);
  });

  it("falls back to payout_accounts lookup when metadata is missing", async () => {
    h.rows.set(payoutAccountsTable, [{ profileId: 7, stripeAccountId: "acct_123" }]);
    const result = await handleAccountUpdated({ id: "acct_123", metadata: {} } as any);
    expect(result).toEqual({ handled: true, action: "payout_status_synced" });
    expect(syncStripeStatus).toHaveBeenCalledWith("acct_123", 7);
  });
});

describe("handleStripeEvent", () => {
  it("ignores unsupported event types", async () => {
    const result = await handleStripeEvent({
      id: "evt_ignored",
      type: "customer.created",
      data: { object: {} },
    } as any);
    expect(result).toEqual({ handled: false, reason: "ignored_event_type" });
  });

  it("returns duplicate_event when the Stripe event id was already processed", async () => {
    h.rows.set(stripeWebhookEventsTable, [{ stripeEventId: "evt_dup", eventType: "invoice.paid" }]);
    const result = await handleStripeEvent({
      id: "evt_dup",
      type: "invoice.paid",
      data: { object: {} },
    } as any);
    expect(result).toEqual({ handled: true, action: "duplicate_event" });
  });
});

describe("handleInvoicePaid", () => {
  it("marks an invoiced job paid and notifies both parties", async () => {
    h.rows.set(jobsTable, [baseJob({ paymentStatus: "invoiced" })]);
    const result = await handleInvoicePaid({
      id: "in_1",
      amount_paid: 11500,
      metadata: { jobId: "10" },
      payment_intent: "pi_invoice_1",
    } as any);
    expect(result).toEqual({ handled: true, action: "invoice_marked_paid" });
    expect(h.updates.at(-1)).toMatchObject({
      paymentStatus: "paid",
      stripePaymentIntentId: "pi_invoice_1",
    });
    expect(h.inserts.some((i) => i.type === "invoice_paid" && i.profileId === 1)).toBe(true);
    expect(h.inserts.some((i) => i.type === "invoice_paid" && i.profileId === 2)).toBe(true);
  });

  it("is idempotent when already paid", async () => {
    h.rows.set(jobsTable, [baseJob({ paymentStatus: "paid" })]);
    const result = await handleInvoicePaid({
      metadata: { jobId: "10" },
      amount_paid: 100,
    } as any);
    expect(result).toEqual({ handled: true, action: "invoice_already_paid" });
  });
});

describe("handlePayoutEvent", () => {
  it("records a paid Connect payout and notifies the provider", async () => {
    h.rows.set(payoutAccountsTable, [
      { id: 3, profileId: 2, stripeAccountId: "acct_ok", lastPayoutId: null },
    ]);
    const result = await handlePayoutEvent(
      {
        id: "po_1",
        status: "paid",
        amount: 50000,
        arrival_date: 1_700_000_000,
        created: 1_700_000_000,
      } as any,
      "payout.paid",
      "acct_ok",
    );
    expect(result).toEqual({ handled: true, action: "payout_paid" });
    expect(h.updates.at(-1)).toMatchObject({
      lastPayoutId: "po_1",
      lastPayoutStatus: "paid",
      lastPayoutAmount: "500.00",
    });
  });

  it("records a failed payout with failure details", async () => {
    h.rows.set(payoutAccountsTable, [
      { id: 3, profileId: 2, stripeAccountId: "acct_ok", lastPayoutId: null },
    ]);
    const result = await handlePayoutEvent(
      {
        id: "po_fail",
        status: "failed",
        amount: 1000,
        arrival_date: 1_700_000_000,
        created: 1_700_000_000,
        failure_code: "account_closed",
        failure_message: "Bank account closed",
      } as any,
      "payout.failed",
      "acct_ok",
    );
    expect(result.handled).toBe(true);
    expect(h.updates.at(-1)).toMatchObject({
      lastPayoutFailureCode: "account_closed",
      lastPayoutFailureMessage: "Bank account closed",
    });
  });
});

describe("handleTransferEvent", () => {
  it("stores transfer id on the job for transfer.created", async () => {
    h.rows.set(jobsTable, [baseJob({ stripeTransferId: null })]);
    const result = await handleTransferEvent(
      { id: "tr_new", metadata: { jobId: "10" } } as any,
      "transfer.created",
    );
    expect(result).toEqual({ handled: true, action: "transfer_created" });
    expect(h.updates.at(-1)).toMatchObject({ stripeTransferId: "tr_new" });
  });
});
