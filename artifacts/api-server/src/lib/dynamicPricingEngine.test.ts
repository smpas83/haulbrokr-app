import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  inserts: [] as { table: unknown; values: Record<string, unknown> }[],
}));

vi.mock("@workspace/db", () => {
  const pricingCalculationsTable = new Proxy({}, { get: (_target, prop) => `pricingCalculations.${String(prop)}` });
  const pricingSurchargeConfigsTable = new Proxy({}, { get: (_target, prop) => `pricingSurchargeConfigs.${String(prop)}` });
  return {
    pricingCalculationsTable,
    pricingSurchargeConfigsTable,
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

import { pricingCalculationsTable } from "@workspace/db";
import { calculateDynamicPricing, calculateDynamicPricingFromHours, recordPricingCalculation } from "./dynamicPricingEngine";

beforeEach(() => {
  h.inserts = [];
});

describe("calculateDynamicPricing", () => {
  it("does not apply any hardcoded surcharges", () => {
    expect(calculateDynamicPricing(100, [])).toEqual({
      baseAmount: 100,
      surchargeTotal: 0,
      pricedAmount: 100,
      appliedSurcharges: [],
    });
  });

  it("applies active percentage and fixed admin-configured surcharges", () => {
    const result = calculateDynamicPricing(100, [
      { id: 1, surchargeType: "demand", mode: "percentage", value: "0.1", active: 1 },
      { id: 2, surchargeType: "toll_roads", mode: "fixed_amount", value: "12.50", active: 1 },
      { id: 3, surchargeType: "weather", mode: "fixed_amount", value: "99", active: 0 },
    ] as any);

    expect(result).toMatchObject({
      baseAmount: 100,
      surchargeTotal: 22.5,
      pricedAmount: 122.5,
    });
    expect(result.appliedSurcharges).toEqual([
      { configId: 1, surchargeType: "demand", mode: "percentage", value: 0.1, amount: 10 },
      { configId: 2, surchargeType: "toll_roads", mode: "fixed_amount", value: 12.5, amount: 12.5 },
    ]);
  });

  it("calculates from rate and hours", () => {
    expect(calculateDynamicPricingFromHours(50, 2.5, [])).toMatchObject({
      baseAmount: 125,
      pricedAmount: 125,
    });
  });
});

describe("recordPricingCalculation", () => {
  it("persists base, surcharge total, priced amount, and applied surcharge JSON", async () => {
    const breakdown = calculateDynamicPricing(100, [
      { id: 1, surchargeType: "demand", mode: "percentage", value: "0.1", active: 1 },
    ] as any);
    await recordPricingCalculation({ jobId: 9, breakdown });

    expect(h.inserts).toHaveLength(1);
    expect(h.inserts[0].table).toBe(pricingCalculationsTable);
    expect(h.inserts[0].values).toMatchObject({
      jobId: 9,
      baseAmount: "100",
      surchargeTotal: "10",
      pricedAmount: "110",
    });
    expect(JSON.parse(String(h.inserts[0].values.appliedSurchargesJson))).toHaveLength(1);
  });
});
