import { activityTable, db, notificationDeliveriesTable, profilesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { getUncachableResendClient } from "./resendClient";
import { logger } from "./logger";

export type NotificationEventType =
  | "job_assigned"
  | "driver_accepted"
  | "driver_arrived"
  | "load_complete"
  | "payment_complete"
  | "review_request"
  | "compliance_reminder";

export type NotificationChannel = "in_app" | "email" | "sms" | "push" | "realtime";

export type NotificationInput = {
  eventType: NotificationEventType;
  recipientProfileId: number;
  jobId?: number | null;
  subject?: string | null;
  body: string;
  channels?: NotificationChannel[];
};

function activityTypeForEvent(eventType: NotificationEventType): typeof activityTable.$inferInsert.type {
  switch (eventType) {
    case "job_assigned":
      return "bid_awarded";
    case "driver_accepted":
      return "job_accepted";
    case "driver_arrived":
      return "job_started";
    case "load_complete":
      return "job_completed";
    case "payment_complete":
      return "payment_requires_action";
    case "review_request":
      return "job_completed";
    case "compliance_reminder":
      return "application_rejected";
  }
}

async function recordDelivery(input: NotificationInput, channel: NotificationChannel, status: "pending" | "sent" | "skipped" | "failed", extra: { providerMessageId?: string | null; error?: string | null } = {}) {
  try {
    await db.insert(notificationDeliveriesTable).values({
      eventType: input.eventType,
      channel,
      status,
      recipientProfileId: input.recipientProfileId,
      jobId: input.jobId ?? null,
      subject: input.subject ?? null,
      body: input.body,
      providerMessageId: extra.providerMessageId ?? null,
      error: extra.error ?? null,
    });
  } catch (err) {
    logger.error({ err, eventType: input.eventType, channel }, "Failed to record notification delivery");
  }
}

async function sendEmail(input: NotificationInput): Promise<void> {
  try {
    const [profile] = await db
      .select({ email: profilesTable.email })
      .from(profilesTable)
      .where(eq(profilesTable.id, input.recipientProfileId));
    if (!profile?.email) {
      await recordDelivery(input, "email", "skipped", { error: "Recipient has no email address." });
      return;
    }
    const { client, fromEmail } = await getUncachableResendClient();
    const result = await client.emails.send({
      from: fromEmail,
      to: profile.email,
      subject: input.subject ?? "HaulBrokr notification",
      text: input.body,
    });
    if (result.error) {
      await recordDelivery(input, "email", "failed", { error: String(result.error.message ?? result.error) });
      return;
    }
    await recordDelivery(input, "email", "sent", { providerMessageId: result.data?.id ?? null });
  } catch (err) {
    logger.error({ err, eventType: input.eventType, recipientProfileId: input.recipientProfileId }, "Email notification failed");
    await recordDelivery(input, "email", "failed", { error: err instanceof Error ? err.message : String(err) });
  }
}

export async function sendNotification(input: NotificationInput): Promise<void> {
  const channels = input.channels ?? ["in_app"];
  for (const channel of channels) {
    try {
      if (channel === "in_app") {
        await db.insert(activityTable).values({
          profileId: input.recipientProfileId,
          type: activityTypeForEvent(input.eventType),
          description: input.body,
          relatedId: input.jobId ?? null,
        });
        await recordDelivery(input, "in_app", "sent");
      } else if (channel === "email") {
        await sendEmail(input);
      } else {
        await recordDelivery(input, channel, "skipped", { error: `${channel} provider is not configured.` });
      }
    } catch (err) {
      logger.error({ err, eventType: input.eventType, channel }, "Notification channel failed");
    }
  }
}
