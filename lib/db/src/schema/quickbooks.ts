import {
  pgTable,
  text,
  serial,
  timestamp,
  integer,
  boolean,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { profilesTable } from "./profiles";

export const quickbooksConnectionsTable = pgTable("quickbooks_connections", {
  id: serial("id").primaryKey(),
  profileId: integer("profile_id")
    .notNull()
    .unique()
    .references(() => profilesTable.id),
  connected: boolean("connected").notNull().default(false),
  realmId: text("realm_id"),
  companyName: text("company_name"),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
  lastSyncStatus: text("last_sync_status"),
  invoicesSynced: integer("invoices_synced").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertQuickbooksConnectionSchema = createInsertSchema(
  quickbooksConnectionsTable,
).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertQuickbooksConnection = z.infer<
  typeof insertQuickbooksConnectionSchema
>;
export type QuickbooksConnection =
  typeof quickbooksConnectionsTable.$inferSelect;
