import { pgTable, text, serial, timestamp, numeric, date, boolean, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Platform-wide pricing configuration. All marketplace percentages and flat
 * rates live here so nothing is hardcoded in payment / settlement paths.
 * One row per setting key; values are stored as numeric strings for precision.
 */
export const pricingSettingsTable = pgTable(
  "pricing_settings",
  {
    id: serial("id").primaryKey(),
    key: text("key").notNull(),
    value: numeric("value", { precision: 12, scale: 6 }).notNull(),
    description: text("description"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    keyUidx: uniqueIndex("pricing_settings_key_uidx").on(t.key),
  }),
);

/**
 * Weekly national diesel fuel surcharge schedule. Admins publish a surcharge
 * rate (and optional EIA diesel price reference) for each week. The pricing
 * engine resolves the active week by `weekStartDate <= today`.
 */
export const fuelSurchargeWeeksTable = pgTable(
  "fuel_surcharge_weeks",
  {
    id: serial("id").primaryKey(),
    weekStartDate: date("week_start_date").notNull(),
    nationalDieselPrice: numeric("national_diesel_price", { precision: 8, scale: 3 }),
    surchargeRate: numeric("surcharge_rate", { precision: 5, scale: 4 }).notNull(),
    notes: text("notes"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => ({
    weekStartUidx: uniqueIndex("fuel_surcharge_weeks_week_start_uidx").on(t.weekStartDate),
  }),
);

export const insertPricingSettingSchema = createInsertSchema(pricingSettingsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertPricingSetting = z.infer<typeof insertPricingSettingSchema>;
export type PricingSetting = typeof pricingSettingsTable.$inferSelect;

export const insertFuelSurchargeWeekSchema = createInsertSchema(fuelSurchargeWeeksTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertFuelSurchargeWeek = z.infer<typeof insertFuelSurchargeWeekSchema>;
export type FuelSurchargeWeek = typeof fuelSurchargeWeeksTable.$inferSelect;

/** Canonical setting keys used by the pricing engine. */
export const PRICING_SETTING_KEYS = [
  "marketplace_fee_rate",
  "fuel_surcharge_rate",
  "emergency_dispatch_rate",
  "holiday_surcharge_rate",
  "wait_time_rate_per_hour",
  "tax_rate",
  "tax_enabled",
] as const;

export type PricingSettingKey = (typeof PRICING_SETTING_KEYS)[number];
