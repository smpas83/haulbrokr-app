import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  pricingRules: [] as Record<string, unknown>[],
  commissionRules: [] as Record<string, unknown>[],
  inserts: [] as { table: unknown; row: unknown }[],
}));

vi.mock("@workspace/db", () => {
  const makeTable = (name: string) =>
    new Proxy({}, { get: (_target, prop) => `${name}.${String(prop)}` });
  const pricingRulesTable = makeTable("pricingRules");
  const commissionRulesTable = makeTable("commissionRules");
  return {
    pricingRulesTable,
    commissionRulesTable,
    customerInvoicesTable: makeTable("customerInvoices"),
    invoiceItemsTable: makeTable("invoiceItems"),
    vendorSettlementsTable: makeTable("vendorSettlements"),
    marketplaceTransactionsTable: makeTable("marketplaceTransactions"),
    financialAuditLogsTable: makeTable("financialAuditLogs"),
    db: {
      select: () => ({
        from: (table: unknown) => ({
          where: () => {
            if (table === pricingRulesTable)
              return Promise.resolve(h.pricingRules);
            if (table === commissionRulesTable)
              return Promise.resolve(h.commissionRules);
            return Promise.resolve([]);
          },
        }),
      }),
      insert: (table: unknown) => ({
        values: (row: unknown) => {
          h.inserts.push({ table, row });
          return {
            returning: () =>
              Promise.resolve([
                {
                  id: h.inserts.length,
                  ...(Array.isArray(row) ? {} : (row as object)),
                },
              ]),
          };
        },
      }),
    },
  };
});

import {
  computeFinancialQuote,
  createCustomerInvoiceForJob,
  createVendorSettlementForJob,
  recordFinancialAudit,
  recordMarketplaceFinancialTransaction,
} from "./financialEngine";

beforeEach(() => {
  h.pricingRules = [
    {
      code: "base_hourly_rate",
      label: "Base",
      valueType: "fixed_amount",
      value: "100",
      priority: 0,
    },
    {
      code: "per_load_rate",
      label: "Per load",
      valueType: "fixed_amount",
      value: "25",
      priority: 0,
    },
    {
      code: "per_ton_rate",
      label: "Per ton",
      valueType: "fixed_amount",
      value: "2",
      priority: 0,
    },
    {
      code: "bridge_toll_fee",
      label: "Bridge toll",
      valueType: "fixed_amount",
      value: "15",
      priority: 0,
    },
    {
      code: "permit_fee",
      label: "Permit",
      valueType: "fixed_amount",
      value: "20",
      priority: 0,
    },
  ];
  h.commissionRules = [
    { id: 1, scope: "global", targetId: null, rate: "0.20", priority: 0 },
  ];
  h.inserts = [];
});

describe("computeFinancialQuote", () => {
  it("returns final invoice totals with configurable pricing, commission, taxes, fees, and surcharges", async () => {
    const quote = await computeFinancialQuote({
      distanceMiles: 0,
      estimatedHours: 2,
      loads: 2,
      quantityTons: 10,
      bridgeTolls: 30,
      permitFees: 40,
      taxes: 12,
      fees: 8,
      fuelSurchargeAmount: 10,
    });

    expect(quote.vendorPayout).toBe(340);
    expect(quote.platformCommission).toBe(68);
    expect(quote.finalInvoice).toBe(438);
    expect(quote.netMarketplaceRevenue).toBe(76);
    expect(quote.pricingExplanation.map((item) => item.code)).toEqual([
      "base_labor",
      "per_load_rate",
      "per_ton_rate",
      "bridge_toll_fee",
      "permit_fee",
    ]);
  });
});

describe("financial persistence helpers", () => {
  const job: any = {
    id: 10,
    customerId: 1,
    providerId: 2,
    providerNetAmount: "340.00",
    platformFeeAmount: "68.00",
    customerTotalAmount: "438.00",
    taxesAmount: "12.00",
    feesAmount: "8.00",
    gmvAmount: "438.00",
    netMarketplaceRevenueAmount: "76.00",
    paymentStatus: "released",
    paidAt: new Date("2026-07-01T00:00:00Z"),
  };

  it("creates customer invoice/items, vendor settlement, marketplace transaction, and audit rows", async () => {
    await createCustomerInvoiceForJob(job);
    await createVendorSettlementForJob(job);
    await recordMarketplaceFinancialTransaction({
      job,
      type: "platform_commission",
      amount: job.platformFeeAmount,
      status: "succeeded",
      idempotencyKey: "commission:10",
    });
    await recordFinancialAudit({
      action: "financial.snapshot",
      entityType: "job",
      entityId: job.id,
      after: { ok: true },
    });

    expect(h.inserts.length).toBeGreaterThanOrEqual(5);
    expect(h.inserts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          row: expect.objectContaining({ invoiceNumber: "HB-2026-000010" }),
        }),
        expect.objectContaining({
          row: expect.objectContaining({ status: "paid", vendorId: 2 }),
        }),
        expect.objectContaining({
          row: expect.objectContaining({
            type: "platform_commission",
            amountCents: 6800,
          }),
        }),
        expect.objectContaining({
          row: expect.objectContaining({ action: "financial.snapshot" }),
        }),
      ]),
    );
  });
});
