import { pgTable, text, serial, timestamp, integer, numeric, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const marketplaceConfigsTable = pgTable(
  "marketplace_configs",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull().default("default"),
    commissionRate: numeric("commission_rate", { precision: 5, scale: 4 }).notNull().default("0.20"),
    surchargeRate: numeric("surcharge_rate", { precision: 5, scale: 4 }).notNull().default("0"),
    flatSurchargeCents: integer("flat_surcharge_cents").notNull().default(0),
    currency: text("currency").notNull().default("usd"),
    isActive: integer("is_active").notNull().default(1),
    effectiveFrom: timestamp("effective_from", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [
    index("marketplace_configs_active_effective_idx").on(t.isActive, t.effectiveFrom),
  ],
);

export const insertMarketplaceConfigSchema = createInsertSchema(marketplaceConfigsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertMarketplaceConfig = z.infer<typeof insertMarketplaceConfigSchema>;
export type MarketplaceConfig = typeof marketplaceConfigsTable.$inferSelect;
