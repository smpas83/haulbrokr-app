import { pgTable, text, serial, timestamp, integer, numeric, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { profilesTable } from "./profiles";
import { projectsTable } from "./projects";
import { requestsTable } from "./requests";
import { truckTypeEnum } from "./trucks";
import { materialTypeEnum } from "./requests";

export const recurringFrequencyEnum = pgEnum("recurring_frequency", [
  "daily",
  "weekly",
  "biweekly",
  "monthly",
]);

export const recurringHaulStatusEnum = pgEnum("recurring_haul_status", [
  "active",
  "paused",
  "completed",
  "cancelled",
]);

/**
 * Recurring haul series — template + schedule that auto-creates marketplace requests.
 */
export const recurringHaulsTable = pgTable("recurring_hauls", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull().references(() => profilesTable.id, { onDelete: "cascade" }),
  organizationId: integer("organization_id"),
  projectId: integer("project_id").references(() => projectsTable.id),
  // Template fields (mirrored onto each generated request)
  materialType: materialTypeEnum("material_type").notNull(),
  truckType: truckTypeEnum("truck_type").notNull(),
  quantityTons: numeric("quantity_tons", { precision: 10, scale: 2 }).notNull(),
  pickupAddress: text("pickup_address").notNull(),
  deliveryAddress: text("delivery_address").notNull(),
  startTime: text("start_time").notNull().default("08:00"),
  estimatedHours: numeric("estimated_hours", { precision: 8, scale: 2 }).notNull(),
  trucksNeeded: integer("trucks_needed").notNull().default(1),
  budgetPerHour: numeric("budget_per_hour", { precision: 10, scale: 2 }),
  notes: text("notes"),
  // Schedule
  frequency: recurringFrequencyEnum("frequency").notNull(),
  // Comma-separated ISO weekdays 1-7 (Mon-Sun) for weekly/biweekly; null = same weekday as startDate
  daysOfWeek: text("days_of_week"),
  // Day of month 1-28 for monthly; null = day-of-month from startDate
  dayOfMonth: integer("day_of_month"),
  startDate: timestamp("start_date", { withTimezone: true }).notNull(),
  endDate: timestamp("end_date", { withTimezone: true }),
  nextRunAt: timestamp("next_run_at", { withTimezone: true }).notNull(),
  // Remind this many hours before each occurrence (null = no reminder)
  reminderHoursBefore: integer("reminder_hours_before").default(24),
  status: recurringHaulStatusEnum("status").notNull().default("active"),
  occurrenceCount: integer("occurrence_count").notNull().default(0),
  maxOccurrences: integer("max_occurrences"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const recurringHaulOccurrencesTable = pgTable("recurring_haul_occurrences", {
  id: serial("id").primaryKey(),
  recurringHaulId: integer("recurring_haul_id")
    .notNull()
    .references(() => recurringHaulsTable.id, { onDelete: "cascade" }),
  requestId: integer("request_id").references(() => requestsTable.id),
  scheduledDate: timestamp("scheduled_date", { withTimezone: true }).notNull(),
  reminderSentAt: timestamp("reminder_sent_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertRecurringHaulSchema = createInsertSchema(recurringHaulsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  occurrenceCount: true,
  status: true,
});
export type InsertRecurringHaul = z.infer<typeof insertRecurringHaulSchema>;
export type RecurringHaul = typeof recurringHaulsTable.$inferSelect;
export type RecurringHaulOccurrence = typeof recurringHaulOccurrencesTable.$inferSelect;
