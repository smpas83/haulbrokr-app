import {
  db,
  paymentAuditLogsTable,
  stripeWebhookEventsTable,
  type InsertPaymentAuditLog,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import type Stripe from "stripe";

export async function recordPaymentAudit(values: InsertPaymentAuditLog): Promise<void> {
  await db.insert(paymentAuditLogsTable).values(values);
}

export function safeMetadataJson(metadata: unknown): string | null {
  if (metadata == null) return null;
  try {
    return JSON.stringify(metadata);
  } catch {
    return null;
  }
}

export async function beginWebhookEvent(event: Stripe.Event): Promise<"new" | "duplicate"> {
  const [existing] = await db
    .select()
    .from(stripeWebhookEventsTable)
    .where(eq(stripeWebhookEventsTable.eventId, event.id));

  if (existing) return "duplicate";

  const object = event.data.object as { id?: string } | undefined;
  await db.insert(stripeWebhookEventsTable).values({
    eventId: event.id,
    eventType: event.type,
    objectId: object?.id ?? null,
    status: "processing",
  });

  return "new";
}

export async function finishWebhookEvent(
  eventId: string,
  status: "succeeded" | "ignored" | "failed",
  action: string,
  error?: string,
): Promise<void> {
  await db
    .update(stripeWebhookEventsTable)
    .set({
      status,
      action,
      error: error ?? null,
      processedAt: new Date(),
    })
    .where(eq(stripeWebhookEventsTable.eventId, eventId));
}
