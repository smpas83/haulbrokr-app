import { describe, it, expect } from "vitest";
import {
  computeBreakdown,
  computeJobPricing,
  allocateRefund,
  roundCents,
  resolveFeeBasis,
  DEFAULT_PRICING_RATES,
} from "./engine";

describe("roundCents", () => {
  it("rounds half-up style floating artifacts to cents", () => {
    expect(roundCents(14.9985)).toBe(15);
    expect(roundCents(2.9985)).toBe(3);
    expect(roundCents(19.99 * 0.15)).toBe(3);
  });
});

describe("resolveFeeBasis", () => {
  it("defaults to base_haul_only", () => {
    expect(resolveFeeBasis(undefined)).toBe("base_haul_only");
    expect(resolveFeeBasis(0)).toBe("base_haul_only");
    expect(resolveFeeBasis("0")).toBe("base_haul_only");
  });

  it("accepts base_plus_surcharges", () => {
    expect(resolveFeeBasis(1)).toBe("base_plus_surcharges");
    expect(resolveFeeBasis("1")).toBe("base_plus_surcharges");
    expect(resolveFeeBasis("base_plus_surcharges")).toBe("base_plus_surcharges");
  });
});

describe("computeBreakdown (marketplace fee compatibility)", () => {
  it("splits a clean amount into base, fee, and gross at 15%", () => {
    expect(computeBreakdown(100, 1, 0.15)).toEqual({ base: 100, fee: 15, gross: 115 });
  });

  it("keeps the provider net equal to the base when no add-ons", () => {
    expect(computeBreakdown(50, 2.5, 0.15)).toEqual({ base: 125, fee: 18.75, gross: 143.75 });
  });

  it("rounds the fee to cents", () => {
    expect(computeBreakdown(33.33, 3, 0.15)).toEqual({ base: 99.99, fee: 15, gross: 114.99 });
  });
});

