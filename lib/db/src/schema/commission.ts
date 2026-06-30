import { pgTable, text, serial, timestamp, integer, numeric, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { profilesTable } from "./profiles";
import { projectsTable } from "./projects";
import { jobsTable } from "./jobs";

export const commissionScopeTypeEnum = pgEnum("commission_scope_type", [
  "global",
  "customer",
  "vendor",
  "project",
]);

export const commissionAuditActionEnum = pgEnum("commission_audit_action", [
  "created",
  "updated",
  "disabled",
  "calculated",
]);

export const commissionConfigsTable = pgTable("commission_configs", {
  id: serial("id").primaryKey(),
  scopeType: commissionScopeTypeEnum("scope_type").notNull(),
  scopeId: integer("scope_id"),
  rate: numeric("rate", { precision: 5, scale: 4 }).notNull(),
  active: integer("active").notNull().default(1),
  reason: text("reason"),
  createdByProfileId: integer("created_by_profile_id").references(() => profilesTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const commissionAuditTable = pgTable("commission_audit", {
  id: serial("id").primaryKey(),
  action: commissionAuditActionEnum("action").notNull(),
  scopeType: commissionScopeTypeEnum("scope_type").notNull(),
  scopeId: integer("scope_id"),
  configId: integer("config_id").references(() => commissionConfigsTable.id),
  previousRate: numeric("previous_rate", { precision: 5, scale: 4 }),
  newRate: numeric("new_rate", { precision: 5, scale: 4 }),
  actorProfileId: integer("actor_profile_id").references(() => profilesTable.id),
  reason: text("reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const commissionCalculationsTable = pgTable("commission_calculations", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id").notNull().references(() => jobsTable.id),
  sourceConfigId: integer("source_config_id").references(() => commissionConfigsTable.id),
  scopeType: commissionScopeTypeEnum("scope_type").notNull(),
  scopeId: integer("scope_id"),
  commissionRate: numeric("commission_rate", { precision: 5, scale: 4 }).notNull(),
  workAmount: numeric("work_amount", { precision: 12, scale: 2 }).notNull(),
  platformCommission: numeric("platform_commission", { precision: 12, scale: 2 }).notNull(),
  customerTotal: numeric("customer_total", { precision: 12, scale: 2 }).notNull(),
  vendorPayout: numeric("vendor_payout", { precision: 12, scale: 2 }).notNull(),
  driverPayout: numeric("driver_payout", { precision: 12, scale: 2 }),
  internalProfit: numeric("internal_profit", { precision: 12, scale: 2 }).notNull(),
  marketplaceGmv: numeric("marketplace_gmv", { precision: 12, scale: 2 }).notNull(),
  calculatedAt: timestamp("calculated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertCommissionConfigSchema = createInsertSchema(commissionConfigsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertCommissionAuditSchema = createInsertSchema(commissionAuditTable).omit({ id: true, createdAt: true });
export const insertCommissionCalculationSchema = createInsertSchema(commissionCalculationsTable).omit({ id: true, calculatedAt: true });

export type CommissionConfig = typeof commissionConfigsTable.$inferSelect;
export type InsertCommissionConfig = z.infer<typeof insertCommissionConfigSchema>;
export type CommissionAudit = typeof commissionAuditTable.$inferSelect;
export type CommissionCalculation = typeof commissionCalculationsTable.$inferSelect;
