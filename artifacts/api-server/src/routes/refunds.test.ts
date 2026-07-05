import { describe, it, expect, beforeEach, vi } from "vitest";
import express, { type Express } from "express";
import request from "supertest";

const h = vi.hoisted(() => ({
  rows: new Map<unknown, unknown[]>(),
  updates: [] as Record<string, unknown>[],
  inserts: [] as Record<string, unknown>[],
  updateBase: {} as Record<string, unknown>,
  refundCreate: vi.fn(),
  piRetrieve: vi.fn(),
  staffRole: "accounting" as string | null,
  profile: { id: 99, role: "customer", staffRole: "accounting" } as Record<string, unknown>,
}));

vi.mock("@workspace/db", () => {
  const makeTable = (name: string) =>
    new Proxy({}, { get: (_t, p) => `${name}.${String(p)}` });
  const jobsTable = makeTable("jobs");
  const paymentRefundsTable = makeTable("paymentRefunds");
  const activityTable = makeTable("activity");
  const profilesTable = makeTable("profiles");
  const refundSum = () => {
    const persisted = (h.rows.get(paymentRefundsTable) ?? []) as Array<Record<string, unknown>>;
    const pending = h.inserts.filter((i) => i.amount != null);
    const sum = [...persisted, ...pending]
      .filter((r) => ["pending", "succeeded"].includes(String(r.status)))
      .reduce((s, r) => s + parseFloat(String(r.amount)), 0);
    return [{ total: String(sum) }];
  };
  const db = {
    select: (fields?: Record<string, unknown>) => ({
      from: (table: unknown) => ({
        where: () => {
          if (fields && "total" in fields) {
            return Promise.resolve(refundSum());
          }
          const rows = h.rows.get(table) ?? [];
          const chain: any = Promise.resolve(rows);
          chain.orderBy = () => Promise.resolve(rows);
          chain.limit = () => Promise.resolve(rows);
          return chain;
        },
      }),
    }),
    update: () => ({
      set: (vals: Record<string, unknown>) => {
        h.updates.push(vals);
        return {
          where: () => ({
            returning: () => {
              const base = h.rows.get(paymentRefundsTable)?.[0] ?? h.updateBase;
              return Promise.resolve([{ ...base, ...vals }]);
            },
          }),
        };
      },
    }),
    insert: () => ({
      values: (vals: Record<string, unknown>) => {
        h.inserts.push(vals);
        return {
          returning: () =>
            Promise.resolve([
              {
                id: 1,
                createdAt: new Date("2026-07-01T00:00:00Z"),
                updatedAt: new Date("2026-07-01T00:00:00Z"),
                ...vals,
              },
            ]),
        };
      },
    }),
  };
  return {
    db,
    jobsTable,
    paymentRefundsTable,
    activityTable,
    profilesTable,
  };
});

vi.mock("../lib/stripeClient", () => ({
  getUncachableStripeClient: vi.fn(async () => ({
    paymentIntents: { retrieve: h.piRetrieve },
    refunds: { create: h.refundCreate },
  })),
}));

vi.mock("../middlewares/staffAuth", () => ({
  attachStaffSession: (_req: any, _res: any, next: any) => next(),
  requireStaffOrProfile: (req: any, _res: any, next: any) => {
    req.profile = { ...h.profile };
    next();
  },
}));

vi.mock("../middlewares/requireAuth", () => ({
  attachClerkProfileIfPresent: (req: any, _res: any, next: any) => {
    req.profile = { ...h.profile };
    next();
  },
}));

vi.mock("../middlewares/requireAdmin", async (importActual) => {
  const actual = await importActual<typeof import("../middlewares/requireAdmin")>();
  return {
    ...actual,
    getStaffRole: vi.fn(async () => h.staffRole),
    hasPermission: vi.fn(async (_req: any, perm: string) => perm === "payouts" && !!h.staffRole),
    requirePermission: (perm: string) => (req: any, res: any, next: any) => {
      if (perm === "payouts" && h.staffRole) {
        next();
        return;
      }
      res.status(403).json({ error: `Missing required permission: ${perm}.` });
    },
  };
});

import adminRouter from "./admin";
import {
  deriveJobPaymentStatusAfterRefund,
  issueJobRefund,
  upsertRefundFromStripe,
  handleChargeRefunded,
} from "../lib/refunds";
import {
  handleRefundEvent,
  handleChargeRefundedEvent,
  handleStripeEvent,
} from "../lib/stripeWebhooks";
import { jobsTable, paymentRefundsTable } from "@workspace/db";

