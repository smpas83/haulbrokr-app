import {
  pgTable,
  text,
  serial,
  timestamp,
  integer,
  pgEnum,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { profilesTable } from "./profiles";

export const businessTypeEnum = pgEnum("business_type", [
  "sole_proprietor",
  "single_member_llc",
  "multi_member_llc",
  "partnership",
  "c_corporation",
  "s_corporation",
  "other",
]);

export const verificationStatusEnum = pgEnum("verification_status", [
  "not_submitted",
  "pending",
  "verified",
  "rejected",
]);

export const w9SubmissionsTable = pgTable("w9_submissions", {
  id: serial("id").primaryKey(),
  profileId: integer("profile_id")
    .notNull()
    .unique()
    .references(() => profilesTable.id, { onDelete: "cascade" }),
  legalName: text("legal_name").notNull(),
  businessName: text("business_name"),
  businessType: businessTypeEnum("business_type").notNull(),
  taxIdType: text("tax_id_type").notNull(),
  taxIdLast4: text("tax_id_last4").notNull(),
  address: text("address").notNull(),
  city: text("city").notNull(),
  state: text("state").notNull(),
  zip: text("zip").notNull(),
  signatureFullName: text("signature_full_name").notNull(),
  agreedToTerms: text("agreed_to_terms").notNull().default("false"),
  status: verificationStatusEnum("status").notNull().default("pending"),
  reviewNote: text("review_note"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertW9Schema = createInsertSchema(w9SubmissionsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  status: true,
});
export type InsertW9 = z.infer<typeof insertW9Schema>;
export type W9Submission = typeof w9SubmissionsTable.$inferSelect;
