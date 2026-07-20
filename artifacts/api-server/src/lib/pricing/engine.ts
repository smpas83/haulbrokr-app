/**
 * HaulBrokr centralized pricing engine.
 *
 * Pure calculation module — no DB access. Rates and inputs are provided by
 * callers (settings loader, job completion handler, admin preview).
 *
 * Customer pays (Grand Total):
 *   Base Haul + Fuel Surcharge + Marketplace Fee + Tolls
 *   + Wait Time + Emergency Dispatch + Holiday Surcharge + Taxes
 *
 * Carrier receives (Net Payout):
 *   Base Haul + Fuel + Tolls + Wait Time + Emergency + Holiday
 *   (Marketplace Fee and Taxes are retained / remitted by the platform)
 */

export type PricingRates = {
  /** Marketplace / broker fee as a decimal (e.g. 0.15 = 15%). */
  marketplaceFeeRate: number;
  /** Fuel surcharge as a decimal of base haul. */
  fuelSurchargeRate: number;
  /** Emergency dispatch surcharge as a decimal of base haul. */
  emergencyDispatchRate: number;
  /** Holiday surcharge as a decimal of base haul. */
  holidaySurchargeRate: number;
  /** Flat wait-time rate in USD per hour. */
  waitTimeRatePerHour: number;
  /** Tax rate as a decimal (applied when taxesEnabled). */
  taxRate: number;
  /** Whether taxes are applied on this haul. */
  taxesEnabled: boolean;
};

export type PricingInputs = {
  ratePerHour: number;
  hours: number;
  /** Pass-through tolls in USD. */
  tollsAmount?: number;
  /** Billable wait hours (multiplied by waitTimeRatePerHour). */
  waitTimeHours?: number;
  /** Explicit wait-time dollar amount; wins over waitTimeHours when set. */
  waitTimeAmount?: number;
  /** When true, apply emergencyDispatchRate × base. */
  isEmergencyDispatch?: boolean;
  /** Explicit emergency amount; wins over rate calculation when set (> 0). */
  emergencyDispatchAmount?: number;
  /** When true, apply holidaySurchargeRate × base. */
  isHolidayHaul?: boolean;
  /** Explicit holiday amount; wins over rate calculation when set (> 0). */
  holidaySurchargeAmount?: number;
  /** Override tax rate for this haul (falls back to rates.taxRate). */
  taxRate?: number;
  /** Override taxes-enabled for this haul. */
  taxesEnabled?: boolean;
};

/** Line items shown on customer checkout. */
export type CustomerCheckoutBreakdown = {
  baseHaul: number;
  fuelSurcharge: number;
  marketplaceFee: number;
  marketplaceFeeRate: number;
  tolls: number;
  waitTime: number;
  emergencyDispatch: number;
  holidaySurcharge: number;
  taxes: number;
  taxRate: number;
  grandTotal: number;
};

/** Line items shown on carrier settlement. */
export type CarrierSettlementBreakdown = {
  baseHaul: number;
  marketplaceFee: number;
  marketplaceFeeRate: number;
  fuel: number;
  tolls: number;
  waitTime: number;
  emergencyDispatch: number;
  holidaySurcharge: number;
  netPayout: number;
};

/** Full pricing result written onto a job at completion. */
export type JobPricingResult = {
  rates: {
    marketplaceFeeRate: number;
    fuelSurchargeRate: number;
    taxRate: number;
  };
  amounts: {
    baseHaul: number;
    fuelSurchargeAmount: number;
    marketplaceFeeAmount: number;
    tollsAmount: number;
    waitTimeHours: number;
    waitTimeAmount: number;
    emergencyDispatchAmount: number;
    holidaySurchargeAmount: number;
    taxAmount: number;
    customerTotalAmount: number;
    providerNetAmount: number;
  };
  flags: {
    isEmergencyDispatch: boolean;
    isHolidayHaul: boolean;
  };
  customerCheckout: CustomerCheckoutBreakdown;
  carrierSettlement: CarrierSettlementBreakdown;
};

/** Default rates used only when the DB has not been seeded yet. */
export const DEFAULT_PRICING_RATES: PricingRates = {
  marketplaceFeeRate: 0.15,
  fuelSurchargeRate: 0,
  emergencyDispatchRate: 0.1,
  holidaySurchargeRate: 0.15,
  waitTimeRatePerHour: 75,
  taxRate: 0,
  taxesEnabled: false,
};

