import { eq } from "drizzle-orm";
import {
  db,
  activityTable,
  notificationPreferencesTable,
  profilesTable,
  type InsertActivity,
  type NotificationPreferences,
  type Profile,
} from "@workspace/db";
import { activityPushTitle, sendExpoPushToProfile } from "./pushNotifications";
import { getUncachableResendClient } from "./resendClient";
import { sendSms } from "./smsClient";
import { logger } from "./logger";

export type NotificationTopic =
  | "job"
  | "payment"
  | "bid"
  | "compliance"
  | "reminder"
  | "marketing"
  | "general";

export type NotifyInput = {
  profileId: number;
  type: InsertActivity["type"];
  description: string;
  title?: string;
  topic?: NotificationTopic;
  relatedId?: number | null;
  relatedBinOrderId?: string | null;
  /** Force channels regardless of prefs (e.g. security). */
  forceChannels?: Partial<{ push: boolean; email: boolean; sms: boolean }>;
};

export const DEFAULT_NOTIFICATION_PREFS: Omit<
  NotificationPreferences,
  "id" | "profileId" | "createdAt" | "updatedAt" | "smsPhone"
> = {
  pushEnabled: true,
  emailEnabled: true,
  smsEnabled: false,
  jobUpdates: true,
  paymentUpdates: true,
  bidUpdates: true,
  complianceUpdates: true,
  reminders: true,
  marketing: false,
};

export function topicAllowed(
  prefs: Pick<
    NotificationPreferences,
    "jobUpdates" | "paymentUpdates" | "bidUpdates" | "complianceUpdates" | "reminders" | "marketing"
  >,
  topic: NotificationTopic,
): boolean {
  switch (topic) {
    case "job":
      return prefs.jobUpdates;
    case "payment":
      return prefs.paymentUpdates;
    case "bid":
      return prefs.bidUpdates;
    case "compliance":
      return prefs.complianceUpdates;
    case "reminder":
      return prefs.reminders;
    case "marketing":
      return prefs.marketing;
    default:
      return true;
  }
}

export async function getNotificationPreferences(
  profileId: number,
): Promise<NotificationPreferences | typeof DEFAULT_NOTIFICATION_PREFS & { profileId: number; smsPhone: null }> {
  const [row] = await db
    .select()
    .from(notificationPreferencesTable)
    .where(eq(notificationPreferencesTable.profileId, profileId));
  if (row) return row;
  return { ...DEFAULT_NOTIFICATION_PREFS, profileId, smsPhone: null };
}

export async function upsertNotificationPreferences(
  profileId: number,
  patch: Partial<{
    pushEnabled: boolean;
    emailEnabled: boolean;
    smsEnabled: boolean;
    jobUpdates: boolean;
    paymentUpdates: boolean;
    bidUpdates: boolean;
    complianceUpdates: boolean;
    reminders: boolean;
    marketing: boolean;
    smsPhone: string | null;
  }>,
): Promise<NotificationPreferences> {
  const [existing] = await db
    .select()
    .from(notificationPreferencesTable)
    .where(eq(notificationPreferencesTable.profileId, profileId));

  if (existing) {
    const [updated] = await db
      .update(notificationPreferencesTable)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(notificationPreferencesTable.profileId, profileId))
      .returning();
    return updated;
  }

  const [created] = await db
    .insert(notificationPreferencesTable)
    .values({
      profileId,
      ...DEFAULT_NOTIFICATION_PREFS,
      ...patch,
    })
    .returning();
  return created;
}

function topicFromActivityType(type: string): NotificationTopic {
  if (type.startsWith("payment") || type.startsWith("invoice") || type.startsWith("payout") || type.includes("refund")) {
    return "payment";
  }
  if (type.startsWith("bid")) return "bid";
  if (type.includes("reminder") || type === "job_reminder") return "reminder";
  if (type.includes("application") || type.includes("compliance")) return "compliance";
  if (type.startsWith("job") || type.startsWith("request") || type.startsWith("bin") || type.startsWith("delivery") || type.startsWith("driver") || type === "recurring_created") {
    return "job";
  }
  return "general";
}

