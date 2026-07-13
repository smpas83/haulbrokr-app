import { pgTable, text, serial, timestamp, integer, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { profilesTable } from "./profiles";

/**
 * Encrypted Sign in with Apple refresh tokens captured at native sign-in.
 * Owned by the HaulBrokr API (not Clerk) so account deletion can call Apple's
 * /auth/revoke endpoint with an auditable, retryable workflow.
 */
export const appleTokenStatusEnum = pgEnum("apple_token_status", [
  "active",
  "revoked",
  "revoke_pending",
  "revoke_failed",
]);

export const appleAuthTokensTable = pgTable("apple_auth_tokens", {
  id: serial("id").primaryKey(),
  profileId: integer("profile_id").references(() => profilesTable.id),
  clerkId: text("clerk_id").notNull(),
  appleSubject: text("apple_subject"),
  /** AES-256-GCM ciphertext of the Apple refresh token. Never log or return this. */
  encryptedRefreshToken: text("encrypted_refresh_token").notNull(),
  status: appleTokenStatusEnum("status").notNull().default("active"),
  lastError: text("last_error"),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const accountDeletionStatusEnum = pgEnum("account_deletion_status", [
  "pending",
  "revoking_apple",
  "anonymizing",
  "deleting_clerk",
  "completed",
  "failed",
]);

export const appleRevokeStatusEnum = pgEnum("apple_revoke_status", [
  "not_needed",
  "pending",
  "succeeded",
  "failed",
]);

/**
 * Durable account-deletion outbox. Survives partial failures so Apple token
 * revocation and Clerk deletion can be retried independently of the HTTP request.
 */
export const accountDeletionJobsTable = pgTable("account_deletion_jobs", {
  id: serial("id").primaryKey(),
  clerkId: text("clerk_id").notNull(),
  profileId: integer("profile_id"),
  status: accountDeletionStatusEnum("status").notNull().default("pending"),
  appleRevokeStatus: appleRevokeStatusEnum("apple_revoke_status").notNull().default("pending"),
  attemptCount: integer("attempt_count").notNull().default(0),
  nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }).notNull().defaultNow(),
  lastError: text("last_error"),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertAppleAuthTokenSchema = createInsertSchema(appleAuthTokensTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertAppleAuthToken = z.infer<typeof insertAppleAuthTokenSchema>;
export type AppleAuthToken = typeof appleAuthTokensTable.$inferSelect;

export const insertAccountDeletionJobSchema = createInsertSchema(accountDeletionJobsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertAccountDeletionJob = z.infer<typeof insertAccountDeletionJobSchema>;
export type AccountDeletionJob = typeof accountDeletionJobsTable.$inferSelect;
