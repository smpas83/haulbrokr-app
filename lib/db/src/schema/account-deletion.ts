import { pgTable, text, serial, timestamp, integer, jsonb, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { profilesTable } from "./profiles";

export const accountDeletionStatusEnum = pgEnum("account_deletion_status", [
  "requested",
  "blocked_owner",
  "processing",
  "completed",
  "failed",
]);

/**
 * Resumable account-deletion workflow state.
 * Personal identifiers are cleared once processing completes.
 */
export const accountDeletionRequestsTable = pgTable("account_deletion_requests", {
  id: serial("id").primaryKey(),
  profileId: integer("profile_id").notNull().references(() => profilesTable.id),
  clerkIdHash: text("clerk_id_hash").notNull(),
  status: accountDeletionStatusEnum("status").notNull().default("requested"),
  confirmationPhrase: text("confirmation_phrase"),
  blockReason: text("block_reason"),
  errorMessage: text("error_message"),
  stepsCompleted: jsonb("steps_completed").$type<string[]>().notNull().default([]),
  requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

/**
 * Secure deletion audit event — no unnecessary personal data.
 */
export const accountDeletionAuditTable = pgTable("account_deletion_audit", {
  id: serial("id").primaryKey(),
  profileId: integer("profile_id"),
  clerkIdHash: text("clerk_id_hash").notNull(),
  organizationId: integer("organization_id"),
  outcome: text("outcome").notNull(),
  retentionCategories: jsonb("retention_categories").$type<string[]>().notNull().default([]),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAccountDeletionRequestSchema = createInsertSchema(accountDeletionRequestsTable).omit({
  id: true,
  requestedAt: true,
  updatedAt: true,
});
export type InsertAccountDeletionRequest = z.infer<typeof insertAccountDeletionRequestSchema>;
export type AccountDeletionRequest = typeof accountDeletionRequestsTable.$inferSelect;
export type AccountDeletionAudit = typeof accountDeletionAuditTable.$inferSelect;
