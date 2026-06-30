import { pgTable, text, serial, timestamp, integer, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { jobsTable } from "./jobs";
import { ticketsTable } from "./tickets";
import { profilesTable } from "./profiles";

export const jobStatusUpdateTypeEnum = pgEnum("job_status_update_type", [
  "en_route", "arrived", "loading", "loaded", "dumping",
  "checked_in", "started", "ticket_uploaded", "photo_uploaded", "completed",
  "driver_accepted", "driver_declined", "en_route_pickup", "left_pickup",
  "en_route_delivery", "arrived_delivery", "loading_photos_uploaded",
  "scale_ticket_uploaded", "delivery_photos_uploaded", "signed_ticket_uploaded",
  "checked_out",
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
