import {
  pgTable,
  text,
  serial,
  timestamp,
  integer,
  numeric,
  pgEnum,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { profilesTable } from "./profiles";

export const projectStatusEnum = pgEnum("project_status", [
  "active",
  "on_hold",
  "completed",
  "cancelled",
]);

export const projectsTable = pgTable("projects", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id")
    .notNull()
    .references(() => profilesTable.id),
  name: text("name").notNull(),
  description: text("description"),
  siteAddress: text("site_address"),
  totalBudget: numeric("total_budget", { precision: 12, scale: 2 }),
  spentAmount: numeric("spent_amount", { precision: 12, scale: 2 })
    .notNull()
    .default("0"),
  status: projectStatusEnum("status").notNull().default("active"),
  startDate: timestamp("start_date", { withTimezone: true }),
  endDate: timestamp("end_date", { withTimezone: true }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertProjectSchema = createInsertSchema(projectsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projectsTable.$inferSelect;
