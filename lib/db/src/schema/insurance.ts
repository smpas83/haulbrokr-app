import { pgTable, text, serial, timestamp, integer, numeric, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { profilesTable } from "./profiles";
import { verificationStatusEnum } from "./w9";

export const insuranceSubmissionsTable = pgTable("insurance_submissions", {
  id: serial("id").primaryKey(),
  profileId: integer("profile_id").notNull().unique().references(() => profilesTable.id, { onDelete: "cascade" }),
  glCarrier: text("gl_carrier").notNull(),
  glPolicyNumber: text("gl_policy_number").notNull(),
  glCoverageAmount: numeric("gl_coverage_amount", { precision: 14, scale: 2 }).notNull(),
  glExpirationDate: timestamp("gl_expiration_date", { withTimezone: true }).notNull(),
  autoCarrier: text("auto_carrier"),
  autoPolicyNumber: text("auto_policy_number"),
  autoCoverageAmount: numeric("auto_coverage_amount", { precision: 14, scale: 2 }),
  autoExpirationDate: timestamp("auto_expiration_date", { withTimezone: true }),
  wcCarrier: text("wc_carrier"),
  wcPolicyNumber: text("wc_policy_number"),
  wcExpirationDate: timestamp("wc_expiration_date", { withTimezone: true }),
  bondCompany: text("bond_company"),
  bondAmount: numeric("bond_amount", { precision: 14, scale: 2 }),
  bondExpirationDate: timestamp("bond_expiration_date", { withTimezone: true }),
  certificateHolderName: text("certificate_holder_name"),
  status: verificationStatusEnum("insurance_status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertInsuranceSchema = createInsertSchema(insuranceSubmissionsTable).omit({ id: true, createdAt: true, updatedAt: true, status: true });
export type InsertInsurance = z.infer<typeof insertInsuranceSchema>;
export type InsuranceSubmission = typeof insuranceSubmissionsTable.$inferSelect;
