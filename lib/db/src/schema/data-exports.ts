import { pgTable, text, serial, timestamp, integer, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { profilesTable } from "./profiles";

export const dataExportStatusEnum = pgEnum("data_export_status", [
  "requested",
  "processing",
  "ready",
  "failed",
  "expired",
]);

export const dataExportRequestsTable = pgTable("data_export_requests", {
  id: serial("id").primaryKey(),
  profileId: integer("profile_id").notNull().references(() => profilesTable.id, { onDelete: "cascade" }),
  status: dataExportStatusEnum("status").notNull().default("requested"),
  objectPath: text("object_path"),
  downloadTokenHash: text("download_token_hash"),
  errorMessage: text("error_message"),
  byteSize: integer("byte_size"),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  notifiedAt: timestamp("notified_at", { withTimezone: true }),
  requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
  readyAt: timestamp("ready_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertDataExportRequestSchema = createInsertSchema(dataExportRequestsTable).omit({
  id: true,
  requestedAt: true,
  updatedAt: true,
});
export type InsertDataExportRequest = z.infer<typeof insertDataExportRequestSchema>;
export type DataExportRequest = typeof dataExportRequestsTable.$inferSelect;
