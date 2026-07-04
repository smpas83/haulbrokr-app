import { eq } from "drizzle-orm";
import { db, driverDocumentsTable } from "@workspace/db";
import { logger } from "./logger";
import { listPrivateUploadObjects } from "./objectStorage";

const TOKEN_TTL_SEC = 900;
const ORPHAN_AGE_SEC = TOKEN_TTL_SEC * 2;

async function purgeExpiredUploads(): Promise<void> {
  const privateObjectDir = process.env.PRIVATE_OBJECT_DIR;
  if (!privateObjectDir) {
    logger.warn("PRIVATE_OBJECT_DIR not set; skipping orphan upload cleanup");
    return;
  }

  const entityDirPrefix = privateObjectDir
    .replace(/^\//, "")
    .replace(/\/$/, "");
  const uploadsPrefix = `${entityDirPrefix}/uploads/`;

  const files = await listPrivateUploadObjects(uploadsPrefix);

  const cutoff = new Date(Date.now() - ORPHAN_AGE_SEC * 1000);
  let deleted = 0;
  let errors = 0;

  for (const file of files) {
    const created = file.metadata?.timeCreated;
    if (!created || new Date(created) >= cutoff) continue;

    const entityId = file.name.startsWith(`${entityDirPrefix}/`)
      ? file.name.slice(entityDirPrefix.length + 1)
      : null;
    if (!entityId) continue;
    const objectPath = `/objects/${entityId}`;

    const [referenced] = await db
      .select({ id: driverDocumentsTable.id })
      .from(driverDocumentsTable)
      .where(eq(driverDocumentsTable.objectPath, objectPath));
    if (referenced) continue;

    try {
      await file.delete();
      deleted++;
    } catch (err) {
      errors++;
      logger.warn({ err, name: file.name }, "Failed to delete orphaned upload");
    }
  }

  if (deleted > 0 || errors > 0) {
    logger.info(
      { deleted, errors, prefix: uploadsPrefix },
      "Orphan upload cleanup complete",
    );
  }
}

const DEFAULT_INTERVAL_MS = 10 * 60 * 1000;

let timer: NodeJS.Timeout | null = null;
let running = false;

async function runCleanup() {
  if (running) return;
  running = true;
  try {
    await purgeExpiredUploads();
  } catch (err) {
    logger.error({ err }, "Orphan upload cleanup failed");
  } finally {
    running = false;
  }
}

export function startOrphanUploadCleaner(intervalMs = DEFAULT_INTERVAL_MS) {
  if (timer) return;
  timer = setInterval(() => {
    void runCleanup();
  }, intervalMs);
  if (typeof timer.unref === "function") timer.unref();
  logger.info({ intervalMs }, "Orphan upload cleaner started");
}

export function stopOrphanUploadCleaner() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
