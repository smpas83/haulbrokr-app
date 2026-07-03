import { desc, eq } from "drizzle-orm";
import { db, marketplaceConfigsTable, type MarketplaceConfig } from "@workspace/db";

export const DEFAULT_COMMISSION_RATE = 0.20;

export interface MarketplacePricingConfig {
  id: number | null;
  name: string;
  commissionRate: number;
  surchargeRate: number;
  flatSurchargeCents: number;
  currency: string;
}

export interface MarketplacePricingInput {
  ratePerHour: number;
  hours: number;
  config: MarketplacePricingConfig;
}

export interface MarketplacePricingBreakdown {
  base: number;
  commission: number;
  surcharge: number;
  platformFee: number;
  gross: number;
  providerNet: number;
}

export const DEFAULT_MARKETPLACE_PRICING_CONFIG: MarketplacePricingConfig = {
  id: null,
  name: "default",
  commissionRate: DEFAULT_COMMISSION_RATE,
  surchargeRate: 0,
  flatSurchargeCents: 0,
  currency: "usd",
};

function money(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function rate(value: string | number | null | undefined, fallback: number): number {
  if (value == null) return fallback;
  const parsed = typeof value === "number" ? value : Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeConfig(config: MarketplaceConfig | undefined): MarketplacePricingConfig {
  if (!config) return DEFAULT_MARKETPLACE_PRICING_CONFIG;
  return {
    id: config.id,
    name: config.name,
    commissionRate: rate(config.commissionRate, DEFAULT_COMMISSION_RATE),
    surchargeRate: rate(config.surchargeRate, 0),
    flatSurchargeCents: config.flatSurchargeCents,
    currency: config.currency,
  };
}

export async function getActiveMarketplacePricingConfig(): Promise<MarketplacePricingConfig> {
  const [config] = await db
    .select()
    .from(marketplaceConfigsTable)
    .where(eq(marketplaceConfigsTable.isActive, 1))
    .orderBy(desc(marketplaceConfigsTable.effectiveFrom), desc(marketplaceConfigsTable.id))
    .limit(1);

  return normalizeConfig(config);
}

export function computeSurcharge(base: number, config: MarketplacePricingConfig): number {
  const percentageSurcharge = money(base * config.surchargeRate);
  const flatSurcharge = money(config.flatSurchargeCents / 100);
  return money(percentageSurcharge + flatSurcharge);
}

export function computeMarketplacePricing({
  ratePerHour,
  hours,
  config,
}: MarketplacePricingInput): MarketplacePricingBreakdown {
  const base = money(ratePerHour * hours);
  const commission = money(base * config.commissionRate);
  const surcharge = computeSurcharge(base, config);
  const platformFee = money(commission + surcharge);
  const gross = money(base + platformFee);

  return {
    base,
    commission,
    surcharge,
    platformFee,
    gross,
    providerNet: base,
  };
}

export function formatRatePercent(value: number): string {
  return `${money(value * 100)}%`;
}
