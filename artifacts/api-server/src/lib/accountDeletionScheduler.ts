import { logger } from "./logger";
import { sweepAccountDeletionJobs } from "./deleteAccount";

const DEFAULT_INTERVAL_MS = 2 * 60 * 1000;

let timer: NodeJS.Timeout | null = null;
let running = false;

async function runSweep() {
  if (running) return;
  running = true;
  try {
    const result = await sweepAccountDeletionJobs();
    if (result.processed > 0 || result.errors > 0) {
      logger.info(result, "Account deletion sweep finished");
    }
  } catch (err) {
    logger.error({ err }, "Account deletion sweep failed");
  } finally {
    running = false;
  }
}

/** Background retries for Apple token revoke + incomplete account deletion jobs. */
export function startAccountDeletionScheduler(intervalMs = DEFAULT_INTERVAL_MS) {
  if (timer) return;
  timer = setInterval(() => {
    void runSweep();
  }, intervalMs);
  if (typeof timer.unref === "function") timer.unref();
  logger.info({ intervalMs }, "Account deletion scheduler started");
}

export function stopAccountDeletionScheduler() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
