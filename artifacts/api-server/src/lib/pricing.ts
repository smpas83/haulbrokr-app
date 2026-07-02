export type MarginType = "fixed" | "percentage";
export type PricingAudience = "broker" | "customer" | "payee";

export interface PricingCharge {
  type?: MarginType;
  value: number;
  label?: string;
  applies?: boolean;
}

export interface MarketplacePricingRules {
  customerSpecific?: PricingCharge | number | null;
  fleetSpecific?: PricingCharge | number | null;
  driverSpecific?: PricingCharge | number | null;
  materialSpecific?: PricingCharge | number | null;
  rush?: PricingCharge | number | null;
  weekend?: PricingCharge | number | null;
  holiday?: PricingCharge | number | null;
  night?: PricingCharge | number | null;
  waitingCharge?: PricingCharge | number | null;
  fuelSurcharge?: PricingCharge | number | null;
  cancellationFee?: PricingCharge | number | null;
  noShowFee?: PricingCharge | number | null;
}

export interface MarketplacePricingInput {
  driverRatePerHour: number;
  estimatedHours: number;
  truckCount?: number;
  brokerMarginType?: MarginType;
  brokerMarginValue?: number;
  pricingRules?: MarketplacePricingRules | Record<string, unknown> | null;
}

interface PricingLine {
  code: string;
  label: string;
  amount: number;
  visibility: PricingAudience[];
}

export interface MarketplacePricingBreakdown {
  driverPay: number;
  brokerMargin: number;
  brokerProfit: number;
  customerSubtotal: number;
  customerTotal: number;
  lineItems: PricingLine[];
}

export interface PayeePricingView {
  driverPay: number;
  lineItems: PricingLine[];
}

export interface CustomerPricingView {
  customerSubtotal: number;
  customerTotal: number;
  lineItems: PricingLine[];
}

export const DEFAULT_BROKER_MARGIN_RATE = 0.15;

const PRICING_LABELS: Record<keyof MarketplacePricingRules, string> = {
  customerSpecific: "Customer-specific pricing",
  fleetSpecific: "Fleet-specific pricing",
  driverSpecific: "Driver-specific pricing",
  materialSpecific: "Material-specific pricing",
  rush: "Rush pricing",
  weekend: "Weekend pricing",
  holiday: "Holiday pricing",
  night: "Night pricing",
  waitingCharge: "Waiting charges",
  fuelSurcharge: "Fuel surcharge",
  cancellationFee: "Cancellation fee",
  noShowFee: "No-show fee",
};

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function normalizePercentage(value: number): number {
  return value > 1 ? value / 100 : value;
}

function chargeAmount(base: number, charge: PricingCharge | number | null | undefined): number {
  if (charge == null) return 0;
  if (typeof charge === "number") return roundMoney(charge);
  if (charge.applies === false) return 0;
  const type = charge.type ?? "fixed";
  return roundMoney(type === "percentage" ? base * normalizePercentage(charge.value) : charge.value);
}

function chargeLabel(key: keyof MarketplacePricingRules, charge: PricingCharge | number | null | undefined): string {
  if (typeof charge === "object" && charge?.label) return charge.label;
  return PRICING_LABELS[key];
}

function numeric(value: unknown, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function computeMarketplacePricing(input: MarketplacePricingInput): MarketplacePricingBreakdown {
  const truckCount = Math.max(1, Math.trunc(numeric(input.truckCount, 1)));
  const hours = Math.max(0, numeric(input.estimatedHours, 0));
  const rate = Math.max(0, numeric(input.driverRatePerHour, 0));
  const driverPay = roundMoney(rate * hours * truckCount);
  const marginType = input.brokerMarginType ?? "percentage";
  const marginValue = numeric(input.brokerMarginValue, DEFAULT_BROKER_MARGIN_RATE);
  const brokerMargin = roundMoney(
    marginType === "percentage" ? driverPay * normalizePercentage(marginValue) : marginValue,
  );
  const rules = (input.pricingRules ?? {}) as MarketplacePricingRules;

  const lineItems: PricingLine[] = [
    {
      code: "driver_pay",
      label: "Driver pay",
      amount: driverPay,
      visibility: ["broker", "payee"],
    },
    {
      code: "broker_margin",
      label: marginType === "percentage" ? "Broker percentage margin" : "Broker fixed margin",
      amount: brokerMargin,
      visibility: ["broker"],
    },
  ];

  let customerTotal = driverPay + brokerMargin;
  for (const key of Object.keys(PRICING_LABELS) as Array<keyof MarketplacePricingRules>) {
    const amount = chargeAmount(driverPay, rules[key]);
    if (amount === 0) continue;
    customerTotal += amount;
    lineItems.push({
      code: key,
      label: chargeLabel(key, rules[key]),
      amount,
      visibility: ["broker", "customer"],
    });
  }

  const roundedTotal = roundMoney(customerTotal);
  return {
    driverPay,
    brokerMargin,
    brokerProfit: roundMoney(roundedTotal - driverPay),
    customerSubtotal: roundMoney(driverPay + brokerMargin),
    customerTotal: roundedTotal,
    lineItems,
  };
}

export function pricingForAudience(
  breakdown: MarketplacePricingBreakdown,
  audience: PricingAudience,
): MarketplacePricingBreakdown | CustomerPricingView | PayeePricingView {
  const lineItems = breakdown.lineItems.filter((item) => item.visibility.includes(audience));
  if (audience === "broker") return { ...breakdown, lineItems };
  if (audience === "customer") {
    return {
      customerSubtotal: breakdown.customerSubtotal,
      customerTotal: breakdown.customerTotal,
      lineItems,
    };
  }
  return {
    driverPay: breakdown.driverPay,
    lineItems,
  };
}
