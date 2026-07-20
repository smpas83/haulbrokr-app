import { asc, desc, eq, lte, and } from "drizzle-orm";
import {
  db,
  pricingSettingsTable,
  fuelSurchargeWeeksTable,
  type PricingSettingKey,
} from "@workspace/db";
import { DEFAULT_PRICING_RATES, type PricingRates } from "./engine";

/** Human-readable descriptions seeded with each setting row. */
export const PRICING_SETTING_META: Record<
  PricingSettingKey,
  { description: string; defaultValue: number }
> = {
  marketplace_fee_rate: {
    description: "Marketplace / broker fee charged to the customer on base haul (decimal, e.g. 0.15 = 15%)",
    defaultValue: DEFAULT_PRICING_RATES.marketplaceFeeRate,
  },
  fuel_surcharge_rate: {
    description:
      "Fallback fuel surcharge rate when no weekly diesel schedule row is active (decimal of base haul)",
    defaultValue: DEFAULT_PRICING_RATES.fuelSurchargeRate,
  },
  emergency_dispatch_rate: {
    description: "Emergency dispatch surcharge as a decimal of base haul",
    defaultValue: DEFAULT_PRICING_RATES.emergencyDispatchRate,
  },
  holiday_surcharge_rate: {
    description: "Holiday haul surcharge as a decimal of base haul",
    defaultValue: DEFAULT_PRICING_RATES.holidaySurchargeRate,
  },
  wait_time_rate_per_hour: {
    description: "Wait-time charge in USD per billable hour",
    defaultValue: DEFAULT_PRICING_RATES.waitTimeRatePerHour,
  },
  tax_rate: {
    description: "Default sales/use tax rate as a decimal (applied when tax_enabled = 1)",
    defaultValue: DEFAULT_PRICING_RATES.taxRate,
  },
  tax_enabled: {
    description: "Whether taxes are applied by default (1 = yes, 0 = no)",
    defaultValue: DEFAULT_PRICING_RATES.taxesEnabled ? 1 : 0,
  },
};