function baseJob(overrides: Record<string, unknown> = {}) {
  return {
    id: 10,
    customerId: 1,
    providerId: 2,
    materialType: "gravel",
    status: "completed",
    paymentStatus: "released",
    customerTotalAmount: "115.00",
    providerNetAmount: "100.00",
    refundedAmount: "0",
    refundAttempts: 0,
    stripePaymentIntentId: "pi_test_1",
    stripeTransferId: "tr_test_1",
    releasedAt: new Date("2026-06-01T00:00:00Z"),
    paidAt: new Date("2026-06-01T00:00:00Z"),
    createdAt: new Date("2026-05-01T00:00:00Z"),
    ...overrides,
  };
}

function makeApp(): Express {
  const app = express();
  app.use(express.json());
  app.use(adminRouter);
  return app;
}

beforeEach(() => {
  h.rows.clear();
  h.updates = [];
  h.inserts = [];
  h.updateBase = baseJob();
  h.staffRole = "accounting";
  h.profile = { id: 99, role: "customer", staffRole: "accounting" };
  h.piRetrieve.mockReset();
  h.refundCreate.mockReset();
  h.piRetrieve.mockResolvedValue({
    id: "pi_test_1",
    latest_charge: { id: "ch_test_1" },
  });
  h.refundCreate.mockResolvedValue({
    id: "re_test_1",
    amount: 11500,
    status: "succeeded",
  });
});

describe("deriveJobPaymentStatusAfterRefund", () => {
  it("maps full and partial refunds", () => {
    expect(deriveJobPaymentStatusAfterRefund("115.00", 0)).toBe("released");
    expect(deriveJobPaymentStatusAfterRefund("115.00", 50)).toBe("partially_refunded");
    expect(deriveJobPaymentStatusAfterRefund("115.00", 115)).toBe("refunded");
  });
});

describe("issueJobRefund", () => {
  it("creates a successful full refund and updates job totals", async () => {
    h.rows.set(jobsTable, [baseJob()]);
    h.rows.set(paymentRefundsTable, []);

    const result = await issueJobRefund({
      job: baseJob() as any,
      amountDollars: null,
      reason: "requested_by_customer",
      createdByProfileId: 99,
      createdByStaffUsername: null,
      idempotencyKey: "job-refund:10:1",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.duplicate).toBe(false);
      expect(result.refund.stripeRefundId).toBe("re_test_1");
    }
    expect(h.refundCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        charge: "ch_test_1",
        amount: 11500,
        reverse_transfer: true,
      }),
      { idempotencyKey: "job-refund:10:1" },
    );
    expect(h.inserts.some((i) => i.stripeRefundId === "re_test_1")).toBe(true);
    expect(h.updates.some((u) => u.paymentStatus === "refunded")).toBe(true);
    expect(h.inserts.some((i) => i.type === "payment_refunded")).toBe(true);
  });

  it("returns duplicate when the same idempotency key was already used", async () => {
    const existing = {
      id: 5,
      jobId: 10,
      stripeRefundId: "re_existing",
      stripePaymentIntentId: "pi_test_1",
      stripeChargeId: "ch_test_1",
      amount: "115.00",
      reason: null,
      status: "succeeded",
      createdByProfileId: 99,
      createdByStaffUsername: null,
      idempotencyKey: "job-refund:10:1",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    h.rows.set(paymentRefundsTable, [existing]);

    const result = await issueJobRefund({
      job: baseJob() as any,
      amountDollars: null,
      reason: null,
      createdByProfileId: 99,
      createdByStaffUsername: null,
      idempotencyKey: "job-refund:10:1",
    });

    expect(result).toEqual({ ok: true, refund: existing, duplicate: true });
    expect(h.refundCreate).not.toHaveBeenCalled();
  });

  it("rejects refund when job is already fully refunded", async () => {
    const result = await issueJobRefund({
      job: baseJob({ paymentStatus: "refunded" }) as any,
      amountDollars: null,
      reason: null,
      createdByProfileId: 99,
      createdByStaffUsername: null,
      idempotencyKey: "job-refund:10:2",
    });
    expect(result).toEqual({
      ok: false,
      code: "already_refunded",
      message: "Job has already been fully refunded.",
    });
  });
});

describe("POST /admin/jobs/:id/refund", () => {
  it("issues a refund for authorized staff", async () => {
    h.rows.set(jobsTable, [baseJob()]);
    h.rows.set(paymentRefundsTable, []);

    const res = await request(makeApp())
      .post("/admin/jobs/10/refund")
      .set("Idempotency-Key", "job-refund:10:1")
      .send({ amount: 50, reason: "requested_by_customer" });

    expect(res.status).toBe(201);
    expect(res.body.refund.amount).toBe(115);
    expect(res.body.duplicate).toBe(false);
  });

  it("rejects unauthorized refund attempts without staff role", async () => {
    h.staffRole = null;
    h.profile = { id: 3, role: "driver", staffRole: null };

    const res = await request(makeApp()).post("/admin/jobs/10/refund").send({});
    expect(res.status).toBe(403);
  });

  it("rejects duplicate full refund with 409", async () => {
    h.rows.set(jobsTable, [baseJob({ paymentStatus: "refunded" })]);

    const res = await request(makeApp()).post("/admin/jobs/10/refund").send({});
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("already_refunded");
  });
});

