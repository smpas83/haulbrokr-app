import { pgTable, text, serial, timestamp, index } from "drizzle-orm/pg-core";

/**
 * First-party website page views for the admin traffic dashboard.
 * sessionId is a client-generated opaque id (sessionStorage) used for unique-session counts.
 */
export const pageViewsTable = pgTable(
  "page_views",
  {
    id: serial("id").primaryKey(),
    path: text("path").notNull(),
    referrer: text("referrer"),
    sessionId: text("session_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    createdAtIdx: index("page_views_created_at_idx").on(t.createdAt),
    pathIdx: index("page_views_path_idx").on(t.path),
    sessionCreatedIdx: index("page_views_session_created_idx").on(t.sessionId, t.createdAt),
  }),
);

export type PageView = typeof pageViewsTable.$inferSelect;