function parseSettingValue(raw: string | null | undefined, fallback: number): number {
  if (raw == null) return fallback;
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Ensure every canonical pricing key exists in the DB. Idempotent — safe to
 * call on API boot and before admin reads.
 */
export async function ensurePricingSettingsSeeded(): Promise<void> {
  const existing = await db.select().from(pricingSettingsTable);
  const have = new Set(existing.map((r) => r.key));
  for (const [key, meta] of Object.entries(PRICING_SETTING_META) as Array<
    [PricingSettingKey, (typeof PRICING_SETTING_META)[PricingSettingKey]]
  >) {
    if (have.has(key)) continue;
    await db.insert(pricingSettingsTable).values({
      key,
      value: String(meta.defaultValue),
      description: meta.description,
    });
  }
}

/** Load all pricing settings as a key→number map (after seeding defaults). */
export async function loadPricingSettingsMap(): Promise<Record<string, number>> {
  await ensurePricingSettingsSeeded();
  const rows = await db.select().from(pricingSettingsTable);
  const map: Record<string, number> = {};
  for (const row of rows) {
    map[row.key] = parseSettingValue(row.value, 0);
  }
  return map;
}

/**
 * Resolve the active fuel surcharge rate for a given date.
 * Prefers the most recent weekly schedule row with weekStartDate <= asOf.
 * Falls back to the `fuel_surcharge_rate` setting, then 0.
 */
export async function resolveFuelSurchargeRate(
  asOf: Date = new Date(),
  fallbackRate = 0,
): Promise<{ rate: number; weekStartDate: string | null; nationalDieselPrice: number | null }> {
  const asOfDate = asOf.toISOString().slice(0, 10);
  const rows = await db
    .select()
    .from(fuelSurchargeWeeksTable)
    .where(and(eq(fuelSurchargeWeeksTable.isActive, true), lte(fuelSurchargeWeeksTable.weekStartDate, asOfDate)))
    .orderBy(desc(fuelSurchargeWeeksTable.weekStartDate))
    .limit(1);

  if (rows[0]) {
    return {
      rate: parseSettingValue(rows[0].surchargeRate, fallbackRate),
      weekStartDate: rows[0].weekStartDate,
      nationalDieselPrice:
        rows[0].nationalDieselPrice != null ? parseFloat(rows[0].nationalDieselPrice) : null,
    };
  }
  return { rate: fallbackRate, weekStartDate: null, nationalDieselPrice: null };
}

/** Build a PricingRates object from DB settings + active fuel week. */
export async function loadPricingRates(asOf: Date = new Date()): Promise<PricingRates> {
  const map = await loadPricingSettingsMap();
  const fallbackFuel = parseSettingValue(
    map.fuel_surcharge_rate != null ? String(map.fuel_surcharge_rate) : null,
    DEFAULT_PRICING_RATES.fuelSurchargeRate,
  );
  const fuel = await resolveFuelSurchargeRate(asOf, fallbackFuel);

  return {
    marketplaceFeeRate: map.marketplace_fee_rate ?? DEFAULT_PRICING_RATES.marketplaceFeeRate,
    fuelSurchargeRate: fuel.rate,
    emergencyDispatchRate: map.emergency_dispatch_rate ?? DEFAULT_PRICING_RATES.emergencyDispatchRate,
    holidaySurchargeRate: map.holiday_surcharge_rate ?? DEFAULT_PRICING_RATES.holidaySurchargeRate,
    waitTimeRatePerHour: map.wait_time_rate_per_hour ?? DEFAULT_PRICING_RATES.waitTimeRatePerHour,
    taxRate: map.tax_rate ?? DEFAULT_PRICING_RATES.taxRate,
    taxesEnabled: (map.tax_enabled ?? 0) >= 1,
  };
}

/** Upsert a single pricing setting by key. */
export async function upsertPricingSetting(key: string, value: number, description?: string | null) {
  const existing = await db
    .select()
    .from(pricingSettingsTable)
    .where(eq(pricingSettingsTable.key, key))
    .limit(1);

  if (existing[0]) {
    const [row] = await db
      .update(pricingSettingsTable)
      .set({
        value: String(value),
        ...(description != null ? { description } : {}),
      })
      .where(eq(pricingSettingsTable.key, key))
      .returning();
    return row;
  }

  const [row] = await db
    .insert(pricingSettingsTable)
    .values({
      key,
      value: String(value),
      description: description ?? PRICING_SETTING_META[key as PricingSettingKey]?.description ?? null,
    })
    .returning();
  return row;
}

/** List fuel surcharge weeks newest-first. */
export async function listFuelSurchargeWeeks() {
  return db
    .select()
    .from(fuelSurchargeWeeksTable)
    .orderBy(desc(fuelSurchargeWeeksTable.weekStartDate));
}

/** Create or update a weekly fuel surcharge row (unique on weekStartDate). */
export async function upsertFuelSurchargeWeek(input: {
  weekStartDate: string;
  surchargeRate: number;
  nationalDieselPrice?: number | null;
  notes?: string | null;
  isActive?: boolean;
}) {
  const existing = await db
    .select()
    .from(fuelSurchargeWeeksTable)
    .where(eq(fuelSurchargeWeeksTable.weekStartDate, input.weekStartDate))
    .limit(1);

  const values = {
    weekStartDate: input.weekStartDate,
    surchargeRate: String(input.surchargeRate),
    nationalDieselPrice:
      input.nationalDieselPrice != null ? String(input.nationalDieselPrice) : null,
    notes: input.notes ?? null,
    isActive: input.isActive ?? true,
  };

  if (existing[0]) {
    const [row] = await db
      .update(fuelSurchargeWeeksTable)
      .set(values)
      .where(eq(fuelSurchargeWeeksTable.id, existing[0].id))
      .returning();
    return row;
  }

  const [row] = await db.insert(fuelSurchargeWeeksTable).values(values).returning();
  return row;
}

export async function deleteFuelSurchargeWeek(id: number) {
  const [row] = await db
    .delete(fuelSurchargeWeeksTable)
    .where(eq(fuelSurchargeWeeksTable.id, id))
    .returning();
  return row ?? null;
}

/** Admin list helper — settings in stable key order. */
export async function listPricingSettings() {
  await ensurePricingSettingsSeeded();
  return db.select().from(pricingSettingsTable).orderBy(asc(pricingSettingsTable.key));
}