export function roundCents(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function nonNeg(n: number | undefined | null, fallback = 0): number {
  if (n == null || !Number.isFinite(n) || n < 0) return fallback;
  return n;
}

/**
 * Compute all pricing line items for a haul.
 * Marketplace fee is always applied on base haul (not on add-ons).
 * Fuel surcharge is a percentage of base haul from the weekly diesel schedule.
 * Taxes (when enabled) apply to the taxable subtotal excluding the marketplace fee.
 */
export function computeJobPricing(inputs: PricingInputs, rates: PricingRates): JobPricingResult {
  const ratePerHour = nonNeg(inputs.ratePerHour);
  const hours = nonNeg(inputs.hours);
  const baseHaul = roundCents(ratePerHour * hours);

  const marketplaceFeeRate = nonNeg(rates.marketplaceFeeRate);
  const fuelSurchargeRate = nonNeg(rates.fuelSurchargeRate);
  const marketplaceFeeAmount = roundCents(baseHaul * marketplaceFeeRate);
  const fuelSurchargeAmount = roundCents(baseHaul * fuelSurchargeRate);

  const tollsAmount = roundCents(nonNeg(inputs.tollsAmount));

  const waitTimeHours = nonNeg(inputs.waitTimeHours);
  const waitTimeAmount =
    inputs.waitTimeAmount != null && inputs.waitTimeAmount > 0
      ? roundCents(inputs.waitTimeAmount)
      : roundCents(waitTimeHours * nonNeg(rates.waitTimeRatePerHour));

  const isEmergencyDispatch = !!inputs.isEmergencyDispatch || nonNeg(inputs.emergencyDispatchAmount) > 0;
  const emergencyDispatchAmount =
    inputs.emergencyDispatchAmount != null && inputs.emergencyDispatchAmount > 0
      ? roundCents(inputs.emergencyDispatchAmount)
      : isEmergencyDispatch
        ? roundCents(baseHaul * nonNeg(rates.emergencyDispatchRate))
        : 0;

  const isHolidayHaul = !!inputs.isHolidayHaul || nonNeg(inputs.holidaySurchargeAmount) > 0;
  const holidaySurchargeAmount =
    inputs.holidaySurchargeAmount != null && inputs.holidaySurchargeAmount > 0
      ? roundCents(inputs.holidaySurchargeAmount)
      : isHolidayHaul
        ? roundCents(baseHaul * nonNeg(rates.holidaySurchargeRate))
        : 0;

  const taxesEnabled = inputs.taxesEnabled ?? rates.taxesEnabled;
  const taxRate = taxesEnabled ? nonNeg(inputs.taxRate ?? rates.taxRate) : 0;
  // Taxable base: work + pass-throughs + surcharges (marketplace fee is not taxed).
  const taxableSubtotal = roundCents(
    baseHaul +
      fuelSurchargeAmount +
      tollsAmount +
      waitTimeAmount +
      emergencyDispatchAmount +
      holidaySurchargeAmount,
  );
  const taxAmount = taxesEnabled ? roundCents(taxableSubtotal * taxRate) : 0;

  const customerTotalAmount = roundCents(
    taxableSubtotal + marketplaceFeeAmount + taxAmount,
  );
  const providerNetAmount = taxableSubtotal;

  const customerCheckout: CustomerCheckoutBreakdown = {
    baseHaul,
    fuelSurcharge: fuelSurchargeAmount,
    marketplaceFee: marketplaceFeeAmount,
    marketplaceFeeRate,
    tolls: tollsAmount,
    waitTime: waitTimeAmount,
    emergencyDispatch: emergencyDispatchAmount,
    holidaySurcharge: holidaySurchargeAmount,
    taxes: taxAmount,
    taxRate,
    grandTotal: customerTotalAmount,
  };

  const carrierSettlement: CarrierSettlementBreakdown = {
    baseHaul,
    marketplaceFee: marketplaceFeeAmount,
    marketplaceFeeRate,
    fuel: fuelSurchargeAmount,
    tolls: tollsAmount,
    waitTime: waitTimeAmount,
    emergencyDispatch: emergencyDispatchAmount,
    holidaySurcharge: holidaySurchargeAmount,
    netPayout: providerNetAmount,
  };

  return {
    rates: {
      marketplaceFeeRate,
      fuelSurchargeRate,
      taxRate,
    },
    amounts: {
      baseHaul,
      fuelSurchargeAmount,
      marketplaceFeeAmount,
      tollsAmount,
      waitTimeHours,
      waitTimeAmount,
      emergencyDispatchAmount,
      holidaySurchargeAmount,
      taxAmount,
      customerTotalAmount,
      providerNetAmount,
    },
    flags: {
      isEmergencyDispatch,
      isHolidayHaul,
    },
    customerCheckout,
    carrierSettlement,
  };
}

/**
 * Backward-compatible helper matching the historic broker-fee split:
 *   base = rate × hours, fee = base × feeRate, gross = base + fee
 * Used by older call sites / tests that only need the fee line.
 */
export function computeBreakdown(ratePerHour: number, hours: number, feeRate: number) {
  const result = computeJobPricing(
    { ratePerHour, hours },
    { ...DEFAULT_PRICING_RATES, marketplaceFeeRate: feeRate, fuelSurchargeRate: 0 },
  );
  return {
    base: result.amounts.baseHaul,
    fee: result.amounts.marketplaceFeeAmount,
    gross: result.amounts.customerTotalAmount,
  };
}
