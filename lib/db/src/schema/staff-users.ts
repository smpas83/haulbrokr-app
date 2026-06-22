import { pgTable, text, serial, timestamp, boolean } from "drizzle-orm/pg-core";
import { staffRoleEnum } from "./profiles";

/** HaulBrokr internal staff accounts (username + password) for the admin command center. */
export const staffUsersTable = pgTable("staff_users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  staffRole: staffRoleEnum("staff_role").notNull(),
  displayName: text("display_name").notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type StaffUser = typeof staffUsersTable.$inferSelect;
