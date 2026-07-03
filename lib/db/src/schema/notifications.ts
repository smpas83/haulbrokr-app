import { pgTable, text, serial, timestamp, integer, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { profilesTable } from "./profiles";
import { jobsTable } from "./jobs";

export const notificationEventTypeEnum = pgEnum("notification_event_type", [
  "job_assigned",
  "driver_accepted",
  "driver_arrived",
  "load_complete",
  "payment_complete",
  "review_request",
  "compliance_reminder",
]);

export const notificationChannelEnum = pgEnum("notification_channel", [
  "in_app",
  "email",
  "sms",
  "push",
  "realtime",
]);

export const notificationDeliveryStatusEnum = pgEnum("notification_delivery_status", [
  "pending",
  "sent",
  "skipped",
  "failed",
]);

export const notificationDeliveriesTable = pgTable("notification_deliveries", {
  id: serial("id").primaryKey(),
  eventType: notificationEventTypeEnum("event_type").notNull(),
  channel: notificationChannelEnum("channel").notNull(),
  status: notificationDeliveryStatusEnum("status").notNull(),
  recipientProfileId: integer("recipient_profile_id").notNull().references(() => profilesTable.id),
  jobId: integer("job_id").references(() => jobsTable.id),
  subject: text("subject"),
  body: text("body").notNull(),
  providerMessageId: text("provider_message_id"),
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertNotificationDeliverySchema = createInsertSchema(notificationDeliveriesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type NotificationDelivery = typeof notificationDeliveriesTable.$inferSelect;
export type InsertNotificationDelivery = z.infer<typeof insertNotificationDeliverySchema>;
