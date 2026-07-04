import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { jobsTable } from "./jobs";
import { profilesTable } from "./profiles";

export const jobMessagesTable = pgTable("job_messages", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id")
    .notNull()
    .references(() => jobsTable.id, { onDelete: "cascade" }),
  senderProfileId: integer("sender_profile_id")
    .notNull()
    .references(() => profilesTable.id),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertJobMessageSchema = createInsertSchema(jobMessagesTable).omit(
  { id: true, createdAt: true },
);
export type InsertJobMessage = z.infer<typeof insertJobMessageSchema>;
export type JobMessage = typeof jobMessagesTable.$inferSelect;
