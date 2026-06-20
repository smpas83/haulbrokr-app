import { pgTable, text, serial, timestamp, integer, numeric, boolean, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { profilesTable } from "./profiles";

export const truckTypeEnum = pgEnum("truck_type", [
  "standard", "articulated", "side_dump", "bottom_dump", "transfer",
  "dump_truck", "super_10", "end_dump", "belly_dump", "lowboy",
  "water_truck", "excavator", "dozer", "skid_steer",
]);

export const coiStatusEnum = pgEnum("coi_status", ["none", "pending", "active", "expired"]);

export const trucksTable = pgTable("trucks", {
  id: serial("id").primaryKey(),
  ownerId: integer("owner_id").notNull().references(() => profilesTable.id, { onDelete: "cascade" }),
  truckNumber: text("truck_number"),
  vin: text("vin"),
  coiStatus: coiStatusEnum("coi_status").notNull().default("none"),
  assignedDriverId: integer("assigned_driver_id").references(() => profilesTable.id, { onDelete: "set null" }),
  truckType: truckTypeEnum("truck_type").notNull(),
  capacityTons: numeric("capacity_tons", { precision: 8, scale: 2 }).notNull(),
  ratePerHour: numeric("rate_per_hour", { precision: 10, scale: 2 }).notNull(),
  licensePlate: text("license_plate"),
  year: integer("year"),
  make: text("make"),
  model: text("model"),
  isAvailable: boolean("is_available").notNull().default(true),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertTruckSchema = createInsertSchema(trucksTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTruck = z.infer<typeof insertTruckSchema>;
export type Truck = typeof trucksTable.$inferSelect;
