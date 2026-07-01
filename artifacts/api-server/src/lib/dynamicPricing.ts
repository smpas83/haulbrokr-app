import { and, eq, isNull, lte, or, sql } from "drizzle-orm";
import { db, pricingRulesTable, type PricingRule } from "@workspace/db";
import {
  computeMarketplaceAmounts,
  resolveCommissionRule,
  type CommissionContext,
} from "./marketplaceCommission";

export type PricingInput = CommissionContext & {
  distanceMiles: number;
  estimatedHours: number;
  trucksNeeded?: number;
  baseRatePerHour?: number | null;
  truckType?: string | null;
  materialType?: string | null;
  demandLevel?: string | null;
  availableTrucks?: number | null;
  trafficLevel?: string | null;
  fuelSurcharge?: boolean | null;
  nightHauling?: boolean | null;
  weekend?: boolean | null;
  holiday?: boolean | null;
  emergencyDispatch?: boolean | null;
  remoteLocation?: boolean | null;
  weatherSeverity?: string | null;
  waitingTimeMinutes?: number | null;
  extraStops?: number | null;
};

export type PricingBreakdownItem = {
  code: PricingRule["code"] | "base_labor" | "distance";
  label: string;
  valueType: "fixed_amount" | "percent" | "multiplier";
  value: number;
  amount: number;
};

