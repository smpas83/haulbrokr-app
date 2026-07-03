import {
  pgTable,
  text,
  serial,
  timestamp,
  integer,
  boolean,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { profilesTable } from "./profiles";
import { trucksTable } from "./trucks";

// Unified compliance-document system spanning vendors (carriers), drivers, and
// fleet (trucks). This is an ADDITIVE layer on top of the per-type submission
// tables (w9/insurance/dot_cdl/driver_documents); it adds version history,
// expiration tracking, and a shared approval workflow + audit log so every
// document type follows the same lifecycle.

export const COMPLIANCE_OWNER_TYPES = ["vendor", "driver", "fleet"] as const;
export type ComplianceOwnerType = (typeof COMPLIANCE_OWNER_TYPES)[number];

// Lifecycle statuses. `expired` is derived from `expiresAt` at read time (see
// lib/complianceDocuments.ts) but is also persisted by the expiration sweep so
// dashboards and blocking rules stay consistent without recomputation.
export const COMPLIANCE_STATUSES = [
  "pending",
  "approved",
  "rejected",
  "expired",
  "needs_update",
] as const;
export type ComplianceStatus = (typeof COMPLIANCE_STATUSES)[number];

export const COMPLIANCE_ACTIONS = [
  "uploaded",
  "replaced",
  "approved",
  "rejected",
  "expired",
  "needs_update",
  "note",
] as const;
export type ComplianceAction = (typeof COMPLIANCE_ACTIONS)[number];

// Document taxonomy per owner type. Names are namespaced (COMPLIANCE_*) to avoid
// colliding with the existing DRIVER_DOC_TYPES export in driver-docs.ts.
export const COMPLIANCE_VENDOR_DOC_TYPES = [
  "w9",
  "coi",
  "business_registration",
  "dot_authority",
  "mc_number",
  "usdot_number",
  "insurance",
  "additional",
] as const;
export type ComplianceVendorDocType =
  (typeof COMPLIANCE_VENDOR_DOC_TYPES)[number];

export const COMPLIANCE_DRIVER_DOC_TYPES = [
  "cdl",
  "medical_certificate",
  "driver_license",
  "insurance",
  "dot_document",
  "endorsement",
  "additional",
] as const;
export type ComplianceDriverDocType =
  (typeof COMPLIANCE_DRIVER_DOC_TYPES)[number];

export const COMPLIANCE_FLEET_DOC_TYPES = [
  "truck_registration",
  "vin",
  "plate",
  "insurance",
  "inspection",
  "equipment_document",
  "additional",
] as const;
export type ComplianceFleetDocType =
  (typeof COMPLIANCE_FLEET_DOC_TYPES)[number];

export const complianceDocumentsTable = pgTable(
  "compliance_documents",
  {
    id: serial("id").primaryKey(),
    ownerType: text("owner_type").notNull(),
    // Subject of the document. For vendor/driver docs this is the owning
    // profile; for fleet docs both truckId and the truck owner's profileId are
    // set so we can query a vendor's whole fleet.
    profileId: integer("profile_id").references(() => profilesTable.id, {
      onDelete: "cascade",
    }),
    truckId: integer("truck_id").references(() => trucksTable.id, {
      onDelete: "cascade",
    }),
    docType: text("doc_type").notNull(),
    status: text("status").notNull().default("pending"),
    // Version history: each replacement bumps `version` and marks the prior row
    // `isCurrent = false`. Only the current row participates in blocking rules.
    version: integer("version").notNull().default(1),
    isCurrent: boolean("is_current").notNull().default(true),
    objectPath: text("object_path"),
    fileName: text("file_name"),
    mimeType: text("mime_type"),
    docNumber: text("doc_number"),
    issuedAt: timestamp("issued_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    uploadedByProfileId: integer("uploaded_by_profile_id").references(
      () => profilesTable.id,
    ),
    reviewedByProfileId: integer("reviewed_by_profile_id").references(
      () => profilesTable.id,
    ),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewNote: text("review_note"),
    rejectionReason: text("rejection_reason"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("compliance_docs_profile_idx").on(t.profileId),
    index("compliance_docs_truck_idx").on(t.truckId),
    index("compliance_docs_owner_type_idx").on(t.ownerType),
    index("compliance_docs_status_idx").on(t.status),
    index("compliance_docs_expires_idx").on(t.expiresAt),
    index("compliance_docs_current_idx").on(
      t.profileId,
      t.docType,
      t.isCurrent,
    ),
  ],
);

export const complianceDocumentHistoryTable = pgTable(
  "compliance_document_history",
  {
    id: serial("id").primaryKey(),
    documentId: integer("document_id")
      .notNull()
      .references(() => complianceDocumentsTable.id, { onDelete: "cascade" }),
    action: text("action").notNull(),
    fromStatus: text("from_status"),
    toStatus: text("to_status"),
    actorProfileId: integer("actor_profile_id").references(
      () => profilesTable.id,
    ),
    version: integer("version"),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("compliance_doc_history_doc_idx").on(t.documentId)],
);

export const insertComplianceDocumentSchema = createInsertSchema(
  complianceDocumentsTable,
).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertComplianceDocument = z.infer<
  typeof insertComplianceDocumentSchema
>;
export type ComplianceDocument = typeof complianceDocumentsTable.$inferSelect;

export const insertComplianceDocumentHistorySchema = createInsertSchema(
  complianceDocumentHistoryTable,
).omit({ id: true, createdAt: true });
export type InsertComplianceDocumentHistory = z.infer<
  typeof insertComplianceDocumentHistorySchema
>;
export type ComplianceDocumentHistory =
  typeof complianceDocumentHistoryTable.$inferSelect;
