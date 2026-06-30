import { pgTable, serial, timestamp, integer, text, unique, pgEnum, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { jobsTable } from "./jobs";
import { profilesTable } from "./profiles";

export const reviewTypeEnum = pgEnum("review_type", [
  "customer_to_driver",
  "driver_to_customer",
  "vendor_to_customer",
]);

export const reviewModerationStatusEnum = pgEnum("review_moderation_status", [
  "pending",
  "approved",
  "rejected",
  "hidden",
]);

export const reviewModerationActionEnum = pgEnum("review_moderation_action", [
  "created",
  "approved",
  "rejected",
  "hidden",
]);

export const ratingsTable = pgTable(
  "ratings",
  {
    id: serial("id").primaryKey(),
    jobId: integer("job_id").notNull().references(() => jobsTable.id, { onDelete: "cascade" }),
    raterProfileId: integer("rater_profile_id").notNull().references(() => profilesTable.id),
    rateeProfileId: integer("ratee_profile_id").notNull().references(() => profilesTable.id),
    reviewType: reviewTypeEnum("review_type").notNull().default("vendor_to_customer"),
    stars: integer("stars").notNull(),
    comment: text("comment"),
    moderationStatus: reviewModerationStatusEnum("moderation_status").notNull().default("pending"),
    moderationReason: text("moderation_reason"),
    moderatedByProfileId: integer("moderated_by_profile_id").references(() => profilesTable.id),
    moderatedAt: timestamp("moderated_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => ({
    reviewUnique: unique("ratings_job_rater_ratee_type_unique").on(table.jobId, table.raterProfileId, table.rateeProfileId, table.reviewType),
  }),
);

export const insertRatingSchema = createInsertSchema(ratingsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertRating = z.infer<typeof insertRatingSchema>;
export type Rating = typeof ratingsTable.$inferSelect;

export const reviewModerationHistoryTable = pgTable("review_moderation_history", {
  id: serial("id").primaryKey(),
  reviewId: integer("review_id").notNull().references(() => ratingsTable.id, { onDelete: "cascade" }),
  action: reviewModerationActionEnum("action").notNull(),
  actorProfileId: integer("actor_profile_id").references(() => profilesTable.id, { onDelete: "set null" }),
  reason: text("reason"),
  previousStatus: reviewModerationStatusEnum("previous_status"),
  nextStatus: reviewModerationStatusEnum("next_status").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const reviewAggregatesTable = pgTable(
  "review_aggregates",
  {
    id: serial("id").primaryKey(),
    profileId: integer("profile_id").notNull().references(() => profilesTable.id, { onDelete: "cascade" }),
    reviewType: reviewTypeEnum("review_type").notNull(),
    averageStars: numeric("average_stars", { precision: 4, scale: 2 }).notNull().default("0"),
    reviewCount: integer("review_count").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => ({
    profileTypeUnique: unique("review_aggregates_profile_type_unique").on(table.profileId, table.reviewType),
  }),
);

export const insertReviewModerationHistorySchema = createInsertSchema(reviewModerationHistoryTable).omit({ id: true, createdAt: true });
export const insertReviewAggregateSchema = createInsertSchema(reviewAggregatesTable).omit({ id: true, updatedAt: true });
export type ReviewModerationHistory = typeof reviewModerationHistoryTable.$inferSelect;
export type InsertReviewModerationHistory = z.infer<typeof insertReviewModerationHistorySchema>;
export type ReviewAggregate = typeof reviewAggregatesTable.$inferSelect;
export type InsertReviewAggregate = z.infer<typeof insertReviewAggregateSchema>;
