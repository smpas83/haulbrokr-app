import { pgTable, text, serial, timestamp, integer, numeric, pgEnum, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { profilesTable } from "./profiles";

export const autonomousRecommendationStatusEnum = pgEnum("autonomous_recommendation_status", [
  "pending",
  "approved",
  "rejected",
  "modified",
  "executed",
  "dismissed",
]);

export const autonomousRecommendationPriorityEnum = pgEnum("autonomous_recommendation_priority", [
  "critical",
  "high",
  "medium",
  "low",
]);

export const autonomousActionTypeEnum = pgEnum("autonomous_action_type", [
  "assign_truck",
  "combine_loads",
  "increase_rate",
  "contact_customer",
  "notify_vendor",
  "notify_driver",
  "schedule_maintenance",
  "renew_insurance",
  "escalate_delay",
  "generate_invoice",
  "create_follow_up",
]);

export const autonomousRecommendationsTable = pgTable("autonomous_recommendations", {
  id: serial("id").primaryKey(),
  profileId: integer("profile_id").notNull().references(() => profilesTable.id, { onDelete: "cascade" }),
  externalKey: text("external_key").notNull(),
  actionType: autonomousActionTypeEnum("action_type").notNull(),
  priority: autonomousRecommendationPriorityEnum("priority").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  businessImpact: text("business_impact").notNull(),
  confidence: integer("confidence").notNull(),
  estimatedRoi: numeric("estimated_roi", { precision: 12, scale: 2 }),
  status: autonomousRecommendationStatusEnum("status").notNull().default("pending"),
  payload: text("payload").notNull().default("{}"),
  modifiedPayload: text("modified_payload"),
  relatedJobId: integer("related_job_id"),
  relatedRequestId: integer("related_request_id"),
  relatedTruckId: integer("related_truck_id"),
  approvedByProfileId: integer("approved_by_profile_id").references(() => profilesTable.id),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  executedAt: timestamp("executed_at", { withTimezone: true }),
  rejectionReason: text("rejection_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  uniqueIndex("autonomous_recommendations_profile_key_idx").on(t.profileId, t.externalKey),
]);

export const autonomousTimelineTable = pgTable("autonomous_timeline", {
  id: serial("id").primaryKey(),
  profileId: integer("profile_id").notNull().references(() => profilesTable.id, { onDelete: "cascade" }),
  eventType: text("event_type").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  recommendationId: integer("recommendation_id").references(() => autonomousRecommendationsTable.id, { onDelete: "set null" }),
  metadata: text("metadata").default("{}"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const autonomousMemoryTable = pgTable("autonomous_memory", {
  id: serial("id").primaryKey(),
  profileId: integer("profile_id").notNull().references(() => profilesTable.id, { onDelete: "cascade" }),
  memoryType: text("memory_type").notNull(),
  key: text("key").notNull(),
  value: text("value").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("autonomous_memory_profile_key_idx").on(t.profileId, t.memoryType, t.key),
]);

export const insertAutonomousRecommendationSchema = createInsertSchema(autonomousRecommendationsTable)
  .omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAutonomousRecommendation = z.infer<typeof insertAutonomousRecommendationSchema>;
export type AutonomousRecommendation = typeof autonomousRecommendationsTable.$inferSelect;

export const insertAutonomousTimelineSchema = createInsertSchema(autonomousTimelineTable)
  .omit({ id: true, createdAt: true });
export type InsertAutonomousTimeline = z.infer<typeof insertAutonomousTimelineSchema>;

export const insertAutonomousMemorySchema = createInsertSchema(autonomousMemoryTable)
  .omit({ id: true, createdAt: true });
export type InsertAutonomousMemory = z.infer<typeof insertAutonomousMemorySchema>;
