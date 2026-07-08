import {
  pgTable,
  text,
  serial,
  timestamp,
  integer,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { profilesTable } from "./profiles";

export const deviceTokensTable = pgTable(
  "device_tokens",
  {
    id: serial("id").primaryKey(),
    profileId: integer("profile_id")
      .notNull()
      .references(() => profilesTable.id, { onDelete: "cascade" }),
    expoPushToken: text("expo_push_token").notNull(),
    platform: text("platform").notNull().default("unknown"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => ({
    profileTokenIdx: uniqueIndex("device_tokens_profile_token_idx").on(
      t.profileId,
      t.expoPushToken,
    ),
  }),
);

export type DeviceToken = typeof deviceTokensTable.$inferSelect;
