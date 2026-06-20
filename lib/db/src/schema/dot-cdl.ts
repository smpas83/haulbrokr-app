import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { profilesTable } from "./profiles";

export const dotCdlTable = pgTable("dot_cdl_compliance", {
  id: serial("id").primaryKey(),
  profileId: integer("profile_id").notNull().unique().references(() => profilesTable.id),
  dotNumber: text("dot_number"),
  mcNumber: text("mc_number"),
  dotVerified: boolean("dot_verified").notNull().default(false),
  dotVerifiedAt: timestamp("dot_verified_at", { withTimezone: true }),
  cdlNumber: text("cdl_number"),
  cdlState: text("cdl_state"),
  cdlClass: text("cdl_class"),
  cdlExpiry: timestamp("cdl_expiry", { withTimezone: true }),
  cdlVerified: boolean("cdl_verified").notNull().default(false),
  cdlVerifiedAt: timestamp("cdl_verified_at", { withTimezone: true }),
  // Automated compliance checks (manual verify now, FMCSA API later): unknown | verified | failed
  fmcsaAuthority: text("fmcsa_authority").notNull().default("unknown"),
  insuranceActive: text("insurance_active").notNull().default("unknown"),
  dotOperatingStatus: text("dot_operating_status").notNull().default("unknown"),
  safetyRating: text("safety_rating"),
  notSuspended: text("not_suspended").notNull().default("unknown"),
  complianceCheckedAt: timestamp("compliance_checked_at", { withTimezone: true }),
  status: text("status").notNull().default("not_submitted"),
  reviewNote: text("review_note"),
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertDotCdlSchema = createInsertSchema(dotCdlTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertDotCdl = z.infer<typeof insertDotCdlSchema>;
export type DotCdl = typeof dotCdlTable.$inferSelect;
