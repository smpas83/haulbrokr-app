import { pgTable, text, serial, timestamp, boolean, pgEnum, numeric, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const dumpSiteTypeEnum = pgEnum("dump_site_type", [
  "landfill",
  "transfer_station",
  "recycling_center",
  "construction_debris",
  "hazardous_waste",
  "compost",
]);

export const dumpSitesTable = pgTable("dump_sites", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  address: text("address").notNull(),
  city: text("city").notNull(),
  state: text("state").notNull(),
  zip: text("zip").notNull(),
  type: dumpSiteTypeEnum("type").notNull().default("landfill"),
  phone: text("phone"),
  latitude: numeric("latitude", { precision: 10, scale: 7 }),
  longitude: numeric("longitude", { precision: 10, scale: 7 }),
  hours: jsonb("hours").$type<Record<string, unknown>>().notNull().default({}),
  acceptedMaterials: jsonb("accepted_materials").$type<string[]>().notNull().default([]),
  photos: jsonb("photos").$type<string[]>().notNull().default([]),
  weightLimits: text("weight_limits"),
  truckRestrictions: text("truck_restrictions"),
  tippingFees: jsonb("tipping_fees").$type<Record<string, unknown>>().notNull().default({}),
  materialPurchasePrices: jsonb("material_purchase_prices").$type<Record<string, unknown>>().notNull().default({}),
  notes: text("notes"),
  liveWaitTimeMinutes: numeric("live_wait_time_minutes", { precision: 8, scale: 2 }),
  queueEstimateTrucks: numeric("queue_estimate_trucks", { precision: 8, scale: 2 }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertDumpSiteSchema = createInsertSchema(dumpSitesTable).omit({ id: true, createdAt: true });
export type InsertDumpSite = z.infer<typeof insertDumpSiteSchema>;
export type DumpSite = typeof dumpSitesTable.$inferSelect;
