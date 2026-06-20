import { pgTable, text, serial, timestamp, boolean, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const dumpSiteTypeEnum = pgEnum("dump_site_type", [
  "landfill",
  "transfer_station",
  "recycling_center",
  "construction_debris",
  "hazardous_waste",
  "compost",
]);

export const dumpSitesTable = pgTable("dump_sites", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  address: text("address").notNull(),
  city: text("city").notNull(),
  state: text("state").notNull(),
  zip: text("zip").notNull(),
  type: dumpSiteTypeEnum("type").notNull().default("landfill"),
  phone: text("phone"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertDumpSiteSchema = createInsertSchema(dumpSitesTable).omit({ id: true, createdAt: true });
export type InsertDumpSite = z.infer<typeof insertDumpSiteSchema>;
export type DumpSite = typeof dumpSitesTable.$inferSelect;
