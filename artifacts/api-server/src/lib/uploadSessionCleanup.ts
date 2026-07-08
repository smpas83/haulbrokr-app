import { and, eq, isNull, lt } from "drizzle-orm";
import { db, uploadSessionsTable } from "@workspace/db";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { logger } from "./logger";

const objectStorageService = new ObjectStorageService();

/**
 * Sweep expired, never-consumed upload sessions and delete the corresponding
 * GCS objects so they do not persist as orphaned storage.
 *
 * Safe to call repeatedly; each run is idempotent — it only acts on sessions
 * that are past their expiry and have never been consumed.
 */
export async function sweepOrphanedUploads(): Promise<void> {
  const now = new Date();

  const expired = await db
    .select({
      id: uploadSessionsTable.id,
      objectPath: uploadSessionsTable.objectPath,
    })
    .from(uploadSessionsTable)
    .where(
      and(
        isNull(uploadSessionsTable.usedAt),
        lt(uploadSessionsTable.expiresAt, now),
      ),
    );

  if (expired.length === 0) return;

  logger.info({ count: expired.length }, "Sweeping orphaned upload sessions");

  for (const session of expired) {
    try {
      const objectFile = await objectStorageService.getObjectEntityFile(
        session.objectPath,
      );
      await objectFile.delete();
      logger.debug(
        { objectPath: session.objectPath },
        "Deleted orphaned upload object",
      );
    } catch (err) {
      if (err instanceof ObjectNotFoundError) {
        // Object was never uploaded or already cleaned up — that's fine.
      } else {
        logger.warn(
          { err, objectPath: session.objectPath },
          "Failed to delete orphaned upload object",
        );
      }
    }

    try {
      // Re-check usedAt so we never delete a session that was consumed
      // by a concurrent request between our SELECT and DELETE.
      await db
        .delete(uploadSessionsTable)
        .where(
          and(
            eq(uploadSessionsTable.id, session.id),
            isNull(uploadSessionsTable.usedAt),
          ),
        );
    } catch (err) {
      logger.warn(
        { err, sessionId: session.id },
        "Failed to delete orphaned upload session row",
      );
    }
  }
}
