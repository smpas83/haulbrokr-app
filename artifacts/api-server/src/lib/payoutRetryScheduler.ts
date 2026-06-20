import { logger } from "./logger";
import { sweepStuckPayouts } from "./payoutRetry";

const DEFAULT_INTERVAL_MS = 5 * 60 * 1000;

let timer: NodeJS.Timeout | null = null;
let running = false;

async function runSweep() {
  if (running) return;
  running = true;
  try {
    await sweepStuckPayouts();
  } catch (err) {
    logger.error({ err }, "Stuck-payout sweep failed");
  } finally {
    running = false;
  }
}

/**
 * Start the background sweep that retries stuck provider payouts. Safe to call
 * once at server startup; subsequent calls are no-ops while a timer is active.
 */
export function startPayoutRetryScheduler(intervalMs = DEFAULT_INTERVAL_MS) {
  if (timer) return;
  timer = setInterval(() => {
    void runSweep();
  }, intervalMs);
  if (typeof timer.unref === "function") timer.unref();
  logger.info({ intervalMs }, "Payout retry scheduler started");
}

export function stopPayoutRetryScheduler() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
