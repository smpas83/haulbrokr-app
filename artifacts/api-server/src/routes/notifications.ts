import { Router, type IRouter } from "express";
import { z } from "zod/v4";
import { eq } from "drizzle-orm";
import {
  db,
  deviceTokensTable,
  activityTable,
  profilesTable,
} from "@workspace/db";
import { desc, and } from "drizzle-orm";
import { getRequestProfile, requireProfile } from "../middlewares/requireAuth";
import {
  getNotificationPreferences,
  upsertNotificationPreferences,
  notifyUser,
  notifyOrgRoles,
} from "../lib/notificationPlatform";
import { isSmsConfigured } from "../lib/smsClient";

const router: IRouter = Router();

const PrefsBody = z.object({
  pushEnabled: z.boolean().optional(),
  emailEnabled: z.boolean().optional(),
  smsEnabled: z.boolean().optional(),
  jobUpdates: z.boolean().optional(),
  paymentUpdates: z.boolean().optional(),
  bidUpdates: z.boolean().optional(),
  complianceUpdates: z.boolean().optional(),
  reminders: z.boolean().optional(),
  marketing: z.boolean().optional(),
  smsPhone: z.string().nullable().optional(),
});

/** Register Expo push token for OS notifications. */
router.post(
  "/notifications/register",
  requireProfile,
  async (req, res): Promise<void> => {
    const profile = getRequestProfile(req);
    const token = String(req.body?.expoPushToken ?? "").trim();
    const platform = String(req.body?.platform ?? "unknown");

    if (
      !token.startsWith("ExponentPushToken") &&
      !token.startsWith("ExpoPushToken")
    ) {
      res.status(400).json({ error: "Invalid expo push token format." });
      return;
    }

    const [existing] = await db
      .select()
      .from(deviceTokensTable)
      .where(
        and(
          eq(deviceTokensTable.profileId, profile.id),
          eq(deviceTokensTable.expoPushToken, token),
        ),
      )
      .limit(1);

    if (existing) {
      await db
        .update(deviceTokensTable)
        .set({ platform, updatedAt: new Date() })
        .where(eq(deviceTokensTable.id, existing.id));
    } else {
      await db
        .insert(deviceTokensTable)
        .values({ profileId: profile.id, expoPushToken: token, platform });
    }

    res.status(201).json({ registered: true });
  },
);

/** In-app notification feed (activity stream). */
router.get(
  "/notifications",
  requireProfile,
  async (req, res): Promise<void> => {
    const profile = getRequestProfile(req);
    const items = await db
      .select()
      .from(activityTable)
      .where(eq(activityTable.profileId, profile.id))
      .orderBy(desc(activityTable.createdAt))
      .limit(50);

    res.json(items);
  },
);

/** Get notification channel + topic preferences. */
router.get(
  "/notifications/preferences",
  requireProfile,
  async (req, res): Promise<void> => {
    const profile = getRequestProfile(req);
    const prefs = await getNotificationPreferences(profile.id);
    res.json({
      ...prefs,
      smsConfigured: isSmsConfigured(),
    });
  },
);

/** Update notification preferences. */
router.put(
  "/notifications/preferences",
  requireProfile,
  async (req, res): Promise<void> => {
    const profile = getRequestProfile(req);
    const parsed = PrefsBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const updated = await upsertNotificationPreferences(
      profile.id,
      parsed.data,
    );
    res.json({ ...updated, smsConfigured: isSmsConfigured() });
  },
);

/**
 * Send a role-targeted notification within the caller's organization.
 * Used by dispatchers / fleet managers for operational alerts.
 */
router.post(
  "/notifications/broadcast",
  requireProfile,
  async (req, res): Promise<void> => {
    const profile = getRequestProfile(req);
    if (!profile.organizationId) {
      res
        .status(400)
        .json({ error: "You must belong to an organization to broadcast." });
      return;
    }

    const Audience = z.object({
      roles: z
        .array(
          z.enum([
            "driver",
            "customer",
            "dispatcher",
            "fleet_manager",
            "provider",
            "supervisor",
          ]),
        )
        .min(1),
      title: z.string().min(1).max(120),
      description: z.string().min(1).max(500),
      topic: z
        .enum([
          "job",
          "payment",
          "bid",
          "compliance",
          "reminder",
          "marketing",
          "general",
        ])
        .optional(),
    });
    const parsed = Audience.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const sent = await notifyOrgRoles(
      profile.organizationId,
      parsed.data.roles,
      {
        type: "job_reminder",
        topic: parsed.data.topic ?? "general",
        title: parsed.data.title,
        description: parsed.data.description,
      },
    );

    res.json({ sent });
  },
);

/** Send a test notification to the current user (all enabled channels). */
router.post(
  "/notifications/test",
  requireProfile,
  async (req, res): Promise<void> => {
    const profile = getRequestProfile(req);
    await notifyUser({
      profileId: profile.id,
      type: "job_reminder",
      topic: "general",
      title: "HaulBrokr test notification",
      description: "Your notification channels are working.",
    });
    // Touch profiles table so unused import stays intentional if tree-shaken differently
    void profilesTable;
    res.json({ sent: true });
  },
);

export default router;
