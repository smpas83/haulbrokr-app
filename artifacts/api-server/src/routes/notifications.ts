import { Router, type IRouter } from "express";
import { and, eq, desc, isNull } from "drizzle-orm";
import { db, notificationsTable } from "@workspace/db";
import { requireProfile, getRequestProfile } from "../middlewares/requireAuth";
import { countUnread } from "../lib/notifications";

const router: IRouter = Router();

function parseId(raw: unknown): number | null {
  const v = Array.isArray(raw) ? raw[0] : raw;
  const n = parseInt(String(v), 10);
  return Number.isNaN(n) || n <= 0 ? null : n;
}

// GET /notifications — the signed-in user's inbox (newest first). `?unread=1`
// returns only unread items.
router.get("/notifications", requireProfile, async (req, res): Promise<void> => {
  const profile = getRequestProfile(req);
  const unreadOnly = req.query.unread === "1" || req.query.unread === "true";
  const conds = [eq(notificationsTable.recipientProfileId, profile.id)];
  if (unreadOnly) conds.push(isNull(notificationsTable.readAt));
  const rows = await db
    .select()
    .from(notificationsTable)
    .where(and(...conds))
    .orderBy(desc(notificationsTable.createdAt));
  res.json({ notifications: rows, unreadCount: countUnread(rows) });
});

// GET /notifications/unread-count — badge count for the signed-in user.
router.get(
  "/notifications/unread-count",
  requireProfile,
  async (req, res): Promise<void> => {
    const profile = getRequestProfile(req);
    const rows = await db
      .select()
      .from(notificationsTable)
      .where(
        and(
          eq(notificationsTable.recipientProfileId, profile.id),
          isNull(notificationsTable.readAt),
        ),
      );
    res.json({ unreadCount: rows.length });
  },
);

// POST /notifications/:id/read — mark one notification read (must own it).
router.post(
  "/notifications/:id/read",
  requireProfile,
  async (req, res): Promise<void> => {
    const profile = getRequestProfile(req);
    const id = parseId(req.params.id);
    if (id === null) {
      res.status(400).json({ error: "Invalid notification id" });
      return;
    }
    const [existing] = await db
      .select()
      .from(notificationsTable)
      .where(eq(notificationsTable.id, id));
    if (!existing) {
      res.status(404).json({ error: "Notification not found" });
      return;
    }
    if (existing.recipientProfileId !== profile.id) {
      res.status(403).json({ error: "Access denied" });
      return;
    }
    const [updated] = await db
      .update(notificationsTable)
      .set({ readAt: existing.readAt ?? new Date() })
      .where(eq(notificationsTable.id, id))
      .returning();
    res.json(updated);
  },
);

// POST /notifications/read-all — mark all of the user's notifications read.
router.post(
  "/notifications/read-all",
  requireProfile,
  async (req, res): Promise<void> => {
    const profile = getRequestProfile(req);
    await db
      .update(notificationsTable)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(notificationsTable.recipientProfileId, profile.id),
          isNull(notificationsTable.readAt),
        ),
      );
    res.json({ ok: true });
  },
);

export default router;
