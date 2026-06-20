import { pgTable, text, serial, timestamp, integer, numeric, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { profilesTable } from "./profiles";
import { jobsTable } from "./jobs";

export const factoringStatusEnum = pgEnum("factoring_status", ["pending", "approved", "funded", "settled", "denied"]);

export const factoringRequestsTable = pgTable("factoring_requests", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id").notNull().references(() => jobsTable.id),
  providerId: integer("provider_id").notNull().references(() => profilesTable.id),
  invoiceAmount: numeric("invoice_amount", { precision: 12, scale: 2 }).notNull(),
  feeRate: numeric("fee_rate", { precision: 5, scale: 4 }).notNull().default("0.03"),
  feeAmount: numeric("fee_amount", { precision: 12, scale: 2 }).notNull(),
  netAmount: numeric("net_amount", { precision: 12, scale: 2 }).notNull(),
  status: factoringStatusEnum("status").notNull().default("pending"),
  notes: text("notes"),
  requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
  fundedAt: timestamp("funded_at", { withTimezone: true }),
  settledAt: timestamp("settled_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertFactoringRequestSchema = createInsertSchema(factoringRequestsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertFactoringRequest = z.infer<typeof insertFactoringRequestSchema>;
export type FactoringRequest = typeof factoringRequestsTable.$inferSelect;
