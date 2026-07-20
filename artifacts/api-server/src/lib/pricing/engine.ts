/**
 * HaulBrokr centralized pricing engine.
 *
 * Pure calculation module — no DB access. Rates and inputs are provided by
 * callers (settings loader, job completion handler, admin preview).
 *
 * BUSINESS POLICY (customer-side marketplace fee):
 *   - The CUSTOMER pays the marketplace/service fee.
 *   - The CARRIER is never charged that fee and is never paid "base minus fee".
 *   - Carrier payout = accepted base haul + approved reimbursements.
 *   - Default fee basis = BASE HAUL ONLY (not surcharges, not taxes).
 *
 * Customer pays (Grand Total):
 *   customerSubtotal (base + fuel + tolls + wait + emergency + holiday)
 *   + marketplaceFee (rate × fee basis)
 *   + taxes (on customerSubtotal only — fee is not taxed)
 *
 * Carrier receives (Net Payout):
 *   Base Haul + Fuel + Tolls + Wait Time + Emergency + Holiday
 *   (Marketplace Fee and Taxes are retained / remitted by the platform)
 */

/** 0 = base_haul_only (default); 1 = base_plus_surcharges (excl. taxes). */
export type MarketplaceFeeBasis = "base_haul_only" | "base_plus_surcharges";

