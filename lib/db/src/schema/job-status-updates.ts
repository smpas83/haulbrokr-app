import { pgTable, text, serial, timestamp, integer, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { jobsTable } from "./jobs";
import { ticketsTable } from "./tickets";
import { profilesTable } from "./profiles";

export const jobStatusUpdateTypeEnum = pgEnum("job_status_update_type", [
  "job_created",
  "driver_assigned",
  "driver_replaced",
  "driver_accepted",
  "driver_arrived",
  "loading_started",
  "loading_finished",
  "departed_pickup",
  "arrived_facility",
  "scale_ticket_uploaded",
  "ai_verification_complete",
  "broker_approved",
  "invoice_created",
  "payment_initiated",
  "payment_completed",
  "partial_completed",
  "en_route", "arrived", "loading", "loaded", "dumping",
  "checked_in", "started", "ticket_uploaded", "photo_uploaded", "completed",
]);

export const jobStatusUpdatesTable = pgTable("job_status_updates", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id").notNull().references(() => jobsTable.id, { onDelete: "cascade" }),
  ticketId: integer("ticket_id").references(() => ticketsTable.id, { onDelete: "cascade" }),
  actorProfileId: integer("actor_profile_id").notNull().references(() => profilesTable.id),
  status: jobStatusUpdateTypeEnum("status").notNull(),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertJobStatusUpdateSchema = createInsertSchema(jobStatusUpdatesTable).omit({ id: true, createdAt: true });
export type InsertJobStatusUpdate = z.infer<typeof insertJobStatusUpdateSchema>;
export type JobStatusUpdate = typeof jobStatusUpdatesTable.$inferSelect;
