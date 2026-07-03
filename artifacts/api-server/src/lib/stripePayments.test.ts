import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  inserts: [] as Record<string, unknown>[],
  updates: [] as Record<string, unknown>[],
  paymentIntentsCreate: vi.fn(),
  refundsCreate: vi.fn(),
}));

vi.mock("@workspace/db", () => {
  const makeTable = (name: string) =>
    new Proxy({}, { get: (_t, p) => `${name}.${String(p)}` });
  const db = {
    insert: () => ({
      values: (vals: Record<string, unknown>) => {
        h.inserts.push(vals);
        return Promise.resolve(undefined);
      },
    }),
    update: () => ({
      set: (vals: Record<string, unknown>) => {
        h.updates.push(vals);
        return { where: () => Promise.resolve(undefined) };
      },
    }),
  };
  return {
    db,
    jobsTable: makeTable("jobs"),
    paymentAuditLogsTable: makeTable("paymentAuditLogs"),
  };
});

vi.mock("./stripeClient", () => ({
  getUncachableStripeClient: vi.fn(async () => ({
    paymentIntents: {
      create: h.paymentIntentsCreate,
      capture: vi.fn(),
    },
    refunds: {
      create: h.refundsCreate,
    },
  })),
}));

import { createAuthorizedPaymentIntent, refundJobPayment } from "./stripePayments";

beforeEach(() => {
  h.inserts = [];
  h.updates = [];
  h.paymentIntentsCreate.mockReset();
  h.refundsCreate.mockReset();
});

describe("stripe payment service", () => {
  it("creates a manual-capture PaymentIntent for a saved card and audits it", async () => {
    h.paymentIntentsCreate.mockResolvedValue({
      id: "pi_auth_1",
      status: "requires_capture",
      amount: 24000,
      currency: "usd",
      latest_charge: "ch_auth_1",
      metadata: { jobId: "10", kind: "authorization" },
    });

    const pi = await createAuthorizedPaymentIntent(
      { id: 10, customerId: 1, customerTotalAmount: "240.00", providerNetAmount: "200.00" },
      { stripeCustomerId: "cus_1", stripePaymentMethodId: "pm_1", methodType: "credit_card" },
      2,
    );

    expect(pi.id).toBe("pi_auth_1");
    const [args, opts] = h.paymentIntentsCreate.mock.calls[0];
    expect(args).toMatchObject({
      amount: 24000,
      capture_method: "manual",
      customer: "cus_1",
      payment_method: "pm_1",
      payment_method_types: ["card"],
      off_session: true,
    });
    expect(opts.idempotencyKey).toBe("job-authorize:10:2");
    expect(h.inserts.at(-1)).toMatchObject({
      eventType: "payment_intent.authorized",
      status: "requires_capture",
      stripePaymentIntentId: "pi_auth_1",
      stripeChargeId: "ch_auth_1",
    });
  });

  it("creates a refund, updates the job refund fields, and audits it", async () => {
    h.refundsCreate.mockResolvedValue({
      id: "re_1",
      status: "succeeded",
      amount: 24000,
      currency: "usd",
      metadata: { jobId: "10" },
    });

    await refundJobPayment({
      id: 10,
      customerId: 1,
      customerTotalAmount: "240.00",
      stripePaymentIntentId: "pi_paid_1",
    });

    expect(h.refundsCreate.mock.calls[0][0]).toMatchObject({
      payment_intent: "pi_paid_1",
      metadata: { jobId: "10" },
    });
    expect(h.updates.at(-1)).toMatchObject({
      paymentStatus: "refunded",
      refundStatus: "succeeded",
      stripeRefundId: "re_1",
    });
    expect(h.inserts.at(-1)).toMatchObject({
      eventType: "refund.created",
      status: "succeeded",
      stripeRefundId: "re_1",
    });
  });
});
