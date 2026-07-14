import { pgTable, text, serial, timestamp, integer, numeric, pgEnum, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { profilesTable } from "./profiles";
import { projectsTable } from "./projects";
import { truckTypeEnum } from "./trucks";

export const materialTypeEnum = pgEnum("material_type", ["dirt", "gravel", "sand", "concrete", "asphalt", "demolition", "topsoil", "fill", "other"]);
export const requestStatusEnum = pgEnum("request_status", [
  "open",
  "bid_received",
  "bidding",
  "awarded",
  "accepted",
  "in_progress",
  "completed",
  "cancelled",
]);

export const requestsTable = pgTable("requests", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull().references(() => profilesTable.id, { onDelete: "cascade" }),
  materialType: materialTypeEnum("material_type").notNull(),
  truckType: truckTypeEnum("truck_type").notNull(),
  quantityTons: numeric("quantity_tons", { precision: 10, scale: 2 }).notNull(),
  pickupAddress: text("pickup_address").notNull(),
  deliveryAddress: text("delivery_address").notNull(),
  scheduledDate: timestamp("scheduled_date", { withTimezone: true }).notNull(),
  startTime: text("start_time").notNull(),
  estimatedHours: numeric("estimated_hours", { precision: 8, scale: 2 }).notNull(),
  status: requestStatusEnum("status").notNull().default("open"),
  trucksNeeded: integer("trucks_needed").notNull().default(1),
  budgetPerHour: numeric("budget_per_hour", { precision: 10, scale: 2 }),
  projectId: integer("project_id").references(() => projectsTable.id),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  index("requests_customer_id_idx").on(table.customerId),
  index("requests_status_idx").on(table.status),
  index("requests_created_at_idx").on(table.createdAt),
]);

export const insertRequestSchema = createInsertSchema(requestsTable).omit({ id: true, createdAt: true, updatedAt: true, status: true });
export type InsertRequest = z.infer<typeof insertRequestSchema>;
export type Request = typeof requestsTable.$inferSelect;
