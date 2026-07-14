import { logger } from "./logger";
import { retryFailedRecurringGenerations, runRecurringHaulWorker } from "./recurringHauls";
import { expireOldExports } from "./dataExport";

const DEFAULT_INTERVAL_MS = 60 * 60 * 1000; // hourly

let timer: ReturnType<typeof setInterval> | null = null;

export function startRecurringHaulScheduler(intervalMs = DEFAULT_INTERVAL_MS): void {
  if (timer) return;
  if (process.env.DISABLE_RECURRING_SCHEDULER === "1") {
    logger.info("Recurring haul in-process scheduler disabled");
    return;
  }

  const tick = async () => {
    try {
      const summary = await runRecurringHaulWorker();
      await retryFailedRecurringGenerations();
      await expireOldExports();
      logger.info(
        {
          created: summary.created,
          failed: summary.failed,
          duplicates: summary.duplicates,
          schedulesProcessed: summary.schedulesProcessed,
        },
        "Recurring haul scheduler tick",
      );
    } catch (err) {
      logger.error({ err }, "Recurring haul scheduler tick failed");
    }
  };

  timer = setInterval(() => {
    void tick();
  }, intervalMs);
  // Stagger first run slightly after boot
  setTimeout(() => void tick(), 15_000);
  logger.info({ intervalMs }, "Recurring haul scheduler started");
}
