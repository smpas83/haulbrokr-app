import {
  pgTable,
  serial,
  timestamp,
  integer,
  boolean,
  text,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { profilesTable } from "./profiles";

/**
 * Per-profile notification channel + topic preferences.
 * Defaults are applied in application code when no row exists.
 */
export const notificationPreferencesTable = pgTable(
  "notification_preferences",
  {
    id: serial("id").primaryKey(),
    profileId: integer("profile_id")
      .notNull()
      .unique()
      .references(() => profilesTable.id, { onDelete: "cascade" }),
    // Channels
    pushEnabled: boolean("push_enabled").notNull().default(true),
    emailEnabled: boolean("email_enabled").notNull().default(true),
    smsEnabled: boolean("sms_enabled").notNull().default(false),
    // Topics
    jobUpdates: boolean("job_updates").notNull().default(true),
    paymentUpdates: boolean("payment_updates").notNull().default(true),
    bidUpdates: boolean("bid_updates").notNull().default(true),
    complianceUpdates: boolean("compliance_updates").notNull().default(true),
    reminders: boolean("reminders").notNull().default(true),
    marketing: boolean("marketing").notNull().default(false),
    // Optional override phone for SMS (falls back to profile.phone)
    smsPhone: text("sms_phone"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
);

export const insertNotificationPreferencesSchema = createInsertSchema(
  notificationPreferencesTable,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertNotificationPreferences = z.infer<
  typeof insertNotificationPreferencesSchema
>;
export type NotificationPreferences =
  typeof notificationPreferencesTable.$inferSelect;
