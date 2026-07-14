import {
  pgTable,
  text,
  serial,
  timestamp,
  integer,
  numeric,
  jsonb,
  pgEnum,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { profilesTable } from "./profiles";
import { projectsTable } from "./projects";
import { materialTypeEnum } from "./requests";
import { truckTypeEnum } from "./trucks";

export const recurrenceTypeEnum = pgEnum("recurrence_type", [
  "daily",
  "weekly",
  "monthly",
  "custom",
]);

export const recurringScheduleStatusEnum = pgEnum("recurring_schedule_status", [
  "active",
  "paused",
  "cancelled",
  "expired",
  "error",
]);

export const holidayBehaviorEnum = pgEnum("recurring_holiday_behavior", [
  "include",
  "skip",
  "next_business_day",
]);

/**
 * Customer-configured recurring haul template.
 * Generated request instances reference this schedule via requests.recurring_schedule_id.
 */
export const recurringSchedulesTable = pgTable("recurring_schedules", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull().references(() => profilesTable.id, { onDelete: "cascade" }),
  organizationId: integer("organization_id"),
  projectId: integer("project_id").references(() => projectsTable.id),
  name: text("name").notNull(),
  status: recurringScheduleStatusEnum("status").notNull().default("active"),
  recurrenceType: recurrenceTypeEnum("recurrence_type").notNull(),
  /** IANA timezone, e.g. America/Chicago */
  timezone: text("timezone").notNull().default("America/Chicago"),
  /** For weekly: 0=Sunday … 6=Saturday. For custom: ISO weekday list. */
  daysOfWeek: jsonb("days_of_week").$type<number[]>().notNull().default([]),
  /** Day of month for monthly (1–31). Null for non-monthly. */
  dayOfMonth: integer("day_of_month"),
  /** Custom interval in days when recurrenceType = custom. */
  intervalDays: integer("interval_days"),
  startDate: timestamp("start_date", { withTimezone: true }).notNull(),
  endDate: timestamp("end_date", { withTimezone: true }),
  skipDates: jsonb("skip_dates").$type<string[]>().notNull().default([]),
  holidayBehavior: holidayBehaviorEnum("holiday_behavior").notNull().default("skip"),
  // Template fields carried into generated requests
  materialType: materialTypeEnum("material_type").notNull(),
  truckType: truckTypeEnum("truck_type").notNull(),
  quantityTons: numeric("quantity_tons", { precision: 10, scale: 2 }).notNull(),
  pickupAddress: text("pickup_address").notNull(),
  deliveryAddress: text("delivery_address").notNull(),
  startTime: text("start_time").notNull().default("08:00"),
  estimatedHours: numeric("estimated_hours", { precision: 8, scale: 2 }).notNull().default("8"),
  trucksNeeded: integer("trucks_needed").notNull().default(1),
  budgetPerHour: numeric("budget_per_hour", { precision: 10, scale: 2 }),
  notes: text("notes"),
  /** How many days ahead to materialize instances. */
  generateHorizonDays: integer("generate_horizon_days").notNull().default(14),
  lastGeneratedForDate: text("last_generated_for_date"),
  lastRunAt: timestamp("last_run_at", { withTimezone: true }),
  lastError: text("last_error"),
  consecutiveFailures: integer("consecutive_failures").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const recurringGenerationStatusEnum = pgEnum("recurring_generation_status", [
  "created",
  "skipped",
  "review_required",
  "failed",
  "duplicate",
]);

export const recurringGenerationRunsTable = pgTable(
  "recurring_generation_runs",
  {
    id: serial("id").primaryKey(),
    scheduleId: integer("schedule_id")
      .notNull()
      .references(() => recurringSchedulesTable.id, { onDelete: "cascade" }),
    /** Calendar date in schedule timezone: YYYY-MM-DD — idempotency key with scheduleId */
    occurrenceDate: text("occurrence_date").notNull(),
    status: recurringGenerationStatusEnum("status").notNull(),
    requestId: integer("request_id"),
    errorMessage: text("error_message"),
    idempotencyKey: text("idempotency_key").notNull(),
    attempt: integer("attempt").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("recurring_generation_idempotency_idx").on(t.idempotencyKey)],
);

export const insertRecurringScheduleSchema = createInsertSchema(recurringSchedulesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastGeneratedForDate: true,
  lastRunAt: true,
  lastError: true,
  consecutiveFailures: true,
});
export type InsertRecurringSchedule = z.infer<typeof insertRecurringScheduleSchema>;
export type RecurringSchedule = typeof recurringSchedulesTable.$inferSelect;
export type RecurringGenerationRun = typeof recurringGenerationRunsTable.$inferSelect;
