import { describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  configs: [] as unknown[],
}));

vi.mock("@workspace/db", () => {
  const marketplaceConfigsTable = {
    id: "marketplaceConfigs.id",
    isActive: "marketplaceConfigs.isActive",
    effectiveFrom: "marketplaceConfigs.effectiveFrom",
  };
  const db = {
    select: () => ({
      from: () => ({
        where: () => ({
          orderBy: () => ({
            limit: () => Promise.resolve(h.configs),
          }),
        }),
      }),
    }),
  };
  return { db, marketplaceConfigsTable };
});

import {
  DEFAULT_COMMISSION_RATE,
  computeMarketplacePricing,
  getActiveMarketplacePricingConfig,
} from "./marketplacePricing";

describe("marketplace pricing engine", () => {
  it("defaults to a 20% commission with no surcharge", async () => {
    h.configs = [];

    const config = await getActiveMarketplacePricingConfig();
    const pricing = computeMarketplacePricing({ ratePerHour: 100, hours: 2, config });

    expect(config.commissionRate).toBe(DEFAULT_COMMISSION_RATE);
    expect(pricing).toEqual({
      base: 200,
      commission: 40,
      surcharge: 0,
      platformFee: 40,
      gross: 240,
      providerNet: 200,
    });
  });

  it("combines configurable commission, percentage surcharge, and flat surcharge", () => {
    const pricing = computeMarketplacePricing({
      ratePerHour: 125,
      hours: 3.5,
      config: {
        id: 9,
        name: "custom",
        commissionRate: 0.18,
        surchargeRate: 0.025,
        flatSurchargeCents: 750,
        currency: "usd",
      },
    });

    expect(pricing).toEqual({
      base: 437.5,
      commission: 78.75,
      surcharge: 18.44,
      platformFee: 97.19,
      gross: 534.69,
      providerNet: 437.5,
    });
  });
});
