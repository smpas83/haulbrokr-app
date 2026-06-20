import { pgTable, text, serial, timestamp, integer, numeric, boolean, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { profilesTable } from "./profiles";

export const creditAppStatusEnum = pgEnum("credit_app_status", [
  "not_submitted",
  "pending",
  "approved",
  "rejected",
]);

export const creditApplicationsTable = pgTable("credit_applications", {
  id: serial("id").primaryKey(),
  profileId: integer("profile_id").notNull().unique().references(() => profilesTable.id, { onDelete: "cascade" }),
  wantsInvoicing: boolean("wants_invoicing").notNull().default(false),
  tradeReferences: text("trade_references"),
  bankReference: text("bank_reference"),
  estimatedMonthlySpend: numeric("estimated_monthly_spend", { precision: 12, scale: 2 }),
  status: creditAppStatusEnum("status").notNull().default("pending"),
  reviewNote: text("review_note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertCreditApplicationSchema = createInsertSchema(creditApplicationsTable).omit({ id: true, createdAt: true, updatedAt: true, status: true });
export type InsertCreditApplication = z.infer<typeof insertCreditApplicationSchema>;
export type CreditApplication = typeof creditApplicationsTable.$inferSelect;
