import { index, pgTable, text, serial, timestamp, integer, numeric, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { jobsTable } from "./jobs";
import { profilesTable } from "./profiles";
import { trucksTable } from "./trucks";

export const ticketStatusEnum = pgEnum("ticket_status", [
  "pending",
  "in_progress",
  "completed",
  "verified",
  "declined",
  "cancelled",
]);

export const driverWorkflowStateEnum = pgEnum("driver_workflow_state", [
  "assigned",
  "accepted",
  "declined",
  "en_route_pickup",
  "checked_in",
  "loading",
  "loading_photos_uploaded",
  "scale_ticket_uploaded",
  "left_pickup",
  "en_route_delivery",
  "arrived_delivery",
  "delivery_photos_uploaded",
  "signed_ticket_uploaded",
  "checked_out",
  "completed",
]);

export const ticketsTable = pgTable("tickets", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id").notNull().references(() => jobsTable.id, { onDelete: "cascade" }),
  driverProfileId: integer("driver_profile_id").notNull().references(() => profilesTable.id),
  truckId: integer("truck_id").references(() => trucksTable.id),
  loadNumber: integer("load_number").notNull(),
  status: ticketStatusEnum("status").notNull().default("pending"),
  workflowState: driverWorkflowStateEnum("workflow_state").notNull().default("assigned"),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  declinedAt: timestamp("declined_at", { withTimezone: true }),
  enRoutePickupAt: timestamp("en_route_pickup_at", { withTimezone: true }),
  pickupCheckedInAt: timestamp("pickup_checked_in_at", { withTimezone: true }),
  loadingStartedAt: timestamp("loading_started_at", { withTimezone: true }),
  loadingPhotosUploadedAt: timestamp("loading_photos_uploaded_at", { withTimezone: true }),
  scaleTicketUploadedAt: timestamp("scale_ticket_uploaded_at", { withTimezone: true }),
  leftPickupAt: timestamp("left_pickup_at", { withTimezone: true }),
  enRouteDeliveryAt: timestamp("en_route_delivery_at", { withTimezone: true }),
  arrivedDeliveryAt: timestamp("arrived_delivery_at", { withTimezone: true }),
  deliveryPhotosUploadedAt: timestamp("delivery_photos_uploaded_at", { withTimezone: true }),
  signedTicketUploadedAt: timestamp("signed_ticket_uploaded_at", { withTimezone: true }),
  checkedOutAt: timestamp("checked_out_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  lastWorkflowTransitionAt: timestamp("last_workflow_transition_at", { withTimezone: true }),
  clockedInAt: timestamp("clocked_in_at", { withTimezone: true }),
  clockedOutAt: timestamp("clocked_out_at", { withTimezone: true }),
  weightTons: numeric("weight_tons", { precision: 8, scale: 2 }),
  notes: text("notes"),
  photoUrl: text("photo_url"),
  // QR verification
  qrIssuedAt: timestamp("qr_issued_at", { withTimezone: true }),
  qrExpiresAt: timestamp("qr_expires_at", { withTimezone: true }),
  qrNonce: text("qr_nonce"),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  verifiedByProfileId: integer("verified_by_profile_id").references(() => profilesTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  index("tickets_job_id_idx").on(table.jobId),
  index("tickets_driver_profile_id_idx").on(table.driverProfileId),
  index("tickets_truck_id_idx").on(table.truckId),
  index("tickets_status_idx").on(table.status),
  index("tickets_workflow_state_idx").on(table.workflowState),
]);

export const insertTicketSchema = createInsertSchema(ticketsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTicket = z.infer<typeof insertTicketSchema>;
export type Ticket = typeof ticketsTable.$inferSelect;