describe("refund webhooks", () => {
  it("upserts refund.updated and syncs job totals", async () => {
    h.rows.set(jobsTable, [baseJob({ refundedAmount: "0" })]);
    h.rows.set(paymentRefundsTable, []);

    const result = await handleRefundEvent({
      id: "re_webhook_1",
      amount: 5000,
      status: "succeeded",
      charge: "ch_test_1",
      payment_intent: "pi_test_1",
      metadata: { jobId: "10", operatorReason: "partial adjustment" },
    } as any);

    expect(result).toEqual({ handled: true, action: "refund_succeeded" });
    expect(h.inserts.some((i) => i.stripeRefundId === "re_webhook_1")).toBe(true);
    expect(h.updates.some((u) => u.paymentStatus === "partially_refunded")).toBe(true);
  });

  it("ignores duplicate refund.updated deliveries safely", async () => {
    const existing = {
      id: 1,
      jobId: 10,
      stripeRefundId: "re_webhook_1",
      stripePaymentIntentId: "pi_test_1",
      stripeChargeId: "ch_test_1",
      amount: "50.00",
      reason: null,
      status: "succeeded",
      createdByProfileId: null,
      createdByStaffUsername: null,
      idempotencyKey: "webhook:re_webhook_1",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    h.rows.set(jobsTable, [baseJob({ refundedAmount: "50.00", paymentStatus: "partially_refunded" })]);
    h.rows.set(paymentRefundsTable, [existing]);

    const result = await upsertRefundFromStripe({
      id: "re_webhook_1",
      amount: 5000,
      status: "succeeded",
      charge: "ch_test_1",
      payment_intent: "pi_test_1",
      metadata: { jobId: "10" },
    } as any);

    expect(result?.stripeRefundId).toBe("re_webhook_1");
    expect(h.inserts.filter((i) => i.stripeRefundId === "re_webhook_1")).toHaveLength(0);
  });

  it("handles charge.refunded and updates database state", async () => {
    h.rows.set(jobsTable, [baseJob()]);

    const result = await handleChargeRefundedEvent({
      id: "ch_test_1",
      amount_refunded: 11500,
      metadata: { jobId: "10" },
      payment_intent: "pi_test_1",
    } as any);

    expect(result).toEqual({ handled: true, action: "charge_refunded_synced" });
    expect(h.updates.at(-1)).toMatchObject({
      refundedAmount: "115.00",
      paymentStatus: "refunded",
    });
  });

  it("routes refund events through handleStripeEvent", async () => {
    h.rows.set(jobsTable, [baseJob()]);
    h.rows.set(paymentRefundsTable, []);

    const created = await handleStripeEvent({
      type: "refund.created",
      data: {
        object: {
          id: "re_evt_1",
          amount: 2500,
          status: "pending",
          charge: "ch_test_1",
          payment_intent: "pi_test_1",
          metadata: { jobId: "10" },
        },
      },
    } as any);
    expect(created).toEqual({ handled: true, action: "refund_pending" });
  });
});

describe("GET /admin/jobs/:id/payment-history", () => {
  it("returns original payment, refunds, balance, and timeline", async () => {
    h.rows.set(jobsTable, [baseJob({ refundedAmount: "50.00", paymentStatus: "partially_refunded" })]);
    h.rows.set(paymentRefundsTable, [
      {
        id: 1,
        jobId: 10,
        stripeRefundId: "re_1",
        stripePaymentIntentId: "pi_test_1",
        stripeChargeId: "ch_test_1",
        amount: "50.00",
        reason: "requested_by_customer",
        status: "succeeded",
        createdByProfileId: 99,
        createdByStaffUsername: null,
        idempotencyKey: "job-refund:10:1",
        createdAt: new Date("2026-07-02T00:00:00Z"),
        updatedAt: new Date("2026-07-02T00:00:00Z"),
      },
    ]);

    const res = await request(makeApp()).get("/admin/jobs/10/payment-history");
    expect(res.status).toBe(200);
    expect(res.body.originalPayment.amount).toBe(115);
    expect(res.body.refunds).toHaveLength(1);
    expect(res.body.currentBalance).toBe(65);
    expect(res.body.timeline).toHaveLength(2);
    expect(res.body.timeline[1].type).toBe("refund");
  });
});
