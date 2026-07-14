import { eq } from "drizzle-orm";
import { db, deviceTokensTable } from "@workspace/db";
import { logger } from "./logger";

type ExpoPushMessage = {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: "default" | null;
};

export async function sendExpoPushToProfile(
  profileId: number,
  title: string,
  body: string,
  data?: Record<string, unknown>,
): Promise<void> {
  try {
    const tokens = await db
      .select()
      .from(deviceTokensTable)
      .where(eq(deviceTokensTable.profileId, profileId));

    if (!tokens.length) return;

    const messages: ExpoPushMessage[] = tokens.map((t) => ({
      to: t.expoPushToken,
      title,
      body,
      data,
      sound: "default",
    }));

    const res = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(messages),
    });

    if (!res.ok) {
      const text = await res.text();
      logger.warn({ profileId, status: res.status, text }, "Expo push send failed");
    }
  } catch (err) {
    logger.error({ err, profileId }, "Failed to send Expo push notification");
  }
}

const ACTIVITY_TITLES: Record<string, string> = {
  payment_failed: "Payment failed",
  payment_requires_action: "Confirm your payment",
  payment_refunded: "Refund issued",
  invoice_paid: "Invoice paid",
  payout_paid: "Payout sent",
  payout_failed: "Payout failed",
  payout_delayed: "Payout delayed",
  payout_stuck_alert: "Payout needs attention",
  bid_awarded: "Bid awarded",
  bid_accepted: "Bid accepted",
  job_completed: "Job completed",
  job_started: "Job started",
  job_reminder: "Upcoming haul reminder",
  recurring_created: "Recurring haul posted",
  driver_event_rejected: "Driver update rejected",
  application_approved: "Application approved",
  application_rejected: "Application update",
};

export function activityPushTitle(type: string): string {
  return ACTIVITY_TITLES[type] ?? "HaulBrokr update";
}
