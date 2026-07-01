import { eq } from "drizzle-orm";
import {
  db,
  notificationDeliveryTable,
  notificationQueueTable,
  profilesTable,
  type NotificationQueue,
} from "@workspace/db";
import { getUncachableResendClient } from "./resendClient";

export type NotificationChannel = "email" | "sms" | "push" | "in_app";

async function insertReturning<T>(result: unknown, fallback: T): Promise<T> {
  if (result && typeof result === "object" && "returning" in result && typeof (result as any).returning === "function") {
    const [row] = await (result as { returning: () => Promise<T[]> }).returning();
    return row ?? fallback;
  }
  await result;
  return fallback;
}

export async function queueNotification(input: {
  profileId?: number | null;
  eventType: string;
  channel: NotificationChannel;
  subject?: string | null;
  body: string;
  relatedJobId?: number | null;
  scheduledFor?: Date;
}) {
  const values = {
    profileId: input.profileId ?? null,
    eventType: input.eventType,
    channel: input.channel,
    subject: input.subject ?? null,
    body: input.body,
    relatedJobId: input.relatedJobId ?? null,
    status: "queued" as const,
    scheduledFor: input.scheduledFor ?? new Date(),
    attempts: 0,
    maxAttempts: 3,
  };
  return insertReturning(db.insert(notificationQueueTable).values(values), {
    id: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastError: null,
    ...values,
  });
}

async function deliverEmail(notification: NotificationQueue) {
  if (!notification.profileId) throw new Error("Email notification requires a profile.");
  const [profile] = await db
    .select({ email: profilesTable.email, contactName: profilesTable.contactName })
    .from(profilesTable)
    .where(eq(profilesTable.id, notification.profileId));
  if (!profile?.email) throw new Error("Recipient email is not available.");
  const { client, fromEmail } = await getUncachableResendClient();
  const result = await client.emails.send({
    from: fromEmail,
    to: profile.email,
    subject: notification.subject ?? "HaulBrokr update",
    text: notification.body,
  });
  return String((result as any)?.id ?? "email_sent");
}

async function deliverSms() {
  if (!process.env.SMS_PROVIDER_API_KEY) {
    throw new Error("SMS provider is not configured.");
  }
  return "sms_provider_configured";
}

async function deliverPush() {
  if (!process.env.PUSH_PROVIDER_API_KEY) {
    throw new Error("Push provider is not configured.");
  }
  return "push_provider_configured";
}

export async function deliverNotification(notification: NotificationQueue) {
  let providerMessageId: string | null = null;
  try {
    if (notification.channel === "email") providerMessageId = await deliverEmail(notification);
    else if (notification.channel === "sms") providerMessageId = await deliverSms();
    else if (notification.channel === "push") providerMessageId = await deliverPush();
    else providerMessageId = "in_app_queued";

    await db.insert(notificationDeliveryTable).values({
      notificationId: notification.id,
      channel: notification.channel,
      status: "sent",
      providerMessageId,
    });
    const [updated] = await db.update(notificationQueueTable).set({
      status: "sent",
      attempts: notification.attempts + 1,
      lastError: null,
    }).where(eq(notificationQueueTable.id, notification.id)).returning();
    return updated;
  } catch (err: any) {
    await db.insert(notificationDeliveryTable).values({
      notificationId: notification.id,
      channel: notification.channel,
      status: "failed",
      error: err?.message ?? "Notification delivery failed.",
    });
    const attempts = notification.attempts + 1;
    const [updated] = await db.update(notificationQueueTable).set({
      status: attempts >= notification.maxAttempts ? "failed" : "queued",
      attempts,
      lastError: err?.message ?? "Notification delivery failed.",
    }).where(eq(notificationQueueTable.id, notification.id)).returning();
    return updated;
  }
}
