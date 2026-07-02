import { pgTable, text, serial, timestamp, boolean, pgEnum, numeric, integer, jsonb, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { profilesTable } from "./profiles";

export const dumpSiteTypeEnum = pgEnum("dump_site_type", [
  "landfill",
  "transfer_station",
  "recycling_center",
  "construction_debris",
  "hazardous_waste",
  "compost",
  "asphalt_plant",
  "gravel_pit",
  "concrete_crusher",
  "quarry",
  "supplier",
]);

export const facilityStatusEnum = pgEnum("facility_status", ["open", "closed", "temporarily_closed"]);

export const facilityTrafficStatusEnum = pgEnum("facility_traffic_status", [
  "open",
  "closed",
  "busy",
  "moderate",
  "light_traffic",
  "temporary_closure",
  "holiday_hours",
  "maintenance",
]);

export const facilityMaterialTypeEnum = pgEnum("facility_material_type", [
  "rock",
  "sand",
  "gravel",
  "asphalt",
  "concrete",
  "dirt",
  "clay",
  "base",
  "recycled_asphalt",
  "recycled_concrete",
  "construction_debris",
  "green_waste",
  "mixed_waste",
  "clean_fill",
  "contaminated_soil",
]);

export const facilityMaterialDispositionEnum = pgEnum("facility_material_disposition", ["accepted", "rejected"]);

export const facilityPriceTypeEnum = pgEnum("facility_price_type", [
  "tipping_fee",
  "material_purchase_price",
  "minimum_fee",
  "per_ton",
  "per_load",
  "flat_rate",
  "cash_price",
  "account_price",
  "customer_contract_price",
  "fuel_surcharge",
  "environmental_fee",
]);

export const dumpSitesTable = pgTable("dump_sites", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  address: text("address").notNull(),
  city: text("city").notNull(),
  state: text("state").notNull(),
  zip: text("zip").notNull(),
  type: dumpSiteTypeEnum("type").notNull().default("landfill"),
  latitude: numeric("latitude", { precision: 10, scale: 7 }),
  longitude: numeric("longitude", { precision: 10, scale: 7 }),
  phone: text("phone"),
  website: text("website"),
  operatingHours: jsonb("operating_hours").$type<Record<string, string>>().notNull().default({}),
  holidayHours: jsonb("holiday_hours").$type<Record<string, string>>().notNull().default({}),
  afterHoursContact: text("after_hours_contact"),
  acceptedMaterials: jsonb("accepted_materials").$type<string[]>().notNull().default([]),
  rejectedMaterials: jsonb("rejected_materials").$type<string[]>().notNull().default([]),
  maxTruckSize: text("max_truck_size"),
  maxWeightTons: numeric("max_weight_tons", { precision: 10, scale: 2 }),
  scaleLocation: text("scale_location"),
  scaleHours: text("scale_hours"),
  entranceInstructions: text("entrance_instructions"),
  exitInstructions: text("exit_instructions"),
  safetyRules: jsonb("safety_rules").$type<string[]>().notNull().default([]),
  ppeRequirements: jsonb("ppe_requirements").$type<string[]>().notNull().default([]),
  truckRestrictions: jsonb("truck_restrictions").$type<string[]>().notNull().default([]),
  preferredRoutes: jsonb("preferred_routes").$type<string[]>().notNull().default([]),
  photos: jsonb("photos").$type<string[]>().notNull().default([]),
  facilityNotes: text("facility_notes"),
  emergencyContact: text("emergency_contact"),
  brokerNotes: text("broker_notes"),
  driverNotes: text("driver_notes"),
  status: facilityStatusEnum("status").notNull().default("open"),
  currentStatus: facilityTrafficStatusEnum("current_status").notNull().default("moderate"),
  estimatedWaitMinutes: integer("estimated_wait_minutes"),
  temporaryClosureReason: text("temporary_closure_reason"),
  maintenanceNotes: text("maintenance_notes"),
  capacityLoadsPerDay: integer("capacity_loads_per_day"),
  statusUpdatedAt: timestamp("status_updated_at", { withTimezone: true }).notNull().defaultNow(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const facilityMaterialsTable = pgTable(
  "facility_materials",
  {
    id: serial("id").primaryKey(),
    dumpSiteId: integer("dump_site_id").notNull().references(() => dumpSitesTable.id, { onDelete: "cascade" }),
    materialType: facilityMaterialTypeEnum("material_type").notNull(),
    disposition: facilityMaterialDispositionEnum("disposition").notNull(),
    specialInstructions: text("special_instructions"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => ({
    facilityMaterialUnique: unique("facility_material_unique").on(table.dumpSiteId, table.materialType),
  }),
);

export const facilityPricingTable = pgTable("facility_pricing", {
  id: serial("id").primaryKey(),
  dumpSiteId: integer("dump_site_id").notNull().references(() => dumpSitesTable.id, { onDelete: "cascade" }),
  materialType: facilityMaterialTypeEnum("material_type"),
  priceType: facilityPriceTypeEnum("price_type").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("USD"),
  unit: text("unit"),
  notes: text("notes"),
  effectiveFrom: timestamp("effective_from", { withTimezone: true }).notNull().defaultNow(),
  effectiveTo: timestamp("effective_to", { withTimezone: true }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const customerFacilityPreferencesTable = pgTable("customer_facility_preferences", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull().references(() => profilesTable.id, { onDelete: "cascade" }).unique(),
  preferredFacilities: jsonb("preferred_facilities").$type<number[]>().notNull().default([]),
  preferredMaterials: jsonb("preferred_materials").$type<string[]>().notNull().default([]),
  preferredRoutes: jsonb("preferred_routes").$type<string[]>().notNull().default([]),
  backupFacilities: jsonb("backup_facilities").$type<number[]>().notNull().default([]),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const facilityAnalyticsTable = pgTable("facility_analytics", {
  id: serial("id").primaryKey(),
  dumpSiteId: integer("dump_site_id").notNull().references(() => dumpSitesTable.id, { onDelete: "cascade" }).unique(),
  loadsReceived: integer("loads_received").notNull().default(0),
  averageWaitTimeMinutes: numeric("average_wait_time_minutes", { precision: 8, scale: 2 }),
  averageUnloadTimeMinutes: numeric("average_unload_time_minutes", { precision: 8, scale: 2 }),
  averageTons: numeric("average_tons", { precision: 10, scale: 2 }),
  revenue: numeric("revenue", { precision: 12, scale: 2 }).notNull().default("0"),
  tippingFees: numeric("tipping_fees", { precision: 12, scale: 2 }).notNull().default("0"),
  driverRatingAverage: numeric("driver_rating_average", { precision: 4, scale: 2 }),
  customerRatingAverage: numeric("customer_rating_average", { precision: 4, scale: 2 }),
  completionRate: numeric("completion_rate", { precision: 5, scale: 2 }),
  rejectedLoads: integer("rejected_loads").notNull().default(0),
  peakHours: jsonb("peak_hours").$type<string[]>().notNull().default([]),
  utilization: numeric("utilization", { precision: 5, scale: 2 }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertDumpSiteSchema = createInsertSchema(dumpSitesTable).omit({ id: true, createdAt: true });
export type InsertDumpSite = z.infer<typeof insertDumpSiteSchema>;
export type DumpSite = typeof dumpSitesTable.$inferSelect;
export const insertFacilityMaterialSchema = createInsertSchema(facilityMaterialsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertFacilityMaterial = z.infer<typeof insertFacilityMaterialSchema>;
export type FacilityMaterial = typeof facilityMaterialsTable.$inferSelect;
export const insertFacilityPricingSchema = createInsertSchema(facilityPricingTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertFacilityPricing = z.infer<typeof insertFacilityPricingSchema>;
export type FacilityPricing = typeof facilityPricingTable.$inferSelect;
export const insertCustomerFacilityPreferencesSchema = createInsertSchema(customerFacilityPreferencesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCustomerFacilityPreferences = z.infer<typeof insertCustomerFacilityPreferencesSchema>;
export type CustomerFacilityPreferences = typeof customerFacilityPreferencesTable.$inferSelect;
export const insertFacilityAnalyticsSchema = createInsertSchema(facilityAnalyticsTable).omit({ id: true, updatedAt: true });
export type InsertFacilityAnalytics = z.infer<typeof insertFacilityAnalyticsSchema>;
export type FacilityAnalytics = typeof facilityAnalyticsTable.$inferSelect;
