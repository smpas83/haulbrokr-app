import { logger } from "./logger";
import {
  processDueRecurringHauls,
  processRecurringReminders,
} from "./recurringHauls";

const DEFAULT_INTERVAL_MS = 60 * 1000;

let timer: NodeJS.Timeout | null = null;
let running = false;

async function runSweep() {
  if (running) return;
  running = true;
  try {
    const due = await processDueRecurringHauls();
    const reminders = await processRecurringReminders();
    if (due.created > 0 || reminders.reminded > 0) {
      logger.info({ due, reminders }, "Recurring haul sweep complete");
    }
  } catch (err) {
    logger.error({ err }, "Recurring haul sweep failed");
  } finally {
    running = false;
  }
}

export function startRecurringHaulScheduler(intervalMs = DEFAULT_INTERVAL_MS) {
  if (timer) return;
  setTimeout(() => {
    void runSweep();
  }, 30 * 1000).unref?.();
  timer = setInterval(() => {
    void runSweep();
  }, intervalMs);
  if (typeof timer.unref === "function") timer.unref();
  logger.info({ intervalMs }, "Recurring haul scheduler started");
}

export function stopRecurringHaulScheduler() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
