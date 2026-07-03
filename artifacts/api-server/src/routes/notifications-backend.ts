import { Router, type IRouter } from "express";
import { z } from "zod/v4";
import { getRequestProfile, requireProfile } from "../middlewares/requireAuth";
import { isAdmin } from "../middlewares/requireAdmin";
import {
  deliverPendingNotifications,
  enqueueNotification,
  notificationFeed,
  notificationsByStatus,
} from "../lib/notifications";

const router: IRouter = Router();

const EnqueueBody = z.object({
  profileId: z.number().int().positive().optional().nullable(),
  channels: z.array(z.enum(["email", "sms", "push", "realtime"])).min(1),
  eventType: z.string().trim().min(1).max(120),
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(4000),
  destination: z.string().trim().max(320).optional().nullable(),
  metadata: z.unknown().optional(),
});

router.get("/notifications", requireProfile, async (req, res): Promise<void> => {
  const profile = getRequestProfile(req);
  res.json({ notifications: await notificationFeed(profile.id) });
});

router.post("/notifications/events", requireProfile, async (req, res): Promise<void> => {
  const profile = getRequestProfile(req);
  const parsed = EnqueueBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const targetProfileId = parsed.data.profileId ?? profile.id;
  if (targetProfileId !== profile.id && !(await isAdmin(req))) {
    res.status(403).json({ error: "Only admins can enqueue notifications for another profile." });
    return;
  }

  const events = await enqueueNotification({
    profileId: targetProfileId,
    channels: parsed.data.channels,
    eventType: parsed.data.eventType,
    title: parsed.data.title,
    body: parsed.data.body,
    destination: parsed.data.destination ?? null,
    metadata: parsed.data.metadata,
  });
  res.status(201).json({ notifications: events });
});

router.get("/admin/notifications/pending", requireProfile, async (req, res): Promise<void> => {
  if (!(await isAdmin(req))) { res.status(403).json({ error: "Admin access required." }); return; }
  res.json({ notifications: await notificationsByStatus(["pending", "failed"]) });
});

router.post("/admin/notifications/deliver", requireProfile, async (req, res): Promise<void> => {
  if (!(await isAdmin(req))) { res.status(403).json({ error: "Admin access required." }); return; }
  const limit = typeof req.body?.limit === "number" ? req.body.limit : 50;
  const delivered = await deliverPendingNotifications(limit);
  res.json({ delivered });
});

export default router;
