import { index, pgTable, text, serial, timestamp, integer, numeric, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { profilesTable } from "./profiles";
import { requestsTable } from "./requests";

export const bidStatusEnum = pgEnum("bid_status", ["pending", "awarded", "accepted", "rejected", "withdrawn"]);

export const bidsTable = pgTable("bids", {
  id: serial("id").primaryKey(),
  requestId: integer("request_id").notNull().references(() => requestsTable.id, { onDelete: "cascade" }),
  providerId: integer("provider_id").notNull().references(() => profilesTable.id, { onDelete: "cascade" }),
  ratePerHour: numeric("rate_per_hour", { precision: 10, scale: 2 }).notNull(),
  trucksOffered: integer("trucks_offered").notNull().default(1),
  estimatedHours: numeric("estimated_hours", { precision: 8, scale: 2 }),
  message: text("message"),
  status: bidStatusEnum("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  index("bids_request_id_idx").on(table.requestId),
  index("bids_provider_id_idx").on(table.providerId),
  index("bids_status_idx").on(table.status),
  index("bids_request_status_idx").on(table.requestId, table.status),
]);

export const insertBidSchema = createInsertSchema(bidsTable).omit({ id: true, createdAt: true, updatedAt: true, status: true });
export type InsertBid = z.infer<typeof insertBidSchema>;
export type Bid = typeof bidsTable.$inferSelect;
