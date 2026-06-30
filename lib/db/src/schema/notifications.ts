import {
  pgTable,
  text,
  serial,
  timestamp,
  integer,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { profilesTable } from "./profiles";

// First-class, per-recipient notification inbox with read state. This is
// additive to the existing `activity` feed (which is an append-only audit log
// with no read tracking) — notifications are the user-facing, actionable items.

export const NOTIFICATION_TYPES = [
  "compliance_approved",
  "compliance_rejected",
  "compliance_expiring",
  "compliance_expired",
  "job_accepted",
  "payout_delayed",
  "generic",
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const NOTIFICATION_CHANNELS = [
  "in_app",
  "email",
  "sms",
  "push",
  "realtime",
] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export const NOTIFICATION_DELIVERY_STATUSES = [
  "sent",
  "skipped",
  "failed",
] as const;
export type NotificationDeliveryStatus =
  (typeof NOTIFICATION_DELIVERY_STATUSES)[number];

export const notificationsTable = pgTable(
  "notifications",
  {
    id: serial("id").primaryKey(),
    recipientProfileId: integer("recipient_profile_id")
      .notNull()
      .references(() => profilesTable.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    // Loose reference so a notification can point at any resource without a FK
    // per resource type (e.g. relatedType="compliance_document", relatedId=42).
    relatedType: text("related_type"),
    relatedId: integer("related_id"),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("notifications_recipient_idx").on(t.recipientProfileId),
    index("notifications_recipient_read_idx").on(
      t.recipientProfileId,
      t.readAt,
    ),
    index("notifications_recipient_created_idx").on(
      t.recipientProfileId,
      t.createdAt,
    ),
  ],
);

export const notificationDeliveriesTable = pgTable(
  "notification_deliveries",
  {
    id: serial("id").primaryKey(),
    notificationId: integer("notification_id")
      .notNull()
      .references(() => notificationsTable.id, { onDelete: "cascade" }),
    channel: text("channel").notNull(),
    status: text("status").notNull(),
    provider: text("provider"),
    providerMessageId: text("provider_message_id"),
    error: text("error"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("notification_deliveries_notification_idx").on(t.notificationId),
    index("notification_deliveries_channel_status_idx").on(
      t.channel,
      t.status,
    ),
  ],
);

export const insertNotificationSchema = createInsertSchema(
  notificationsTable,
).omit({ id: true, createdAt: true });
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notificationsTable.$inferSelect;

export const insertNotificationDeliverySchema = createInsertSchema(
  notificationDeliveriesTable,
).omit({ id: true, createdAt: true });
export type InsertNotificationDelivery = z.infer<
  typeof insertNotificationDeliverySchema
>;
export type NotificationDelivery =
  typeof notificationDeliveriesTable.$inferSelect;
