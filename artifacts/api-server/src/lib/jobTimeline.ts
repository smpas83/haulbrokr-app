import {
  db,
  jobStatusUpdatesTable,
  type InsertJobStatusUpdate,
} from "@workspace/db";

type TimelineStatus = InsertJobStatusUpdate["status"];

export async function recordJobTimelineEvent(
  jobId: number,
  actorProfileId: number,
  status: TimelineStatus,
  opts?: { ticketId?: number | null; note?: string | null },
): Promise<void> {
  await db.insert(jobStatusUpdatesTable).values({
    jobId,
    actorProfileId,
    status,
    ticketId: opts?.ticketId ?? null,
    note: opts?.note ?? null,
  });
}
