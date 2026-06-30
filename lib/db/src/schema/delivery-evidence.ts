import { pgTable, text, serial, timestamp, integer, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { profilesTable } from "./profiles";
import { jobsTable } from "./jobs";

export const deliveryEvidenceTable = pgTable("delivery_evidence", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id").notNull().references(() => jobsTable.id),
  uploadedByProfileId: integer("uploaded_by_profile_id").notNull().references(() => profilesTable.id),
  photoUrl: text("photo_url"),
  photoCaption: text("photo_caption"),
  siteNotes: text("site_notes"),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("delivery_evidence_job_idx").on(table.jobId),
]);

export const insertDeliveryEvidenceSchema = createInsertSchema(deliveryEvidenceTable).omit({ id: true, createdAt: true });
export type InsertDeliveryEvidence = z.infer<typeof insertDeliveryEvidenceSchema>;
export type DeliveryEvidence = typeof deliveryEvidenceTable.$inferSelect;
