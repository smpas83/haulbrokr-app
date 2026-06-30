import { pgTable, text, serial, timestamp, integer, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { jobsTable } from "./jobs";
import { profilesTable } from "./profiles";
import { trucksTable } from "./trucks";

export const driverLocationsTable = pgTable("driver_locations", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id").references(() => jobsTable.id),
  driverProfileId: integer("driver_profile_id").notNull().references(() => profilesTable.id),
  truckId: integer("truck_id").references(() => trucksTable.id),
  latitude: numeric("latitude", { precision: 10, scale: 7 }).notNull(),
  longitude: numeric("longitude", { precision: 10, scale: 7 }).notNull(),
  speedMph: numeric("speed_mph", { precision: 8, scale: 2 }),
  headingDegrees: numeric("heading_degrees", { precision: 8, scale: 2 }),
  accuracyMeters: numeric("accuracy_meters", { precision: 8, scale: 2 }),
  status: text("status"),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const routeSnapshotsTable = pgTable("route_snapshots", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id").references(() => jobsTable.id),
  requestedByProfileId: integer("requested_by_profile_id").references(() => profilesTable.id),
  originLabel: text("origin_label").notNull(),
  destinationLabel: text("destination_label").notNull(),
  distanceMeters: integer("distance_meters").notNull(),
  durationSeconds: integer("duration_seconds").notNull(),
  trafficDurationSeconds: integer("traffic_duration_seconds"),
  eta: timestamp("eta", { withTimezone: true }),
  encodedPolyline: text("encoded_polyline"),
  providerPayloadJson: text("provider_payload_json"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertDriverLocationSchema = createInsertSchema(driverLocationsTable).omit({ id: true, createdAt: true });
export const insertRouteSnapshotSchema = createInsertSchema(routeSnapshotsTable).omit({ id: true, createdAt: true });
export type DriverLocation = typeof driverLocationsTable.$inferSelect;
export type RouteSnapshot = typeof routeSnapshotsTable.$inferSelect;
export type InsertDriverLocation = z.infer<typeof insertDriverLocationSchema>;
export type InsertRouteSnapshot = z.infer<typeof insertRouteSnapshotSchema>;
