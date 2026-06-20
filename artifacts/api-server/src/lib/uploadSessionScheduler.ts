import { logger } from "./logger";
import { sweepOrphanedUploads } from "./uploadSessionCleanup";

const DEFAULT_INTERVAL_MS = 20 * 60 * 1000; // every 20 minutes

let timer: NodeJS.Timeout | null = null;
let running = false;

async function runSweep() {
  if (running) return;
  running = true;
  try {
    await sweepOrphanedUploads();
  } catch (err) {
    logger.error({ err }, "Orphaned upload sweep failed");
  } finally {
    running = false;
  }
}

/**
 * Start the background sweep that deletes GCS objects for expired, never-consumed
 * upload sessions. Safe to call once at server startup; subsequent calls are
 * no-ops while a timer is active.
 */
export function startUploadSessionScheduler(intervalMs = DEFAULT_INTERVAL_MS) {
  if (timer) return;
  timer = setInterval(() => {
    void runSweep();
  }, intervalMs);
  if (typeof timer.unref === "function") timer.unref();
  logger.info({ intervalMs }, "Upload session cleanup scheduler started");
}

export function stopUploadSessionScheduler() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
