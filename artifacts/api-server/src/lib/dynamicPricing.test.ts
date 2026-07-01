import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  pricingRules: [] as Record<string, unknown>[],
  commissionRules: [] as Record<string, unknown>[],
}));

vi.mock("@workspace/db", () => {
  const makeTable = (name: string) =>
    new Proxy({}, { get: (_target, prop) => `${name}.${String(prop)}` });
  const pricingRulesTable = makeTable("pricingRules");
  const commissionRulesTable = makeTable("commissionRules");
  const marketplaceAuditLogsTable = makeTable("marketplaceAuditLogs");
  return {
    pricingRulesTable,
    commissionRulesTable,
    marketplaceAuditLogsTable,
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
      insert: () => ({ values: () => Promise.resolve(undefined) }),
    },
  };
});

import { computeDynamicQuote } from "./dynamicPricing";

beforeEach(() => {
  h.pricingRules = [
    {
      id: 1,
      code: "base_hourly_rate",
      label: "Base hourly rate",
      valueType: "fixed_amount",
      value: "100",
      priority: 0,
    },
    {
      id: 2,
      code: "distance_mile_rate",
      label: "Distance",
      valueType: "fixed_amount",
      value: "4",
      priority: 0,
    },
    {
      id: 3,
      code: "truck_type_multiplier",
      label: "Tri axle premium",
      valueType: "multiplier",
      value: "1.10",
      targetKey: "tri_axle",
      priority: 0,
    },
    {
      id: 4,
      code: "fuel_surcharge_pct",
      label: "Fuel surcharge",
      valueType: "percent",
      value: "0.05",
      priority: 0,
    },
    {
      id: 5,
      code: "waiting_time_hourly_rate",
      label: "Waiting time",
      valueType: "fixed_amount",
      value: "75",
      priority: 0,
    },
    {
      id: 6,
      code: "extra_stop_fee",
      label: "Extra stop",
      valueType: "fixed_amount",
      value: "50",
      priority: 0,
    },
  ];
  h.commissionRules = [
    {
      id: 7,
      scope: "global",
      targetId: null,
      rate: "0.20",
      priority: 0,
      reason: "global",
    },
  ];
});

describe("computeDynamicQuote", () => {
  it("calculates dynamic customer quote, vendor payout, platform profit, and line-item breakdown", async () => {
    const quote = await computeDynamicQuote({
      distanceMiles: 10,
      estimatedHours: 2,
      trucksNeeded: 1,
      truckType: "tri_axle",
      fuelSurcharge: true,
      waitingTimeMinutes: 30,
      extraStops: 1,
    });

    expect(quote.vendorPayout).toBe(378.26);
    expect(quote.platformCommission).toBe(75.65);
    expect(quote.customerQuote).toBe(453.91);
    expect(quote.platformProfit).toBe(75.65);
    expect(quote.gmv).toBe(453.91);
    expect(quote.pricingBreakdown.map((item) => item.code)).toEqual([
      "base_labor",
      "distance",
      "waiting_time_hourly_rate",
      "extra_stop_fee",
      "truck_type_multiplier",
      "fuel_surcharge_pct",
    ]);
  });

  it("requires configured base pricing when caller does not pass a base rate", async () => {
    h.pricingRules = [];

    await expect(
      computeDynamicQuote({ distanceMiles: 1, estimatedHours: 1 }),
    ).rejects.toThrow("No active base hourly pricing rule is configured.");
  });
});
