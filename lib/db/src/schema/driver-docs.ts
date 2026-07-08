import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { profilesTable } from "./profiles";

export const DRIVER_DOC_TYPES = [
  "dl_front",
  "dl_back",
  "cdl_front",
  "cdl_back",
  "dot_medical_card",
  "drug_test",
  "mvr",
  "ssn_card",
  "cos",
  "w9",
  "coi",
  "dot_authority",
  "background_check",
  "twic",
  // Carrier onboarding documents
  "business_license",
  "mc_authority",
  "vehicle_registration",
  "equipment_list",
  "signed_carrier_agreement",
  "voided_check",
  "ach_authorization",
  "safety_rating",
  "bond",
  // Customer optional documents
  "po_template",
  "tax_exempt_certificate",
] as const;
export type DriverDocType = (typeof DRIVER_DOC_TYPES)[number];

export const DRIVER_DOC_STATUSES = [
  "missing",
  "uploaded",
  "verified",
  "rejected",
] as const;
export type DriverDocStatus = (typeof DRIVER_DOC_STATUSES)[number];

export const driverDocumentsTable = pgTable("driver_documents", {
  id: serial("id").primaryKey(),
  profileId: integer("profile_id")
    .notNull()
    .references(() => profilesTable.id),
  docType: text("doc_type").notNull(),
  status: text("status").notNull().default("missing"),
  objectPath: text("object_path"),
  fileName: text("file_name"),
  mimeType: text("mime_type"),
  docNumber: text("doc_number"),
  expiry: timestamp("expiry", { withTimezone: true }),
  notes: text("notes"),
  reviewNote: text("review_note"),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true }),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  rejectedAt: timestamp("rejected_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertDriverDocumentSchema = createInsertSchema(
  driverDocumentsTable,
).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertDriverDocument = z.infer<typeof insertDriverDocumentSchema>;
export type DriverDocument = typeof driverDocumentsTable.$inferSelect;
