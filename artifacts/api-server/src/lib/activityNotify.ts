import { db, activityTable, type InsertActivity } from "@workspace/db";
import { activityPushTitle, sendExpoPushToProfile } from "./pushNotifications";
import { logger } from "./logger";

/** Record in-app activity and best-effort Expo push to the user's devices. */
export async function recordActivity(activity: InsertActivity): Promise<void> {
  try {
    await db.insert(activityTable).values(activity);
    await sendExpoPushToProfile(
      activity.profileId,
      activityPushTitle(activity.type),
      activity.description,
      {
        type: activity.type,
        relatedId: activity.relatedId ?? null,
        relatedBinOrderId: activity.relatedBinOrderId ?? null,
      },
    );
  } catch (err) {
    logger.error(
      { err, type: activity.type, profileId: activity.profileId },
      "Failed to record activity",
    );
  }
}
