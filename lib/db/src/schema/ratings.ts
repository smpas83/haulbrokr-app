import {
  pgTable,
  serial,
  timestamp,
  integer,
  text,
  unique,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { jobsTable } from "./jobs";
import { profilesTable } from "./profiles";

export const ratingsTable = pgTable(
  "ratings",
  {
    id: serial("id").primaryKey(),
    jobId: integer("job_id")
      .notNull()
      .references(() => jobsTable.id, { onDelete: "cascade" }),
    raterProfileId: integer("rater_profile_id")
      .notNull()
      .references(() => profilesTable.id),
    rateeProfileId: integer("ratee_profile_id")
      .notNull()
      .references(() => profilesTable.id),
    stars: integer("stars").notNull(),
    comment: text("comment"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    jobRaterUnique: unique("ratings_job_rater_unique").on(
      table.jobId,
      table.raterProfileId,
    ),
  }),
);

export const insertRatingSchema = createInsertSchema(ratingsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertRating = z.infer<typeof insertRatingSchema>;
export type Rating = typeof ratingsTable.$inferSelect;
