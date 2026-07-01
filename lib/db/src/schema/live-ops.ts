import { boolean, integer, numeric, pgEnum, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { jobsTable } from "./jobs";
import { profilesTable } from "./profiles";
import { ticketsTable } from "./tickets";
import { trucksTable } from "./trucks";

export const geofenceKindEnum = pgEnum("geofence_kind", ["pickup", "delivery"]);

export const vehicleLocationsTable = pgTable("vehicle_locations", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id").notNull().references(() => jobsTable.id, { onDelete: "cascade" }),
  ticketId: integer("ticket_id").notNull().references(() => ticketsTable.id, { onDelete: "cascade" }),
  driverProfileId: integer("driver_profile_id").notNull().references(() => profilesTable.id, { onDelete: "cascade" }),
  truckId: integer("truck_id").references(() => trucksTable.id, { onDelete: "set null" }),
  latitude: numeric("latitude", { precision: 10, scale: 7 }).notNull(),
  longitude: numeric("longitude", { precision: 10, scale: 7 }).notNull(),
  heading: numeric("heading", { precision: 6, scale: 2 }),
  speedMph: numeric("speed_mph", { precision: 6, scale: 2 }),
  accuracyMeters: numeric("accuracy_meters", { precision: 8, scale: 2 }),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const jobGeofencesTable = pgTable("job_geofences", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id").notNull().references(() => jobsTable.id, { onDelete: "cascade" }),
  kind: geofenceKindEnum("kind").notNull(),
  latitude: numeric("latitude", { precision: 10, scale: 7 }).notNull(),
  longitude: numeric("longitude", { precision: 10, scale: 7 }).notNull(),
  radiusMeters: integer("radius_meters").notNull().default(200),
  label: text("label"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const driverAvailabilityTable = pgTable("driver_availability", {
  id: serial("id").primaryKey(),
  driverProfileId: integer("driver_profile_id").notNull().references(() => profilesTable.id, { onDelete: "cascade" }),
  isOnline: boolean("is_online").notNull().default(false),
  currentTicketId: integer("current_ticket_id").references(() => ticketsTable.id, { onDelete: "set null" }),
  lastLatitude: numeric("last_latitude", { precision: 10, scale: 7 }),
  lastLongitude: numeric("last_longitude", { precision: 10, scale: 7 }),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertVehicleLocationSchema = createInsertSchema(vehicleLocationsTable).omit({ id: true, createdAt: true });
export type InsertVehicleLocation = z.infer<typeof insertVehicleLocationSchema>;
export type VehicleLocation = typeof vehicleLocationsTable.$inferSelect;

export const insertJobGeofenceSchema = createInsertSchema(jobGeofencesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertJobGeofence = z.infer<typeof insertJobGeofenceSchema>;
export type JobGeofence = typeof jobGeofencesTable.$inferSelect;

export const insertDriverAvailabilitySchema = createInsertSchema(driverAvailabilityTable).omit({ id: true, updatedAt: true });
export type InsertDriverAvailability = z.infer<typeof insertDriverAvailabilitySchema>;
export type DriverAvailability = typeof driverAvailabilityTable.$inferSelect;