export type PricingRates = {
  /** Customer marketplace fee as a decimal (e.g. 0.15). Loaded from DB settings. */
  marketplaceFeeRate: number;
  /** Fee basis — default base haul only. */
  marketplaceFeeBasis: MarketplaceFeeBasis;
  /** Fuel surcharge as a decimal of base haul. */
  fuelSurchargeRate: number;
  /** Emergency dispatch surcharge as a decimal of base haul. */
  emergencyDispatchRate: number;
  /** Holiday surcharge as a decimal of base haul. */
  holidaySurchargeRate: number;
  /** Flat wait-time rate in USD per hour. */
  waitTimeRatePerHour: number;
  /** Wait-time grace period in minutes (billable after this). */
  waitTimeGracePeriodMinutes: number;
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

/** Line items shown on customer checkout / quote / invoice. */
export type CustomerCheckoutBreakdown = {
  baseHaul: number;
  fuelSurcharge: number;
  marketplaceFee: number;
  marketplaceFeeRate: number;
  marketplaceFeeBasis: MarketplaceFeeBasis;
  customerSubtotal: number;
  tolls: number;
  waitTime: number;
  emergencyDispatch: number;
  holidaySurcharge: number;
  taxes: number;
  taxRate: number;
  grandTotal: number;
};

/** Line items shown on carrier settlement — fee is informational only. */
export type CarrierSettlementBreakdown = {
  baseHaul: number;
  /** Customer-side fee retained by HaulBrokr — NOT deducted from netPayout. */
  marketplaceFee: number;
  marketplaceFeeRate: number;
  fuel: number;
  tolls: number;
  waitTime: number;
  emergencyDispatch: number;
  holidaySurcharge: number;
  netPayout: number;
};

/** Full pricing result written onto a job at completion (historical freeze). */
export type JobPricingResult = {
  rates: {
    marketplaceFeeRate: number;
    marketplaceFeeBasis: MarketplaceFeeBasis;
    fuelSurchargeRate: number;
    taxRate: number;
  };
  amounts: {
    baseHaul: number;
    fuelSurchargeAmount: number;
    marketplaceFeeAmount: number;
    customerSubtotal: number;
    tollsAmount: number;
    waitTimeHours: number;
    waitTimeAmount: number;
    emergencyDispatchAmount: number;
    holidaySurchargeAmount: number;
    taxAmount: number;
    customerTotalAmount: number;
    providerNetAmount: number;
    /** Platform revenue from the marketplace fee (excludes taxes). */
    haulbrokrMarketplaceRevenue: number;
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
  marketplaceFeeBasis: "base_haul_only",
  fuelSurchargeRate: 0,
  emergencyDispatchRate: 0.1,
  holidaySurchargeRate: 0.15,
  waitTimeRatePerHour: 75,
  waitTimeGracePeriodMinutes: 15,
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

export function resolveFeeBasis(raw: number | string | MarketplaceFeeBasis | undefined): MarketplaceFeeBasis {
  if (raw === "base_plus_surcharges" || raw === 1 || raw === "1") return "base_plus_surcharges";
  return "base_haul_only";
}

/**
 * Compute all pricing line items for a haul.
 *
 * Default: marketplace fee applies to BASE HAUL ONLY.
 * Taxes (when enabled) apply to the customer subtotal excluding the marketplace fee.
 * Carrier payout equals the customer subtotal (never reduced by the marketplace fee).
 */
export function computeJobPricing(inputs: PricingInputs, rates: PricingRates): JobPricingResult {
  const ratePerHour = nonNeg(inputs.ratePerHour);
  const hours = nonNeg(inputs.hours);
  const baseHaul = roundCents(ratePerHour * hours);

  const marketplaceFeeRate = nonNeg(rates.marketplaceFeeRate);
  const marketplaceFeeBasis = rates.marketplaceFeeBasis ?? "base_haul_only";
  const fuelSurchargeRate = nonNeg(rates.fuelSurchargeRate);

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

  const customerSubtotal = roundCents(
    baseHaul +
      fuelSurchargeAmount +
      tollsAmount +
      waitTimeAmount +
      emergencyDispatchAmount +
      holidaySurchargeAmount,
  );

  const feeBasisAmount =
    marketplaceFeeBasis === "base_plus_surcharges" ? customerSubtotal : baseHaul;
  const marketplaceFeeAmount = roundCents(feeBasisAmount * marketplaceFeeRate);

  const taxesEnabled = inputs.taxesEnabled ?? rates.taxesEnabled;
  const taxRate = taxesEnabled ? nonNeg(inputs.taxRate ?? rates.taxRate) : 0;
  // Marketplace fee is never taxed.
  const taxAmount = taxesEnabled ? roundCents(customerSubtotal * taxRate) : 0;

  const customerTotalAmount = roundCents(customerSubtotal + marketplaceFeeAmount + taxAmount);
  // Carrier receives the full accepted base haul + approved reimbursements.
  const providerNetAmount = customerSubtotal;

  const customerCheckout: CustomerCheckoutBreakdown = {
    baseHaul,
    fuelSurcharge: fuelSurchargeAmount,
    marketplaceFee: marketplaceFeeAmount,
    marketplaceFeeRate,
    marketplaceFeeBasis,
    customerSubtotal,
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
      marketplaceFeeBasis,
      fuelSurchargeRate,
      taxRate,
    },
    amounts: {
      baseHaul,
      fuelSurchargeAmount,
      marketplaceFeeAmount,
      customerSubtotal,
      tollsAmount,
      waitTimeHours,
      waitTimeAmount,
      emergencyDispatchAmount,
      holidaySurchargeAmount,
      taxAmount,
      customerTotalAmount,
      providerNetAmount,
      haulbrokrMarketplaceRevenue: marketplaceFeeAmount,
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
 * Backward-compatible helper:
 *   base = rate × hours, fee = base × feeRate, gross = base + fee
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

/**
 * Allocate a customer refund across HaulBrokr marketplace fee vs carrier payout.
 * Fee is absorbed first; remaining refund claws back from the carrier transfer.
 * Taxes (if present in the original charge) are treated as platform-held like the fee
 * for clawback purposes when reversing a customer payment.
 */
export function allocateRefund(params: {
  refundAmount: number;
  marketplaceFeeAmount: number;
  taxAmount: number;
  providerNetAmount: number;
}): { platformRefund: number; carrierClawback: number } {
  const refund = roundCents(nonNeg(params.refundAmount));
  const platformHeld = roundCents(nonNeg(params.marketplaceFeeAmount) + nonNeg(params.taxAmount));
  const carrierNet = roundCents(nonNeg(params.providerNetAmount));
  const platformRefund = roundCents(Math.min(refund, platformHeld));
  const carrierClawback = roundCents(Math.min(refund - platformRefund, carrierNet));
  return { platformRefund, carrierClawback };
}
