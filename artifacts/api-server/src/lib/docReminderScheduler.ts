import { logger } from "./logger";
import { sweepDocumentReminders } from "./docReminders";

// Run roughly once a day. The 20h "recently reminded" guard in the sweep keeps
// cadence to about one email per day per incomplete account even if the process
// restarts and the timer fires sooner.
const DEFAULT_INTERVAL_MS = 6 * 60 * 60 * 1000;

let timer: NodeJS.Timeout | null = null;
let running = false;

async function runSweep() {
  if (running) return;
  running = true;
  try {
    await sweepDocumentReminders();
  } catch (err) {
    logger.error({ err }, "Document reminder sweep failed");
  } finally {
    running = false;
  }
}

/**
 * Start the background sweep that emails users with missing required documents.
 * Safe to call once at server startup; subsequent calls are no-ops while a
 * timer is active.
 */
export function startDocReminderScheduler(intervalMs = DEFAULT_INTERVAL_MS) {
  if (timer) return;
  // Kick off a sweep shortly after boot, then on the interval.
  setTimeout(() => {
    void runSweep();
  }, 60 * 1000).unref?.();
  timer = setInterval(() => {
    void runSweep();
  }, intervalMs);
  if (typeof timer.unref === "function") timer.unref();
  logger.info({ intervalMs }, "Document reminder scheduler started");
}

export function stopDocReminderScheduler() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
