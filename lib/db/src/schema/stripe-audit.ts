import { pgTable, text, serial, timestamp, integer, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { jobsTable } from "./jobs";
import { profilesTable } from "./profiles";

export const stripeWebhookEventsTable = pgTable("stripe_webhook_events", {
  eventId: text("event_id").primaryKey(),
  eventType: text("event_type").notNull(),
  objectId: text("object_id"),
  status: text("status").notNull().default("processing"),
  action: text("action"),
  error: text("error"),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
  processedAt: timestamp("processed_at", { withTimezone: true }),
});

export const paymentAuditLogsTable = pgTable(
  "payment_audit_logs",
  {
    id: serial("id").primaryKey(),
    jobId: integer("job_id").references(() => jobsTable.id),
    profileId: integer("profile_id").references(() => profilesTable.id),
    eventType: text("event_type").notNull(),
    status: text("status").notNull(),
    amountCents: integer("amount_cents"),
    currency: text("currency").notNull().default("usd"),
    stripeEventId: text("stripe_event_id"),
    stripePaymentIntentId: text("stripe_payment_intent_id"),
    stripeChargeId: text("stripe_charge_id"),
    stripeTransferId: text("stripe_transfer_id"),
    stripeRefundId: text("stripe_refund_id"),
    stripeInvoiceId: text("stripe_invoice_id"),
    stripePayoutId: text("stripe_payout_id"),
    message: text("message"),
    metadataJson: text("metadata_json"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("payment_audit_logs_job_idx").on(t.jobId),
    index("payment_audit_logs_created_idx").on(t.createdAt),
  ],
);

export const insertStripeWebhookEventSchema = createInsertSchema(stripeWebhookEventsTable);
export const insertPaymentAuditLogSchema = createInsertSchema(paymentAuditLogsTable).omit({
  id: true,
  createdAt: true,
});
export type StripeWebhookEventRecord = typeof stripeWebhookEventsTable.$inferSelect;
export type InsertStripeWebhookEvent = z.infer<typeof insertStripeWebhookEventSchema>;
export type PaymentAuditLog = typeof paymentAuditLogsTable.$inferSelect;
export type InsertPaymentAuditLog = z.infer<typeof insertPaymentAuditLogSchema>;
