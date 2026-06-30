import { db, notificationsTable } from "@workspace/db";
import type { Notification, NotificationType } from "@workspace/db";

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

/** Fire-and-forget wrapper: never throws, logs nothing (caller may log). */
export async function safeNotify(
  input: CreateNotificationInput,
): Promise<void> {
  try {
    await createNotification(input);
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
