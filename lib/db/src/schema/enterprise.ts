import {
  pgTable, text, serial, timestamp, integer, boolean, numeric, pgEnum, uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { profilesTable } from "./profiles";
import { organizationsTable } from "./organizations";

export const workflowStatusEnum = pgEnum("enterprise_workflow_status", [
  "draft", "pending", "in_progress", "blocked", "completed", "cancelled",
]);

export const workflowPriorityEnum = pgEnum("enterprise_workflow_priority", [
  "critical", "high", "medium", "low",
]);

export const taskStatusEnum = pgEnum("enterprise_task_status", [
  "open", "in_progress", "blocked", "done", "cancelled",
]);

export const taskEntityTypeEnum = pgEnum("enterprise_task_entity_type", [
  "load", "driver", "customer", "vendor", "fleet", "equipment", "invoice", "compliance", "ai", "support", "general",
]);

export const documentCategoryEnum = pgEnum("enterprise_document_category", [
  "coi", "insurance", "w9", "cdl", "medical", "registration", "contract", "rate_confirmation",
  "ticket", "pod", "invoice", "photo", "inspection", "other",
]);

export const enterprisePermissionEnum = pgEnum("enterprise_permission", [
  "workflows_view", "workflows_manage",
  "tasks_view", "tasks_manage",
  "documents_view", "documents_manage",
  "finance_view", "finance_manage",
  "reports_view", "reports_manage",
  "settings_view", "settings_manage",
  "scorecards_view",
  "audit_view",
]);

export const enterpriseWorkflowsTable = pgTable("enterprise_workflows", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").references(() => organizationsTable.id, { onDelete: "cascade" }),
  profileId: integer("profile_id").notNull().references(() => profilesTable.id, { onDelete: "cascade" }),
  templateKey: text("template_key").notNull(),
  title: text("title").notNull(),
  status: workflowStatusEnum("status").notNull().default("pending"),
  priority: workflowPriorityEnum("priority").notNull().default("medium"),
  ownerProfileId: integer("owner_profile_id").references(() => profilesTable.id),
  slaHours: integer("sla_hours"),
  dueAt: timestamp("due_at", { withTimezone: true }),
  relatedEntityType: text("related_entity_type"),
  relatedEntityId: integer("related_entity_id"),
  metadata: text("metadata").default("{}"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const enterpriseWorkflowEventsTable = pgTable("enterprise_workflow_events", {
  id: serial("id").primaryKey(),
  workflowId: integer("workflow_id").notNull().references(() => enterpriseWorkflowsTable.id, { onDelete: "cascade" }),
  actorProfileId: integer("actor_profile_id").references(() => profilesTable.id),
  eventType: text("event_type").notNull(),
  comment: text("comment"),
  attachmentPath: text("attachment_path"),
  metadata: text("metadata").default("{}"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const enterpriseTasksTable = pgTable("enterprise_tasks", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").references(() => organizationsTable.id, { onDelete: "cascade" }),
  profileId: integer("profile_id").notNull().references(() => profilesTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  status: taskStatusEnum("status").notNull().default("open"),
  priority: workflowPriorityEnum("priority").notNull().default("medium"),
  entityType: taskEntityTypeEnum("entity_type").notNull().default("general"),
  entityId: integer("entity_id"),
  assigneeProfileId: integer("assignee_profile_id").references(() => profilesTable.id),
  dueAt: timestamp("due_at", { withTimezone: true }),
  recurringRule: text("recurring_rule"),
  dependsOnTaskId: integer("depends_on_task_id"),
  reminderAt: timestamp("reminder_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const enterpriseDocumentsTable = pgTable("enterprise_documents", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").references(() => organizationsTable.id, { onDelete: "cascade" }),
  profileId: integer("profile_id").notNull().references(() => profilesTable.id, { onDelete: "cascade" }),
  category: documentCategoryEnum("category").notNull(),
  title: text("title").notNull(),
  sourceTable: text("source_table"),
  sourceId: integer("source_id"),
  objectPath: text("object_path"),
  fileName: text("file_name"),
  mimeType: text("mime_type"),
  version: integer("version").notNull().default(1),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  ocrText: text("ocr_text"),
  metadata: text("metadata").default("{}"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const enterpriseReportsTable = pgTable("enterprise_reports", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").references(() => organizationsTable.id, { onDelete: "cascade" }),
  profileId: integer("profile_id").notNull().references(() => profilesTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  config: text("config").notNull().default("{}"),
  scheduleCron: text("schedule_cron"),
  shared: boolean("shared").notNull().default(false),
  lastRunAt: timestamp("last_run_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const enterpriseSettingsTable = pgTable("enterprise_settings", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").references(() => organizationsTable.id, { onDelete: "cascade" }),
  profileId: integer("profile_id").references(() => profilesTable.id, { onDelete: "cascade" }),
  settings: text("settings").notNull().default("{}"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  uniqueIndex("enterprise_settings_org_idx").on(t.organizationId),
]);

export const enterpriseAuditLogsTable = pgTable("enterprise_audit_logs", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").references(() => organizationsTable.id, { onDelete: "set null" }),
  actorProfileId: integer("actor_profile_id").references(() => profilesTable.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  resourceType: text("resource_type").notNull(),
  resourceId: text("resource_id"),
  details: text("details").default("{}"),
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const enterpriseRolePermissionsTable = pgTable("enterprise_role_permissions", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  orgRole: text("org_role").notNull(),
  permission: enterprisePermissionEnum("permission").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("enterprise_role_perm_idx").on(t.organizationId, t.orgRole, t.permission),
]);

export const insertEnterpriseWorkflowSchema = createInsertSchema(enterpriseWorkflowsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertEnterpriseTaskSchema = createInsertSchema(enterpriseTasksTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertEnterpriseReportSchema = createInsertSchema(enterpriseReportsTable).omit({ id: true, createdAt: true, updatedAt: true });

export type EnterpriseWorkflow = typeof enterpriseWorkflowsTable.$inferSelect;
export type EnterpriseTask = typeof enterpriseTasksTable.$inferSelect;
export type EnterpriseDocument = typeof enterpriseDocumentsTable.$inferSelect;
export type EnterpriseReport = typeof enterpriseReportsTable.$inferSelect;
