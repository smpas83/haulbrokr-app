import { logger } from "./logger";
import { sweepExpiredComplianceDocuments } from "./complianceExpiration";

const DEFAULT_INTERVAL_MS = 6 * 60 * 60 * 1000;

let timer: NodeJS.Timeout | null = null;
let running = false;

async function runSweep() {
  if (running) return;
  running = true;
  try {
    await sweepExpiredComplianceDocuments();
  } catch (err) {
    logger.error({ err }, "Compliance expiration sweep failed");
  } finally {
    running = false;
  }
}

export function startComplianceExpirationScheduler(
  intervalMs = DEFAULT_INTERVAL_MS,
) {
  if (timer) return;
  setTimeout(() => {
    void runSweep();
  }, 60 * 1000).unref?.();
  timer = setInterval(() => {
    void runSweep();
  }, intervalMs);
  if (typeof timer.unref === "function") timer.unref();
  logger.info({ intervalMs }, "Compliance expiration scheduler started");
}

export function stopComplianceExpirationScheduler() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
