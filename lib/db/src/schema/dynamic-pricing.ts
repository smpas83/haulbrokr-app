import { pgTable, text, serial, timestamp, integer, numeric, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { jobsTable } from "./jobs";
import { profilesTable } from "./profiles";

export const pricingSurchargeTypeEnum = pgEnum("pricing_surcharge_type", [
  "demand",
  "truck_shortage",
  "night_hauling",
  "weekend",
  "holiday",
  "emergency_dispatch",
  "weather",
  "traffic",
  "remote_jobsite",
  "waiting_time",
  "toll_roads",
]);

export const pricingSurchargeModeEnum = pgEnum("pricing_surcharge_mode", [
  "percentage",
  "fixed_amount",
]);

export const pricingSurchargeConfigsTable = pgTable("pricing_surcharge_configs", {
  id: serial("id").primaryKey(),
  surchargeType: pricingSurchargeTypeEnum("surcharge_type").notNull(),
  mode: pricingSurchargeModeEnum("mode").notNull(),
  value: numeric("value", { precision: 10, scale: 4 }).notNull(),
  active: integer("active").notNull().default(1),
  reason: text("reason"),
  createdByProfileId: integer("created_by_profile_id").references(() => profilesTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const pricingCalculationsTable = pgTable("pricing_calculations", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id").notNull().references(() => jobsTable.id),
  baseAmount: numeric("base_amount", { precision: 12, scale: 2 }).notNull(),
  surchargeTotal: numeric("surcharge_total", { precision: 12, scale: 2 }).notNull(),
  pricedAmount: numeric("priced_amount", { precision: 12, scale: 2 }).notNull(),
  appliedSurchargesJson: text("applied_surcharges_json").notNull().default("[]"),
  calculatedAt: timestamp("calculated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertPricingSurchargeConfigSchema = createInsertSchema(pricingSurchargeConfigsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertPricingCalculationSchema = createInsertSchema(pricingCalculationsTable).omit({
  id: true,
  calculatedAt: true,
});

export type PricingSurchargeConfig = typeof pricingSurchargeConfigsTable.$inferSelect;
export type InsertPricingSurchargeConfig = z.infer<typeof insertPricingSurchargeConfigSchema>;
export type PricingCalculation = typeof pricingCalculationsTable.$inferSelect;
