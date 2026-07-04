import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";
import { profilesTable } from "./profiles";

export const uploadSessionsTable = pgTable("upload_sessions", {
  id: text("id").primaryKey(),
  profileId: integer("profile_id")
    .notNull()
    .references(() => profilesTable.id),
  objectPath: text("object_path").notNull(),
  maxSize: integer("max_size").notNull(),
  contentType: text("content_type").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type UploadSession = typeof uploadSessionsTable.$inferSelect;
