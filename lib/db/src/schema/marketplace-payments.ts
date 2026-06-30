import { pgTable, text, serial, timestamp, integer, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { profilesTable } from "./profiles";
import { jobsTable } from "./jobs";

export const marketplacePaymentTypeEnum = pgEnum("marketplace_payment_type", [
  "payment_intent",
  "checkout_session",
  "transfer",
  "refund",
  "invoice",
]);

export const marketplacePaymentStatusEnum = pgEnum("marketplace_payment_status", [
  "pending",
  "requires_action",
  "paid",
  "released",
  "failed",
  "refunded",
]);

export const marketplacePaymentsTable = pgTable("marketplace_payments", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id").notNull().references(() => jobsTable.id),
  customerId: integer("customer_id").notNull().references(() => profilesTable.id),
  vendorId: integer("vendor_id").notNull().references(() => profilesTable.id),
  type: marketplacePaymentTypeEnum("type").notNull(),
  status: marketplacePaymentStatusEnum("status").notNull(),
  amountCents: integer("amount_cents").notNull(),
  platformFeeCents: integer("platform_fee_cents").notNull().default(0),
  vendorPayoutCents: integer("vendor_payout_cents").notNull().default(0),
  driverPayoutCents: integer("driver_payout_cents"),
  currency: text("currency").notNull().default("usd"),
  paymentRail: text("payment_rail"),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  stripeCheckoutSessionId: text("stripe_checkout_session_id"),
  stripeTransferId: text("stripe_transfer_id"),
  stripeRefundId: text("stripe_refund_id"),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertMarketplacePaymentSchema = createInsertSchema(marketplacePaymentsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type MarketplacePayment = typeof marketplacePaymentsTable.$inferSelect;
export type InsertMarketplacePayment = z.infer<typeof insertMarketplacePaymentSchema>;
