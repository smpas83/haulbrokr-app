import { pgTable, text, serial, timestamp, integer, pgEnum, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { profilesTable } from "./profiles";

export const notificationChannelEnum = pgEnum("notification_channel", ["email", "sms", "push", "realtime"]);
export const notificationStatusEnum = pgEnum("notification_status", ["pending", "sent", "failed", "skipped"]);

export const notificationEventsTable = pgTable(
  "notification_events",
  {
    id: serial("id").primaryKey(),
    profileId: integer("profile_id").references(() => profilesTable.id, { onDelete: "cascade" }),
    channel: notificationChannelEnum("channel").notNull(),
    eventType: text("event_type").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    status: notificationStatusEnum("status").notNull().default("pending"),
    destination: text("destination"),
    providerMessageId: text("provider_message_id"),
    error: text("error"),
    metadataJson: text("metadata_json"),
    queuedAt: timestamp("queued_at", { withTimezone: true }).notNull().defaultNow(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => ({
    profileIdx: index("notification_events_profile_idx").on(table.profileId),
    statusIdx: index("notification_events_status_idx").on(table.status),
    channelIdx: index("notification_events_channel_idx").on(table.channel),
  }),
);

export const insertNotificationEventSchema = createInsertSchema(notificationEventsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type NotificationEvent = typeof notificationEventsTable.$inferSelect;
export type InsertNotificationEvent = z.infer<typeof insertNotificationEventSchema>;
