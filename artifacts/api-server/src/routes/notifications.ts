import { Router, type IRouter } from "express";
import { and, asc, eq, lte } from "drizzle-orm";
import { db, notificationQueueTable } from "@workspace/db";
import { getRequestProfile, requireProfile } from "../middlewares/requireAuth";
import { requireStaffOrProfile, attachStaffSession } from "../middlewares/staffAuth";
import { attachClerkProfileIfPresent } from "../middlewares/requireAuth";
import { requirePermission } from "../middlewares/requireAdmin";
import { deliverNotification, queueNotification, type NotificationChannel } from "../lib/notificationEngine";

const router: IRouter = Router();

router.use(attachStaffSession);
router.use(attachClerkProfileIfPresent);

const EVENT_TYPES = new Set([
  "new_job",
  "bid_accepted",
  "driver_assigned",
  "driver_arrived",
  "loading_complete",
  "delivered",
  "invoice_created",
  "payment_received",
  "payout_sent",
  "review_reminder",
  "compliance_reminder",
]);

const CHANNELS = new Set(["email", "sms", "push", "in_app"]);

router.get("/notifications", requireProfile, async (req, res): Promise<void> => {
  const profile = getRequestProfile(req);
  const rows = await db
    .select()
    .from(notificationQueueTable)
    .where(eq(notificationQueueTable.profileId, profile.id))
    .orderBy(asc(notificationQueueTable.createdAt));
  res.json({ notifications: rows });
});

router.post("/notifications/queue", requireStaffOrProfile, requirePermission("overview"), async (req, res): Promise<void> => {
  const eventType = String(req.body?.eventType ?? "");
  const channel = String(req.body?.channel ?? "") as NotificationChannel;
  const body = String(req.body?.body ?? "");
  if (!EVENT_TYPES.has(eventType)) { res.status(400).json({ error: "Unsupported notification event type." }); return; }
  if (!CHANNELS.has(channel)) { res.status(400).json({ error: "Unsupported notification channel." }); return; }
  if (!body) { res.status(400).json({ error: "Notification body is required." }); return; }

  const notification = await queueNotification({
    profileId: req.body?.profileId == null ? null : Number(req.body.profileId),
    eventType,
    channel,
    subject: req.body?.subject == null ? null : String(req.body.subject),
    body,
    relatedJobId: req.body?.relatedJobId == null ? null : Number(req.body.relatedJobId),
  });
  res.status(201).json(notification);
});

router.post("/notifications/:id/retry", requireStaffOrProfile, requirePermission("overview"), async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid notification id" }); return; }
  const [notification] = await db.select().from(notificationQueueTable).where(eq(notificationQueueTable.id, id));
  if (!notification) { res.status(404).json({ error: "Notification not found" }); return; }
  const updated = await deliverNotification(notification);
  res.json(updated);
});

router.post("/admin/notifications/process", requireStaffOrProfile, requirePermission("overview"), async (_req, res): Promise<void> => {
  const due = await db
    .select()
    .from(notificationQueueTable)
    .where(and(eq(notificationQueueTable.status, "queued"), lte(notificationQueueTable.scheduledFor, new Date())))
    .orderBy(asc(notificationQueueTable.scheduledFor));
  const processed = [];
  for (const notification of due) {
    processed.push(await deliverNotification(notification));
  }
  res.json({ processed });
});

export default router;
