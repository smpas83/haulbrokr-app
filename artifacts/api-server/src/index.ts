import "./load-env.js";
import { validateProductionEnv } from "./lib/validateProductionEnv";
import app from "./app";
import { logger } from "./lib/logger";
import {
  startPayoutRetryScheduler,
  stopPayoutRetryScheduler,
} from "./lib/payoutRetryScheduler";
import {
  startOrphanUploadCleaner,
  stopOrphanUploadCleaner,
} from "./lib/orphanUploadCleaner";
import {
  startDocReminderScheduler,
  stopDocReminderScheduler,
} from "./lib/docReminderScheduler";

validateProductionEnv();

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const shutdownTimeoutMs = 10_000;

const server = app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  startPayoutRetryScheduler();
  startOrphanUploadCleaner();
  startDocReminderScheduler();
});

let shuttingDown = false;

function shutdown(signal: NodeJS.Signals): void {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, "Shutdown signal received");

  stopPayoutRetryScheduler();
  stopOrphanUploadCleaner();
  stopDocReminderScheduler();

  const timeout = setTimeout(() => {
    logger.error({ signal, timeoutMs: shutdownTimeoutMs }, "Forced shutdown after timeout");
    process.exit(1);
  }, shutdownTimeoutMs);
  timeout.unref?.();

  server.close((err) => {
    clearTimeout(timeout);
    if (err) {
      logger.error({ err, signal }, "Error during HTTP server shutdown");
      process.exit(1);
    }
    logger.info({ signal }, "HTTP server closed");
    process.exit(0);
  });
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
