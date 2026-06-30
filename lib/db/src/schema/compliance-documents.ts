import { pgTable, text, serial, timestamp, integer, pgEnum, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { profilesTable } from "./profiles";
import { trucksTable } from "./trucks";

export const complianceEntityTypeEnum = pgEnum("compliance_entity_type", ["profile", "truck"]);

export const complianceDocumentTypeEnum = pgEnum("compliance_document_type", [
  "w9",
  "coi",
  "dot_authority",
  "mc_number",
  "usdot_number",
  "business_registration",
  "driver_license",
  "cdl",
  "medical_certificate",
  "insurance",
  "dot_document",
  "endorsement",
  "vehicle_registration",
  "truck_insurance",
  "truck_registration",
  "inspection",
  "additional",
]);

export const complianceDocumentStatusEnum = pgEnum("compliance_document_status", [
  "pending",
  "approved",
  "rejected",
  "expired",
  "needs_update",
]);

export const complianceAuditActionEnum = pgEnum("compliance_audit_action", [
  "uploaded",
  "replaced",
  "approved",
  "rejected",
  "requested_update",
  "expired",
  "expiring",
]);

export const complianceDocumentsTable = pgTable(
  "compliance_documents",
  {
    id: serial("id").primaryKey(),
    entityType: complianceEntityTypeEnum("entity_type").notNull(),
    profileId: integer("profile_id").references(() => profilesTable.id, { onDelete: "cascade" }),
    truckId: integer("truck_id").references(() => trucksTable.id, { onDelete: "cascade" }),
    documentType: complianceDocumentTypeEnum("document_type").notNull(),
    status: complianceDocumentStatusEnum("status").notNull().default("pending"),
    objectPath: text("object_path"),
    fileName: text("file_name"),
    mimeType: text("mime_type"),
    documentNumber: text("document_number"),
    issuingAuthority: text("issuing_authority"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    rejectionReason: text("rejection_reason"),
    adminNotes: text("admin_notes"),
    uploadedByProfileId: integer("uploaded_by_profile_id").references(() => profilesTable.id, { onDelete: "set null" }),
    reviewedByProfileId: integer("reviewed_by_profile_id").references(() => profilesTable.id, { onDelete: "set null" }),
    uploadedAt: timestamp("uploaded_at", { withTimezone: true }).notNull().defaultNow(),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => ({
    profileIdx: index("compliance_documents_profile_idx").on(table.profileId),
    truckIdx: index("compliance_documents_truck_idx").on(table.truckId),
    statusIdx: index("compliance_documents_status_idx").on(table.status),
    expiryIdx: index("compliance_documents_expiry_idx").on(table.expiresAt),
  }),
);

export const complianceDocumentVersionsTable = pgTable(
  "compliance_document_versions",
  {
    id: serial("id").primaryKey(),
    documentId: integer("document_id").notNull().references(() => complianceDocumentsTable.id, { onDelete: "cascade" }),
    versionNumber: integer("version_number").notNull(),
    objectPath: text("object_path"),
    fileName: text("file_name"),
    mimeType: text("mime_type"),
    documentNumber: text("document_number"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    uploadedByProfileId: integer("uploaded_by_profile_id").references(() => profilesTable.id, { onDelete: "set null" }),
    uploadedAt: timestamp("uploaded_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    documentIdx: index("compliance_document_versions_document_idx").on(table.documentId),
  }),
);

export const complianceAuditLogsTable = pgTable(
  "compliance_audit_logs",
  {
    id: serial("id").primaryKey(),
    documentId: integer("document_id").references(() => complianceDocumentsTable.id, { onDelete: "set null" }),
    action: complianceAuditActionEnum("action").notNull(),
    actorProfileId: integer("actor_profile_id").references(() => profilesTable.id, { onDelete: "set null" }),
    previousStatus: complianceDocumentStatusEnum("previous_status"),
    nextStatus: complianceDocumentStatusEnum("next_status"),
    reason: text("reason"),
    notes: text("notes"),
    metadataJson: text("metadata_json"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    documentIdx: index("compliance_audit_logs_document_idx").on(table.documentId),
    actionIdx: index("compliance_audit_logs_action_idx").on(table.action),
  }),
);

export const complianceEventsTable = pgTable(
  "compliance_events",
  {
    id: serial("id").primaryKey(),
    documentId: integer("document_id").references(() => complianceDocumentsTable.id, { onDelete: "set null" }),
    profileId: integer("profile_id").references(() => profilesTable.id, { onDelete: "cascade" }),
    truckId: integer("truck_id").references(() => trucksTable.id, { onDelete: "cascade" }),
    eventType: text("event_type").notNull(),
    message: text("message").notNull(),
    deliveryStatus: text("delivery_status").notNull().default("pending"),
    metadataJson: text("metadata_json"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    profileIdx: index("compliance_events_profile_idx").on(table.profileId),
    statusIdx: index("compliance_events_delivery_status_idx").on(table.deliveryStatus),
  }),
);

export const insertComplianceDocumentSchema = createInsertSchema(complianceDocumentsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertComplianceDocumentVersionSchema = createInsertSchema(complianceDocumentVersionsTable).omit({ id: true });
export const insertComplianceAuditLogSchema = createInsertSchema(complianceAuditLogsTable).omit({ id: true, createdAt: true });
export const insertComplianceEventSchema = createInsertSchema(complianceEventsTable).omit({ id: true, createdAt: true });

export type ComplianceDocument = typeof complianceDocumentsTable.$inferSelect;
export type InsertComplianceDocument = z.infer<typeof insertComplianceDocumentSchema>;
export type ComplianceDocumentVersion = typeof complianceDocumentVersionsTable.$inferSelect;
export type InsertComplianceDocumentVersion = z.infer<typeof insertComplianceDocumentVersionSchema>;
export type ComplianceAuditLog = typeof complianceAuditLogsTable.$inferSelect;
export type InsertComplianceAuditLog = z.infer<typeof insertComplianceAuditLogSchema>;
export type ComplianceEvent = typeof complianceEventsTable.$inferSelect;
export type InsertComplianceEvent = z.infer<typeof insertComplianceEventSchema>;
