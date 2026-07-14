import { pgTable, text, serial, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/** Idempotency ledger for Stripe webhook deliveries. */
export const stripeWebhookEventsTable = pgTable("stripe_webhook_events", {
  id: serial("id").primaryKey(),
  stripeEventId: text("stripe_event_id").notNull().unique(),
  eventType: text("event_type").notNull(),
  handled: boolean("handled").notNull().default(false),
  action: text("action"),
  reason: text("reason"),
  processedAt: timestamp("processed_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertStripeWebhookEventSchema = createInsertSchema(
  stripeWebhookEventsTable,
).omit({
  id: true,
  processedAt: true,
});
export type InsertStripeWebhookEvent = z.infer<
  typeof insertStripeWebhookEventSchema
>;
export type StripeWebhookEvent = typeof stripeWebhookEventsTable.$inferSelect;
