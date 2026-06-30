import { eq, inArray } from "drizzle-orm";
import { db, notificationEventsTable, profilesTable, type InsertNotificationEvent, type NotificationEvent } from "@workspace/db";
import { getUncachableResendClient } from "./resendClient";

export type NotificationChannel = InsertNotificationEvent["channel"];

export async function enqueueNotification(input: {
  profileId?: number | null;
  channels: NotificationChannel[];
  eventType: string;
  title: string;
  body: string;
  destination?: string | null;
  metadata?: unknown;
}): Promise<NotificationEvent[]> {
  const values = input.channels.map((channel) => ({
    profileId: input.profileId ?? null,
    channel,
    eventType: input.eventType,
    title: input.title,
    body: input.body,
    destination: input.destination ?? null,
    metadataJson: input.metadata == null ? null : JSON.stringify(input.metadata),
    status: "pending" as const,
  }));
  return db.insert(notificationEventsTable).values(values).returning();
}

async function destinationFor(event: NotificationEvent): Promise<string | null> {
  if (event.destination) return event.destination;
  if (!event.profileId) return null;
  const [profile] = await db.select().from(profilesTable).where(eq(profilesTable.id, event.profileId));
  if (!profile) return null;
  if (event.channel === "email") return profile.email ?? null;
  if (event.channel === "sms") return profile.phone ?? null;
  return null;
}

export async function deliverNotification(event: NotificationEvent): Promise<NotificationEvent> {
  if (event.status !== "pending") return event;
  const destination = await destinationFor(event);

  if (event.channel === "email") {
    if (!destination) {
      return markNotification(event.id, "skipped", "No email destination.");
    }
    try {
      const { client, fromEmail } = await getUncachableResendClient();
      const result = await client.emails.send({
        from: fromEmail,
        to: destination,
        subject: event.title,
        text: event.body,
      });
      const providerMessageId = "data" in result && result.data?.id ? result.data.id : null;
      return markNotification(event.id, "sent", null, providerMessageId, destination);
    } catch (err: any) {
      return markNotification(event.id, "failed", err?.message ?? "Email delivery failed.", null, destination);
    }
  }

  // SMS, push, and realtime providers plug in here. Until configured, events stay
  // durable and visible to workers/admins rather than being dropped.
  return markNotification(event.id, "skipped", `${event.channel} provider is not configured yet.`, null, destination);
}

async function markNotification(
  id: number,
  status: "sent" | "failed" | "skipped",
  error: string | null,
  providerMessageId: string | null = null,
  destination: string | null = null,
): Promise<NotificationEvent> {
  const [updated] = await db.update(notificationEventsTable).set({
    status,
    error,
    providerMessageId,
    destination,
    sentAt: status === "sent" ? new Date() : null,
  }).where(eq(notificationEventsTable.id, id)).returning();
  return updated;
}

export async function deliverPendingNotifications(limit = 50): Promise<NotificationEvent[]> {
  const pending = await db.select().from(notificationEventsTable).where(eq(notificationEventsTable.status, "pending"));
  const selected = pending.slice(0, Math.max(1, Math.min(limit, 250)));
  const results: NotificationEvent[] = [];
  for (const event of selected) {
    results.push(await deliverNotification(event));
  }
  return results;
}

export async function notificationFeed(profileId: number): Promise<NotificationEvent[]> {
  return db.select().from(notificationEventsTable).where(eq(notificationEventsTable.profileId, profileId));
}

export async function notificationsByStatus(statuses: Array<NotificationEvent["status"]>): Promise<NotificationEvent[]> {
  return db.select().from(notificationEventsTable).where(inArray(notificationEventsTable.status, statuses));
}
