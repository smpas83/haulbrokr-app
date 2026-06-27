import { pgTable, text, serial, timestamp, integer, uuid, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { profilesTable } from "./profiles";

export const activityTypeEnum = pgEnum("activity_type", [
  "request_posted",
  "bid_placed",
  "bid_awarded",
  "bid_accepted",
  "job_accepted",
  "job_declined",
  "job_started",
  "job_completed",
  "delivery_evidence_submitted",
  "driver_event_rejected",
  "payment_failed",
  "payment_requires_action",
  "application_approved",
  "application_rejected",
  "payout_delayed",
  "payout_stuck_alert",
  "bin_confirmed",
  "bin_delivered",
  "bin_picked_up",
  "bin_cancelled",
]);

export const activityTable = pgTable("activity", {
  id: serial("id").primaryKey(),
  profileId: integer("profile_id").notNull().references(() => profilesTable.id, { onDelete: "cascade" }),
  type: activityTypeEnum("type").notNull(),
  description: text("description").notNull(),
  relatedId: integer("related_id"),
  // Links a bin-order notification back to its order. The bin_orders PK is a
  // uuid, which can't live in the integer relatedId column, so bin-order
  // activity carries its reference here instead.
  relatedBinOrderId: uuid("related_bin_order_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertActivitySchema = createInsertSchema(activityTable).omit({ id: true, createdAt: true });
export type InsertActivity = z.infer<typeof insertActivitySchema>;
export type Activity = typeof activityTable.$inferSelect;
