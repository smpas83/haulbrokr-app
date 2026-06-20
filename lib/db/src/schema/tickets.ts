import { pgTable, text, serial, timestamp, integer, numeric, pgEnum } from "drizzle-orm/pg-core";
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
]);

export const ticketsTable = pgTable("tickets", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id").notNull().references(() => jobsTable.id, { onDelete: "cascade" }),
  driverProfileId: integer("driver_profile_id").notNull().references(() => profilesTable.id),
  truckId: integer("truck_id").references(() => trucksTable.id),
  loadNumber: integer("load_number").notNull(),
  status: ticketStatusEnum("status").notNull().default("pending"),
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
});

export const insertTicketSchema = createInsertSchema(ticketsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTicket = z.infer<typeof insertTicketSchema>;
export type Ticket = typeof ticketsTable.$inferSelect;
