import { logger } from "./logger";

const DEFAULT_INTERVAL_MS = 5 * 60 * 1000;

let timer: NodeJS.Timeout | null = null;

/**
 * Autonomous engine background tick placeholder.
 * Primary engine runs on-demand via /operations/center and /autonomous/status.
 * This scheduler logs heartbeat for operational monitoring.
 */
export function startAutonomousScheduler(intervalMs = DEFAULT_INTERVAL_MS) {
  if (timer) return;
  timer = setInterval(() => {
    logger.debug("Autonomous engine heartbeat — predictions sync on next API request");
  }, intervalMs);
  if (typeof timer.unref === "function") timer.unref();
  logger.info({ intervalMs }, "Autonomous operations scheduler started");
}

export function stopAutonomousScheduler() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
