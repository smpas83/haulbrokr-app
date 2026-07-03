import { desc, eq } from "drizzle-orm";
import {
  db,
  pricingCalculationsTable,
  pricingSurchargeConfigsTable,
  type PricingSurchargeConfig,
} from "@workspace/db";

export type PricingSurchargeType =
  | "demand"
  | "truck_shortage"
  | "night_hauling"
  | "weekend"
  | "holiday"
  | "emergency_dispatch"
  | "weather"
  | "traffic"
  | "remote_jobsite"
  | "waiting_time"
  | "toll_roads";

export type PricingSurchargeMode = "percentage" | "fixed_amount";

export type AppliedSurcharge = {
  configId: number;
  surchargeType: PricingSurchargeType;
  mode: PricingSurchargeMode;
  value: number;
  amount: number;
};

export type DynamicPricingBreakdown = {
  baseAmount: number;
  surchargeTotal: number;
  pricedAmount: number;
  appliedSurcharges: AppliedSurcharge[];
};

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function parseConfig(row: PricingSurchargeConfig): {
  id: number;
  surchargeType: PricingSurchargeType;
  mode: PricingSurchargeMode;
  value: number;
} {
  return {
    id: row.id,
    surchargeType: row.surchargeType,
    mode: row.mode,
    value: parseFloat(row.value),
  };
}

export function calculateDynamicPricing(baseAmount: number, configs: PricingSurchargeConfig[]): DynamicPricingBreakdown {
  if (!Number.isFinite(baseAmount) || baseAmount < 0) {
    throw new Error("Base amount must be a non-negative finite number.");
  }
  const normalizedBase = roundMoney(baseAmount);
  const appliedSurcharges = configs
    .filter((row) => row.active === 1)
    .map(parseConfig)
    .map((config) => {
      if (!Number.isFinite(config.value) || config.value < 0) {
        throw new Error(`Invalid surcharge value for ${config.surchargeType}.`);
      }
      const amount = config.mode === "percentage"
        ? roundMoney(normalizedBase * config.value)
        : roundMoney(config.value);
      return {
        configId: config.id,
        surchargeType: config.surchargeType,
        mode: config.mode,
        value: config.value,
        amount,
      };
    });
  const surchargeTotal = roundMoney(appliedSurcharges.reduce((sum, surcharge) => sum + surcharge.amount, 0));
  return {
    baseAmount: normalizedBase,
    surchargeTotal,
    pricedAmount: roundMoney(normalizedBase + surchargeTotal),
    appliedSurcharges,
  };
}

export function calculateDynamicPricingFromHours(ratePerHour: number, hours: number, configs: PricingSurchargeConfig[]): DynamicPricingBreakdown {
  return calculateDynamicPricing(roundMoney(ratePerHour * hours), configs);
}

export async function listActiveSurchargeConfigs(): Promise<PricingSurchargeConfig[]> {
  return db
    .select()
    .from(pricingSurchargeConfigsTable)
    .where(eq(pricingSurchargeConfigsTable.active, 1))
    .orderBy(desc(pricingSurchargeConfigsTable.updatedAt));
}

export async function recordPricingCalculation(args: {
  jobId: number;
  breakdown: DynamicPricingBreakdown;
}): Promise<void> {
  await db.insert(pricingCalculationsTable).values({
    jobId: args.jobId,
    baseAmount: String(args.breakdown.baseAmount),
    surchargeTotal: String(args.breakdown.surchargeTotal),
    pricedAmount: String(args.breakdown.pricedAmount),
    appliedSurchargesJson: JSON.stringify(args.breakdown.appliedSurcharges),
  });
}