async function sendTransactionalEmail(
  profile: Profile,
  title: string,
  description: string,
): Promise<void> {
  if (!profile.email) return;
  try {
    const { client, fromEmail } = await getUncachableResendClient();
    await client.emails.send({
      from: fromEmail,
      to: profile.email,
      subject: title,
      html: [
        '<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#0f172a;">',
        `<h2 style="font-size:18px;">${escapeHtml(title)}</h2>`,
        `<p>${escapeHtml(description)}</p>`,
        '<p style="color:#64748b;font-size:13px;">HaulBrokr</p>',
        "</div>",
      ].join(""),
    });
  } catch (err) {
    logger.error({ err, profileId: profile.id }, "Notification email failed");
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Record in-app activity and fan out to push / email / SMS per preferences.
 */
export async function notifyUser(input: NotifyInput): Promise<void> {
  const topic = input.topic ?? topicFromActivityType(input.type);
  const title = input.title ?? activityPushTitle(input.type);

  try {
    await db.insert(activityTable).values({
      profileId: input.profileId,
      type: input.type,
      description: input.description,
      relatedId: input.relatedId ?? undefined,
      relatedBinOrderId: input.relatedBinOrderId ?? undefined,
    });
  } catch (err) {
    logger.error({ err, type: input.type, profileId: input.profileId }, "Failed to record activity");
    return;
  }

  const prefs = await getNotificationPreferences(input.profileId);
  if (!topicAllowed(prefs, topic)) return;

  const [profile] = await db.select().from(profilesTable).where(eq(profilesTable.id, input.profileId));
  if (!profile) return;

  const pushOn = input.forceChannels?.push ?? prefs.pushEnabled;
  const emailOn = input.forceChannels?.email ?? prefs.emailEnabled;
  const smsOn = input.forceChannels?.sms ?? prefs.smsEnabled;

  if (pushOn) {
    await sendExpoPushToProfile(input.profileId, title, input.description, {
      type: input.type,
      relatedId: input.relatedId ?? null,
      relatedBinOrderId: input.relatedBinOrderId ?? null,
      topic,
    });
  }

  if (emailOn) {
    await sendTransactionalEmail(profile, title, input.description);
  }

  if (smsOn) {
    const phone = prefs.smsPhone || profile.phone;
    if (phone) {
      await sendSms(phone, `HaulBrokr: ${title} — ${input.description}`);
    }
  }
}

/** Back-compat wrapper used by existing call sites. */
export async function recordActivity(activity: InsertActivity): Promise<void> {
  await notifyUser({
    profileId: activity.profileId,
    type: activity.type,
    description: activity.description,
    relatedId: activity.relatedId ?? null,
    relatedBinOrderId: activity.relatedBinOrderId ?? null,
  });
}

export type AudienceRole = "driver" | "customer" | "dispatcher" | "fleet_manager" | "provider" | "supervisor";

/**
 * Notify every org member matching the given audience roles.
 */
export async function notifyOrgRoles(
  organizationId: number,
  roles: AudienceRole[],
  payload: Omit<NotifyInput, "profileId">,
): Promise<number> {
  const members = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.organizationId, organizationId));

  let sent = 0;
  for (const member of members) {
    const orgRole = member.orgRole;
    const matches =
      (roles.includes("driver") && member.role === "driver") ||
      (roles.includes("customer") && member.role === "customer") ||
      (roles.includes("provider") && member.role === "provider") ||
      (roles.includes("supervisor") && member.role === "supervisor") ||
      (roles.includes("dispatcher") && orgRole === "dispatcher") ||
      (roles.includes("fleet_manager") && orgRole === "fleet_manager") ||
      (roles.includes("dispatcher") && orgRole === "admin" && member.role === "provider") ||
      (roles.includes("fleet_manager") && (orgRole === "owner" || orgRole === "admin") && member.role === "provider");

    if (!matches) continue;
    await notifyUser({ ...payload, profileId: member.id });
    sent += 1;
  }
  return sent;
}
