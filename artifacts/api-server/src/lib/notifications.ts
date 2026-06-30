import { eq } from "drizzle-orm";
import {
  db,
  notificationDeliveriesTable,
  notificationsTable,
  profilesTable,
} from "@workspace/db";
import type {
  Notification,
  NotificationChannel,
  NotificationDeliveryStatus,
  NotificationType,
} from "@workspace/db";
import { getUncachableResendClient } from "./resendClient";
import { logger } from "./logger";

/**
 * Reusable notification service. `createNotification` is the single write path
 * used by feature code to drop an item into a recipient's inbox; the pure
 * helpers below are used by the read endpoints and are trivially unit-testable.
 */

export interface CreateNotificationInput {
  recipientProfileId: number;
  type: NotificationType;
  title: string;
  body?: string | null;
  relatedType?: string | null;
  relatedId?: number | null;
  channels?: NotificationChannel[];
}

/**
 * Persist a notification. Best-effort by contract: callers in non-critical
 * paths should swallow errors so a notification failure never breaks the
 * primary action (mirrors the existing best-effort activity inserts).
 */
export async function createNotification(
  input: CreateNotificationInput,
): Promise<Notification> {
  const [row] = await db
    .insert(notificationsTable)
    .values({
      recipientProfileId: input.recipientProfileId,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      relatedType: input.relatedType ?? null,
      relatedId: input.relatedId ?? null,
    })
    .returning();
  return row;
}

async function recordDelivery(input: {
  notificationId: number;
  channel: NotificationChannel;
  status: NotificationDeliveryStatus;
  provider?: string | null;
  providerMessageId?: string | null;
  error?: string | null;
}): Promise<void> {
  await db.insert(notificationDeliveriesTable).values({
    notificationId: input.notificationId,
    channel: input.channel,
    status: input.status,
    provider: input.provider ?? null,
    providerMessageId: input.providerMessageId ?? null,
    error: input.error ?? null,
    sentAt: input.status === "sent" ? new Date() : null,
  });
}

async function recipientProfile(profileId: number) {
  const [profile] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.id, profileId));
  return profile;
}

async function postWebhook(
  url: string,
  notification: Notification,
  channel: NotificationChannel,
): Promise<string | null> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ channel, notification }),
  });
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`.trim());
  }
  return response.headers.get("x-message-id");
}

async function deliverNotification(
  notification: Notification,
  channel: NotificationChannel,
): Promise<void> {
  if (channel === "in_app") {
    await recordDelivery({
      notificationId: notification.id,
      channel,
      status: "sent",
      provider: "notifications_table",
    });
    return;
  }

  try {
    if (channel === "email") {
      const profile = await recipientProfile(notification.recipientProfileId);
      if (!profile?.email) {
        await recordDelivery({
          notificationId: notification.id,
          channel,
          status: "skipped",
          provider: "resend",
          error: "recipient_email_missing",
        });
        return;
      }
      const resend = await getUncachableResendClient();
      const sent = await resend.client.emails.send({
        from: resend.fromEmail,
        to: profile.email,
        subject: notification.title,
        text: notification.body ?? notification.title,
      });
      await recordDelivery({
        notificationId: notification.id,
        channel,
        status: "sent",
        provider: "resend",
        providerMessageId:
          typeof sent === "object" && sent !== null && "id" in sent
            ? String(sent.id)
            : null,
      });
      return;
    }

    const envByChannel: Partial<Record<NotificationChannel, string>> = {
      sms: "SMS_WEBHOOK_URL",
      push: "PUSH_WEBHOOK_URL",
      realtime: "REALTIME_WEBHOOK_URL",
    };
    const envName = envByChannel[channel];
    const url = envName ? process.env[envName] : undefined;
    if (!url) {
      await recordDelivery({
        notificationId: notification.id,
        channel,
        status: channel === "realtime" ? "sent" : "skipped",
        provider: channel === "realtime" ? "database_inbox" : null,
        error: channel === "realtime" ? null : `${envName}_missing`,
      });
      return;
    }
    const messageId = await postWebhook(url, notification, channel);
    await recordDelivery({
      notificationId: notification.id,
      channel,
      status: "sent",
      provider: "webhook",
      providerMessageId: messageId,
    });
  } catch (err) {
    await recordDelivery({
      notificationId: notification.id,
      channel,
      status: "failed",
      error: err instanceof Error ? err.message : String(err),
    });
    logger.error(
      { err, notificationId: notification.id, channel },
      "Notification delivery failed",
    );
  }
}

export async function dispatchNotification(
  input: CreateNotificationInput,
): Promise<Notification> {
  const notification = await createNotification(input);
  const channels = input.channels ?? ["in_app", "realtime"];
  for (const channel of channels) {
    await deliverNotification(notification, channel);
  }
  return notification;
}

/** Fire-and-forget wrapper: never throws, logs nothing (caller may log). */
export async function safeNotify(
  input: CreateNotificationInput,
): Promise<void> {
  try {
    await dispatchNotification(input);
  } catch {
    // Intentionally ignored — notifications must not break primary actions.
  }
}

export function isUnread(n: Pick<Notification, "readAt">): boolean {
  return n.readAt == null;
}

export function countUnread(notifications: Pick<Notification, "readAt">[]): number {
  return notifications.filter(isUnread).length;
}
