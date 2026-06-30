import { pgTable, text, serial, timestamp, integer, numeric, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { jobsTable } from "./jobs";
import { profilesTable } from "./profiles";
import { trucksTable } from "./trucks";

export const routeStatusEnum = pgEnum("route_status", [
  "pending",
  "calculated",
  "stale",
  "failed",
]);

export const jobRoutesTable = pgTable("job_routes", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id").notNull().unique().references(() => jobsTable.id, { onDelete: "cascade" }),
  pickupLat: numeric("pickup_lat", { precision: 10, scale: 7 }),
  pickupLng: numeric("pickup_lng", { precision: 10, scale: 7 }),
  pickupPlaceId: text("pickup_place_id"),
  dropoffLat: numeric("dropoff_lat", { precision: 10, scale: 7 }),
  dropoffLng: numeric("dropoff_lng", { precision: 10, scale: 7 }),
  dropoffPlaceId: text("dropoff_place_id"),
  routePolyline: text("route_polyline"),
  routeDistanceMeters: integer("route_distance_meters"),
  routeDurationSeconds: integer("route_duration_seconds"),
  trafficDurationSeconds: integer("traffic_duration_seconds"),
  etaAt: timestamp("eta_at", { withTimezone: true }),
  lastCalculatedAt: timestamp("last_calculated_at", { withTimezone: true }),
  routeStatus: routeStatusEnum("route_status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const truckLocationsTable = pgTable("truck_locations", {
  id: serial("id").primaryKey(),
  truckId: integer("truck_id").references(() => trucksTable.id, { onDelete: "cascade" }),
  driverProfileId: integer("driver_profile_id").notNull().references(() => profilesTable.id, { onDelete: "cascade" }),
  jobId: integer("job_id").references(() => jobsTable.id, { onDelete: "set null" }),
  lat: numeric("lat", { precision: 10, scale: 7 }).notNull(),
  lng: numeric("lng", { precision: 10, scale: 7 }).notNull(),
  heading: numeric("heading", { precision: 6, scale: 2 }),
  speedMps: numeric("speed_mps", { precision: 8, scale: 3 }),
  accuracyMeters: numeric("accuracy_meters", { precision: 8, scale: 2 }),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull(),
  isStale: integer("is_stale").notNull().default(0),
  offRouteStatus: text("off_route_status").notNull().default("unknown"),
  etaRecalculationRequestedAt: timestamp("eta_recalculation_requested_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const tripLocationHistoryTable = pgTable("trip_location_history", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id").references(() => jobsTable.id, { onDelete: "cascade" }),
  truckId: integer("truck_id").references(() => trucksTable.id, { onDelete: "set null" }),
  driverProfileId: integer("driver_profile_id").notNull().references(() => profilesTable.id, { onDelete: "cascade" }),
  lat: numeric("lat", { precision: 10, scale: 7 }).notNull(),
  lng: numeric("lng", { precision: 10, scale: 7 }).notNull(),
  heading: numeric("heading", { precision: 6, scale: 2 }),
  speedMps: numeric("speed_mps", { precision: 8, scale: 3 }),
  accuracyMeters: numeric("accuracy_meters", { precision: 8, scale: 2 }),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull(),
  offRouteStatus: text("off_route_status").notNull().default("unknown"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const trackingAuditLogsTable = pgTable("tracking_audit_logs", {
  id: serial("id").primaryKey(),
  actorProfileId: integer("actor_profile_id").references(() => profilesTable.id, { onDelete: "set null" }),
  jobId: integer("job_id").references(() => jobsTable.id, { onDelete: "set null" }),
  truckId: integer("truck_id").references(() => trucksTable.id, { onDelete: "set null" }),
  eventType: text("event_type").notNull(),
  message: text("message"),
  metadataJson: text("metadata_json"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertJobRouteSchema = createInsertSchema(jobRoutesTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertTruckLocationSchema = createInsertSchema(truckLocationsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertTripLocationHistorySchema = createInsertSchema(tripLocationHistoryTable).omit({ id: true, createdAt: true });
export const insertTrackingAuditLogSchema = createInsertSchema(trackingAuditLogsTable).omit({ id: true, createdAt: true });

export type JobRoute = typeof jobRoutesTable.$inferSelect;
export type InsertJobRoute = z.infer<typeof insertJobRouteSchema>;
export type TruckLocation = typeof truckLocationsTable.$inferSelect;
export type InsertTruckLocation = z.infer<typeof insertTruckLocationSchema>;
export type TripLocationHistory = typeof tripLocationHistoryTable.$inferSelect;
export type InsertTripLocationHistory = z.infer<typeof insertTripLocationHistorySchema>;
export type TrackingAuditLog = typeof trackingAuditLogsTable.$inferSelect;
export type InsertTrackingAuditLog = z.infer<typeof insertTrackingAuditLogSchema>;
