import { describe, it, expect } from "vitest";
import {
  computeBreakdown,
  computeJobPricing,
  roundCents,
  DEFAULT_PRICING_RATES,
} from "./engine";

describe("roundCents", () => {
  it("rounds half-up style floating artifacts to cents", () => {
    expect(roundCents(14.9985)).toBe(15);
    expect(roundCents(2.9985)).toBe(3);
    expect(roundCents(19.99 * 0.15)).toBe(3);
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

describe("computeJobPricing — customer checkout & carrier settlement", () => {
  const rates = {
    ...DEFAULT_PRICING_RATES,
    marketplaceFeeRate: 0.15,
    fuelSurchargeRate: 0.05,
    waitTimeRatePerHour: 75,
    emergencyDispatchRate: 0.1,
    holidaySurchargeRate: 0.15,
    taxRate: 0.08,
    taxesEnabled: true,
  };

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

    // base 1000, fuel 50, fee 150, tolls 40, wait 150, emergency 100, tax on taxable
    expect(result.customerCheckout.baseHaul).toBe(1000);
    expect(result.customerCheckout.fuelSurcharge).toBe(50);
    expect(result.customerCheckout.marketplaceFee).toBe(150);
    expect(result.customerCheckout.marketplaceFeeRate).toBe(0.15);
    expect(result.customerCheckout.tolls).toBe(40);
    expect(result.customerCheckout.waitTime).toBe(150);
    expect(result.customerCheckout.emergencyDispatch).toBe(100);
    expect(result.customerCheckout.holidaySurcharge).toBe(0);

    // taxable = 1000+50+40+150+100 = 1340; tax 8% = 107.20
    expect(result.customerCheckout.taxes).toBe(107.2);
    // grand = taxable + fee + tax = 1340 + 150 + 107.20 = 1597.20
    expect(result.customerCheckout.grandTotal).toBe(1597.2);
  });

  it("builds carrier settlement with net payout excluding marketplace fee and taxes", () => {
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
    // net = taxable subtotal (no fee, no tax)
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
    expect(result.customerCheckout.grandTotal).toBe(125); // 100 + 15 fee + 10 tolls
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
});
