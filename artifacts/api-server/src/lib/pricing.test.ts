import { describe, expect, it } from "vitest";
import { computeMarketplacePricing, pricingForAudience } from "./pricing";

describe("computeMarketplacePricing", () => {
  it("supports percentage margin and production pricing modifiers", () => {
    const breakdown = computeMarketplacePricing({
      driverRatePerHour: 100,
      estimatedHours: 8,
      brokerMarginType: "percentage",
      brokerMarginValue: 0.2,
      pricingRules: {
        rush: { type: "percentage", value: 0.1 },
        weekend: 50,
        waitingCharge: { type: "fixed", value: 75 },
        fuelSurcharge: { type: "percentage", value: 5 },
      },
    });

    expect(breakdown.driverPay).toBe(800);
    expect(breakdown.brokerMargin).toBe(160);
    expect(breakdown.customerSubtotal).toBe(960);
    expect(breakdown.customerTotal).toBe(1205);
    expect(breakdown.brokerProfit).toBe(405);
  });

  it("supports fixed broker margin", () => {
    const breakdown = computeMarketplacePricing({
      driverRatePerHour: 125,
      estimatedHours: 4,
      brokerMarginType: "fixed",
      brokerMarginValue: 300,
    });

    expect(breakdown.driverPay).toBe(500);
    expect(breakdown.brokerMargin).toBe(300);
    expect(breakdown.customerTotal).toBe(800);
  });

  it("redacts customer price, margin, and profit from payee views", () => {
    const breakdown = computeMarketplacePricing({
      driverRatePerHour: 100,
      estimatedHours: 2,
      brokerMarginType: "percentage",
      brokerMarginValue: 0.15,
      pricingRules: { noShowFee: 125 },
    });

    const payeeView = pricingForAudience(breakdown, "payee");

    expect(payeeView).toEqual({
      driverPay: 200,
      lineItems: [{
        code: "driver_pay",
        label: "Driver pay",
        amount: 200,
        visibility: ["broker", "payee"],
      }],
    });
    expect(JSON.stringify(payeeView)).not.toContain("customerTotal");
    expect(JSON.stringify(payeeView)).not.toContain("brokerMargin");
    expect(JSON.stringify(payeeView)).not.toContain("brokerProfit");
  });
});