describe("computeJobPricing — customer-side marketplace fee policy", () => {
  const rates = {
    ...DEFAULT_PRICING_RATES,
    marketplaceFeeRate: 0.15,
    marketplaceFeeBasis: "base_haul_only" as const,
    fuelSurchargeRate: 0.05,
    waitTimeRatePerHour: 75,
    emergencyDispatchRate: 0.1,
    holidaySurchargeRate: 0.15,
    taxRate: 0.08,
    taxesEnabled: true,
  };

  it("policy example: $1000 base + $50 fuel + $20 tolls → $150 fee, customer $1220, carrier $1070", () => {
    const result = computeJobPricing(
      { ratePerHour: 100, hours: 10, tollsAmount: 20 },
      {
        ...DEFAULT_PRICING_RATES,
        marketplaceFeeRate: 0.15,
        marketplaceFeeBasis: "base_haul_only",
        fuelSurchargeRate: 0.05,
        taxesEnabled: false,
      },
    );

    expect(result.amounts.baseHaul).toBe(1000);
    expect(result.amounts.fuelSurchargeAmount).toBe(50);
    expect(result.amounts.tollsAmount).toBe(20);
    expect(result.amounts.marketplaceFeeAmount).toBe(150);
    expect(result.amounts.customerSubtotal).toBe(1070);
    expect(result.amounts.customerTotalAmount).toBe(1220);
    expect(result.amounts.providerNetAmount).toBe(1070);
    expect(result.amounts.haulbrokrMarketplaceRevenue).toBe(150);
    // Carrier payout is never base minus fee
    expect(result.amounts.providerNetAmount).toBe(
      result.amounts.baseHaul + result.amounts.fuelSurchargeAmount + result.amounts.tollsAmount,
    );
    expect(result.amounts.providerNetAmount).not.toBe(1000 * 0.85);
  });

  it("charges marketplace fee on base haul only by default (not surcharges)", () => {
    const result = computeJobPricing(
      { ratePerHour: 100, hours: 10, tollsAmount: 40, waitTimeHours: 2, isEmergencyDispatch: true },
      rates,
    );
    // fee = 15% of 1000 only
    expect(result.customerCheckout.marketplaceFee).toBe(150);
    expect(result.customerCheckout.marketplaceFeeBasis).toBe("base_haul_only");
  });

  it("can charge marketplace fee on base + surcharges when configured", () => {
    const result = computeJobPricing(
      { ratePerHour: 100, hours: 10, tollsAmount: 20 },
      {
        ...DEFAULT_PRICING_RATES,
        marketplaceFeeRate: 0.15,
        marketplaceFeeBasis: "base_plus_surcharges",
        fuelSurchargeRate: 0.05,
        taxesEnabled: false,
      },
    );
    // subtotal 1070 × 15% = 160.50
    expect(result.amounts.customerSubtotal).toBe(1070);
    expect(result.amounts.marketplaceFeeAmount).toBe(160.5);
    expect(result.amounts.customerTotalAmount).toBe(1230.5);
    expect(result.amounts.providerNetAmount).toBe(1070);
  });

  it("does not charge marketplace fee on taxes", () => {
    const result = computeJobPricing(
      { ratePerHour: 100, hours: 10, tollsAmount: 20 },
      {
        ...DEFAULT_PRICING_RATES,
        marketplaceFeeRate: 0.15,
        fuelSurchargeRate: 0.05,
        taxRate: 0.1,
        taxesEnabled: true,
      },
    );
    // fee still 150 on base; tax on subtotal 1070 × 10% = 107; fee not in tax base
    expect(result.amounts.marketplaceFeeAmount).toBe(150);
    expect(result.amounts.taxAmount).toBe(107);
    expect(result.amounts.customerTotalAmount).toBe(1327);
    // Fee is not applied to taxAmount
    expect(result.amounts.marketplaceFeeAmount).not.toBe(roundCents((1070 + 107) * 0.15));
  });

  it("builds customer checkout line items including fuel, fee, tolls, taxes", () => {
    const result = computeJobPricing(
      {
        ratePerHour: 100,
        hours: 10,
        tollsAmount: 40,
        waitTimeHours: 2,
        isEmergencyDispatch: true,
        isHolidayHaul: false,
      },
      rates,
    );

    expect(result.customerCheckout.baseHaul).toBe(1000);
    expect(result.customerCheckout.fuelSurcharge).toBe(50);
    expect(result.customerCheckout.marketplaceFee).toBe(150);
    expect(result.customerCheckout.marketplaceFeeRate).toBe(0.15);
    expect(result.customerCheckout.tolls).toBe(40);
    expect(result.customerCheckout.waitTime).toBe(150);
    expect(result.customerCheckout.emergencyDispatch).toBe(100);
    expect(result.customerCheckout.holidaySurcharge).toBe(0);
    expect(result.customerCheckout.taxes).toBe(107.2);
    expect(result.customerCheckout.grandTotal).toBe(1597.2);
  });

  it("builds carrier settlement with full reimbursements and no fee deduction", () => {
    const result = computeJobPricing(
      {
        ratePerHour: 100,
        hours: 10,
        tollsAmount: 40,
        waitTimeHours: 2,
        isEmergencyDispatch: true,
      },
      rates,
    );

    expect(result.carrierSettlement.baseHaul).toBe(1000);
    expect(result.carrierSettlement.marketplaceFee).toBe(150);
    expect(result.carrierSettlement.fuel).toBe(50);
    expect(result.carrierSettlement.tolls).toBe(40);
    expect(result.carrierSettlement.waitTime).toBe(150);
    expect(result.carrierSettlement.netPayout).toBe(1340);
    expect(result.amounts.providerNetAmount).toBe(1340);
    expect(result.amounts.customerTotalAmount).toBe(1597.2);
  });

  it("applies holiday surcharge when flagged", () => {
    const result = computeJobPricing(
      { ratePerHour: 200, hours: 1, isHolidayHaul: true },
      { ...DEFAULT_PRICING_RATES, marketplaceFeeRate: 0.15, holidaySurchargeRate: 0.15 },
    );
    expect(result.amounts.baseHaul).toBe(200);
    expect(result.amounts.holidaySurchargeAmount).toBe(30);
    expect(result.amounts.marketplaceFeeAmount).toBe(30);
    expect(result.amounts.providerNetAmount).toBe(230);
    expect(result.amounts.customerTotalAmount).toBe(260);
  });

  it("skips taxes when taxesEnabled is false", () => {
    const result = computeJobPricing(
      { ratePerHour: 100, hours: 1, tollsAmount: 10 },
      { ...DEFAULT_PRICING_RATES, marketplaceFeeRate: 0.15, taxRate: 0.1, taxesEnabled: false },
    );
    expect(result.customerCheckout.taxes).toBe(0);
    expect(result.customerCheckout.grandTotal).toBe(125);
  });

  it("uses explicit dollar amounts over rate-derived emergency/holiday/wait", () => {
    const result = computeJobPricing(
      {
        ratePerHour: 100,
        hours: 1,
        waitTimeAmount: 200,
        emergencyDispatchAmount: 55,
        holidaySurchargeAmount: 25,
        isEmergencyDispatch: true,
        isHolidayHaul: true,
      },
      rates,
    );
    expect(result.amounts.waitTimeAmount).toBe(200);
    expect(result.amounts.emergencyDispatchAmount).toBe(55);
    expect(result.amounts.holidaySurchargeAmount).toBe(25);
  });

  it("never hardcodes a marketplace fee other than the provided rate", () => {
    const custom = computeJobPricing(
      { ratePerHour: 100, hours: 1 },
      { ...DEFAULT_PRICING_RATES, marketplaceFeeRate: 0.12 },
    );
    expect(custom.amounts.marketplaceFeeAmount).toBe(12);
    expect(custom.customerCheckout.marketplaceFeeRate).toBe(0.12);
  });

  it("freezes historical amounts when rates change (caller stores job snapshot)", () => {
    const atBooking = computeJobPricing(
      { ratePerHour: 100, hours: 10 },
      { ...DEFAULT_PRICING_RATES, marketplaceFeeRate: 0.15, fuelSurchargeRate: 0.05 },
    );
    const laterRates = {
      ...DEFAULT_PRICING_RATES,
      marketplaceFeeRate: 0.2,
      fuelSurchargeRate: 0.1,
    };
    const recomputed = computeJobPricing({ ratePerHour: 100, hours: 10 }, laterRates);
    // Stored snapshot must keep original fee/fuel; recomputation with new rates differs
    expect(atBooking.amounts.marketplaceFeeAmount).toBe(150);
    expect(atBooking.amounts.fuelSurchargeAmount).toBe(50);
    expect(recomputed.amounts.marketplaceFeeAmount).toBe(200);
    expect(recomputed.amounts.fuelSurchargeAmount).toBe(100);
  });
});

describe("allocateRefund", () => {
  it("absorbs marketplace fee (and taxes) before clawing carrier payout", () => {
    expect(
      allocateRefund({
        refundAmount: 100,
        marketplaceFeeAmount: 150,
        taxAmount: 0,
        providerNetAmount: 1070,
      }),
    ).toEqual({ platformRefund: 100, carrierClawback: 0 });

    expect(
      allocateRefund({
        refundAmount: 200,
        marketplaceFeeAmount: 150,
        taxAmount: 0,
        providerNetAmount: 1070,
      }),
    ).toEqual({ platformRefund: 150, carrierClawback: 50 });

    expect(
      allocateRefund({
        refundAmount: 1220,
        marketplaceFeeAmount: 150,
        taxAmount: 0,
        providerNetAmount: 1070,
      }),
    ).toEqual({ platformRefund: 150, carrierClawback: 1070 });
  });

  it("treats taxes as platform-held for clawback ordering", () => {
    expect(
      allocateRefund({
        refundAmount: 200,
        marketplaceFeeAmount: 150,
        taxAmount: 50,
        providerNetAmount: 1000,
      }),
    ).toEqual({ platformRefund: 200, carrierClawback: 0 });
  });
});