export type PricingQuote = {
  customerQuote: number;
  customerTotal: number;
  vendorPayout: number;
  driverPayout: number;
  platformCommission: number;
  marketplaceRevenue: number;
  platformProfit: number;
  gmv: number;
  commissionRate: number;
  commissionRuleId: number | null;
  commissionScope: string;
  pricingBreakdown: PricingBreakdownItem[];
};

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function num(value: string | number | null | undefined): number | null {
  if (value == null) return null;
  const parsed = typeof value === "number" ? value : Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function inputValueForRule(
  input: PricingInput,
  code: PricingRule["code"],
): number | null {
  switch (code) {
    case "available_trucks_multiplier":
      return input.availableTrucks ?? null;
    case "waiting_time_hourly_rate":
      return input.waitingTimeMinutes ?? 0;
    case "extra_stop_fee":
      return input.extraStops ?? 0;
    default:
      return null;
  }
}

function targetMatches(rule: PricingRule, input: PricingInput): boolean {
  if (!rule.targetKey) return true;
  switch (rule.code) {
    case "truck_type_multiplier":
      return rule.targetKey === input.truckType;
    case "material_multiplier":
      return rule.targetKey === input.materialType;
    case "demand_multiplier":
      return rule.targetKey === input.demandLevel;
    case "traffic_multiplier":
      return rule.targetKey === input.trafficLevel;
    case "weather_surcharge_pct":
      return rule.targetKey === input.weatherSeverity;
    default:
      return true;
  }
}

function rangeMatches(rule: PricingRule, input: PricingInput): boolean {
  const value = inputValueForRule(input, rule.code);
  if (value == null) return true;
  const min = num(rule.minInput);
  const max = num(rule.maxInput);
  if (min != null && value < min) return false;
  if (max != null && value > max) return false;
  return true;
}

function ruleApplies(rule: PricingRule, input: PricingInput): boolean {
  if (!targetMatches(rule, input) || !rangeMatches(rule, input)) return false;
  switch (rule.code) {
    case "fuel_surcharge_pct":
      return !!input.fuelSurcharge;
    case "night_surcharge_pct":
      return !!input.nightHauling;
    case "weekend_surcharge_pct":
      return !!input.weekend;
    case "holiday_surcharge_pct":
      return !!input.holiday;
    case "emergency_surcharge_pct":
      return !!input.emergencyDispatch;
    case "remote_location_surcharge_pct":
      return !!input.remoteLocation;
    case "weather_surcharge_pct":
      return !!input.weatherSeverity;
    case "waiting_time_hourly_rate":
      return (input.waitingTimeMinutes ?? 0) > 0;
    case "extra_stop_fee":
      return (input.extraStops ?? 0) > 0;
    default:
      return true;
  }
}

function bestRule(
  rules: PricingRule[],
  code: PricingRule["code"],
  input: PricingInput,
): PricingRule | null {
  return (
    rules
      .filter((rule) => rule.code === code && ruleApplies(rule, input))
      .sort((a, b) => b.priority - a.priority)[0] ?? null
  );
}

function activeModifierRules(
  rules: PricingRule[],
  input: PricingInput,
): PricingRule[] {
  const codes: PricingRule["code"][] = [
    "truck_type_multiplier",
    "material_multiplier",
    "demand_multiplier",
    "available_trucks_multiplier",
    "traffic_multiplier",
    "fuel_surcharge_pct",
    "night_surcharge_pct",
    "weekend_surcharge_pct",
    "holiday_surcharge_pct",
    "emergency_surcharge_pct",
    "remote_location_surcharge_pct",
    "weather_surcharge_pct",
  ];
  return codes
    .map((code) => bestRule(rules, code, input))
    .filter((rule): rule is PricingRule => !!rule);
}

export async function loadActivePricingRules(
  now = new Date(),
): Promise<PricingRule[]> {
  return db
    .select()
    .from(pricingRulesTable)
    .where(
      and(
        eq(pricingRulesTable.active, 1),
        lte(pricingRulesTable.effectiveFrom, now),
        or(
          isNull(pricingRulesTable.effectiveTo),
          sql`${pricingRulesTable.effectiveTo} > ${now}`,
        ),
      ),
    );
}

export async function computeDynamicQuote(
  input: PricingInput,
): Promise<PricingQuote> {
  const now = input.now ?? new Date();
  const rules = await loadActivePricingRules(now);
  const baseRateRule = bestRule(rules, "base_hourly_rate", input);
  const distanceRule = bestRule(rules, "distance_mile_rate", input);
  const waitingRule = bestRule(rules, "waiting_time_hourly_rate", input);
  const extraStopRule = bestRule(rules, "extra_stop_fee", input);

  const baseRate = input.baseRatePerHour ?? num(baseRateRule?.value);
  if (baseRate == null || baseRate <= 0) {
    throw new Error("No active base hourly pricing rule is configured.");
  }

  const trucksNeeded = Math.max(1, input.trucksNeeded ?? 1);
  const breakdown: PricingBreakdownItem[] = [];
  let vendorWorkAmount = roundMoney(
    baseRate * input.estimatedHours * trucksNeeded,
  );
  breakdown.push({
    code: "base_labor",
    label: "Base hauling labor",
    valueType: "fixed_amount",
    value: baseRate,
    amount: vendorWorkAmount,
  });

  const distanceRate = num(distanceRule?.value);
  if (distanceRate != null && input.distanceMiles > 0) {
    const amount = roundMoney(
      distanceRate * input.distanceMiles * trucksNeeded,
    );
    vendorWorkAmount = roundMoney(vendorWorkAmount + amount);
    breakdown.push({
      code: "distance",
      label: distanceRule?.label ?? "Distance",
      valueType: "fixed_amount",
      value: distanceRate,
      amount,
    });
  }

  if (waitingRule) {
    const hourly = num(waitingRule.value) ?? 0;
    const amount = roundMoney(hourly * ((input.waitingTimeMinutes ?? 0) / 60));
    vendorWorkAmount = roundMoney(vendorWorkAmount + amount);
    breakdown.push({
      code: waitingRule.code,
      label: waitingRule.label,
      valueType: waitingRule.valueType,
      value: hourly,
      amount,
    });
  }

  if (extraStopRule) {
    const fee = num(extraStopRule.value) ?? 0;
    const amount = roundMoney(fee * (input.extraStops ?? 0));
    vendorWorkAmount = roundMoney(vendorWorkAmount + amount);
    breakdown.push({
      code: extraStopRule.code,
      label: extraStopRule.label,
      valueType: extraStopRule.valueType,
      value: fee,
      amount,
    });
  }

  for (const rule of activeModifierRules(rules, input)) {
    const value = num(rule.value) ?? 0;
    if (rule.valueType === "multiplier") {
      const amount = roundMoney(vendorWorkAmount * (value - 1));
      vendorWorkAmount = roundMoney(vendorWorkAmount + amount);
      breakdown.push({
        code: rule.code,
        label: rule.label,
        valueType: rule.valueType,
        value,
        amount,
      });
    } else if (rule.valueType === "percent") {
      const amount = roundMoney(vendorWorkAmount * value);
      vendorWorkAmount = roundMoney(vendorWorkAmount + amount);
      breakdown.push({
        code: rule.code,
        label: rule.label,
        valueType: rule.valueType,
        value,
        amount,
      });
    }
  }

  const commission = await resolveCommissionRule({
    customerId: input.customerId,
    vendorId: input.vendorId,
    projectId: input.projectId,
    emergency: input.emergencyDispatch ?? input.emergency,
    now,
  });
  const amounts = computeMarketplaceAmounts(vendorWorkAmount, commission.rate);

  return {
    customerQuote: amounts.customerTotal,
    customerTotal: amounts.customerTotal,
    vendorPayout: amounts.vendorPayout,
    driverPayout: amounts.driverPayout,
    platformCommission: amounts.platformCommission,
    marketplaceRevenue: amounts.marketplaceRevenue,
    platformProfit: amounts.platformProfit,
    gmv: amounts.gmv,
    commissionRate: commission.rate,
    commissionRuleId: commission.ruleId,
    commissionScope: commission.scope,
    pricingBreakdown: breakdown,
  };
}
