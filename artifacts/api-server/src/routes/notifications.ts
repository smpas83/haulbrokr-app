import { Router, type IRouter } from "express";
import { db, deviceTokensTable, activityTable } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import { getRequestProfile, requireProfile } from "../middlewares/requireAuth";

const router: IRouter = Router();

/** Register Expo push token for OS notifications. */
router.post("/notifications/register", requireProfile, async (req, res): Promise<void> => {
  const profile = getRequestProfile(req);
  const token = String(req.body?.expoPushToken ?? "").trim();
  const platform = String(req.body?.platform ?? "unknown");

  if (!token.startsWith("ExponentPushToken") && !token.startsWith("ExpoPushToken")) {
    res.status(400).json({ error: "Invalid expo push token format." });
    return;
  }

  const [existing] = await db.select()
    .from(deviceTokensTable)
    .where(and(
      eq(deviceTokensTable.profileId, profile.id),
      eq(deviceTokensTable.expoPushToken, token),
    ))
    .limit(1);

  if (existing) {
    await db.update(deviceTokensTable)
      .set({ platform, updatedAt: new Date() })
      .where(eq(deviceTokensTable.id, existing.id));
  } else {
    await db.insert(deviceTokensTable).values({ profileId: profile.id, expoPushToken: token, platform });
  }

  res.status(201).json({ registered: true });
});

/** In-app notification feed (activity stream). */
router.get("/notifications", requireProfile, async (req, res): Promise<void> => {
  const profile = getRequestProfile(req);
  const items = await db.select()
    .from(activityTable)
    .where(eq(activityTable.profileId, profile.id))
    .orderBy(desc(activityTable.createdAt))
    .limit(50);

  res.json(items);
});

export default router;
