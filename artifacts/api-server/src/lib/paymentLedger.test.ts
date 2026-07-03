import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  inserts: [] as { table: unknown; values: Record<string, unknown> }[],
}));

vi.mock("@workspace/db", () => {
  const marketplacePaymentsTable = new Proxy({}, { get: (_target, prop) => `marketplacePayments.${String(prop)}` });
  return {
    marketplacePaymentsTable,
    db: {
      insert: (table: unknown) => ({
        values: (values: Record<string, unknown>) => {
          h.inserts.push({ table, values });
          return Promise.resolve(undefined);
        },
      }),
    },
  };
});

import { marketplacePaymentsTable } from "@workspace/db";
import { recordPaymentLedgerEntry, serializeMarketplacePayment } from "./paymentLedger";

beforeEach(() => {
  h.inserts = [];
});

describe("recordPaymentLedgerEntry", () => {
  it("persists normalized marketplace payment facts in cents", async () => {
    await recordPaymentLedgerEntry({
      jobId: 10,
      customerId: 1,
      vendorId: 2,
      type: "transfer",
      status: "released",
      amountCents: 12000.4,
      platformFeeCents: 2000.2,
      vendorPayoutCents: 10000,
      paymentRail: "credit_card",
      stripePaymentIntentId: "pi_123",
      stripeTransferId: "tr_123",
    });

    expect(h.inserts).toHaveLength(1);
    expect(h.inserts[0].table).toBe(marketplacePaymentsTable);
    expect(h.inserts[0].values).toEqual(expect.objectContaining({
      jobId: 10,
      customerId: 1,
      vendorId: 2,
      type: "transfer",
      status: "released",
      amountCents: 12000,
      platformFeeCents: 2000,
      vendorPayoutCents: 10000,
      paymentRail: "credit_card",
      stripePaymentIntentId: "pi_123",
      stripeTransferId: "tr_123",
    }));
  });
});

describe("serializeMarketplacePayment", () => {
  it("adds dollar fields without losing raw cents", () => {
    expect(serializeMarketplacePayment({
      amountCents: 12000,
      platformFeeCents: 2000,
      vendorPayoutCents: 10000,
      driverPayoutCents: null,
    } as any)).toMatchObject({
      amountCents: 12000,
      amount: 120,
      platformFee: 20,
      vendorPayout: 100,
      driverPayout: null,
    });
  });
});
