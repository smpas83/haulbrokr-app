import { describe, it, expect, beforeEach, vi } from "vitest";
import express from "express";
import request from "supertest";

const h = vi.hoisted(() => ({
  job: {
    id: 9,
    customerId: 2,
    providerId: 3,
    paymentStatus: "released",
    stripePaymentIntentId: "pi_refund_test",
    paymentAttempts: 1,
    ratePerHour: "100",
    estimatedHours: "8",
    totalHours: null,
    totalAmount: null,
    platformFeeRate: "0.15",
    platformFeeAmount: null,
    customerTotalAmount: "800",
    providerNetAmount: "680",
  } as any,
  refundsCreate: vi.fn(),
  isAdmin: vi.fn(async () => false),
}));

vi.mock("@workspace/db", () => {
  const jobsTable = { __table: "jobs" };
  const profilesTable = { __table: "profiles" };
  const activityTable = { __table: "activity" };
  return {
    db: {
      select: () => ({
        from: (table: { __table?: string }) => ({
          where: () => {
            if (table.__table === "jobs") return Promise.resolve([h.job]);
            if (table.__table === "profiles") {
              return Promise.resolve([{ companyName: "Acme" }]);
            }
            return Promise.resolve([]);
          },
        }),
      }),
      update: () => ({
        set: () => ({
          where: () => ({
            returning: () => Promise.resolve([{ ...h.job, paymentStatus: "refunded", stripeRefundId: "re_1" }]),
          }),
        }),
      }),
      insert: () => ({ values: () => Promise.resolve() }),
    },
    jobsTable,
    profilesTable,
    activityTable,
  };
});

vi.mock("../middlewares/requireAuth", () => ({
  requireProfile: (req: any, _res: any, next: any) => {
    req.profile = { id: 2, role: "customer" };
    next();
  },
  getRequestProfile: (req: any) => req.profile,
}));

vi.mock("../lib/access", () => ({
  loadJobIfMember: async () => h.job,
}));

vi.mock("../middlewares/requireAdmin", () => ({
  isAdmin: () => h.isAdmin(),
}));

vi.mock("../lib/stripeClient", () => ({
  getUncachableStripeClient: async () => ({
    refunds: { create: h.refundsCreate },
  }),
}));

import jobsRouter from "./jobs";

function app() {
  const a = express();
  a.use(express.json());
  a.use(jobsRouter);
  return a;
}

describe("POST /jobs/:id/refund", () => {
  beforeEach(() => {
    h.job.paymentStatus = "released";
    h.job.stripePaymentIntentId = "pi_refund_test";
    h.refundsCreate.mockReset();
    h.refundsCreate.mockResolvedValue({ id: "re_test_1" });
    h.isAdmin.mockResolvedValue(false);
  });

  it("creates a Stripe refund for a released job", async () => {
    const res = await request(app()).post("/jobs/9/refund").send({ reason: "Customer dispute" });
    expect(res.status).toBe(200);
    expect(h.refundsCreate).toHaveBeenCalledWith(
      { payment_intent: "pi_refund_test", reason: "requested_by_customer" },
      { idempotencyKey: "job-refund:9:1" },
    );
    expect(res.body.paymentStatus).toBe("refunded");
  });

  it("rejects refund when job is unpaid", async () => {
    h.job.paymentStatus = "unpaid";
    const res = await request(app()).post("/jobs/9/refund").send({});
    expect(res.status).toBe(400);
    expect(h.refundsCreate).not.toHaveBeenCalled();
  });
});
