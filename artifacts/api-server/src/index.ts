import "./load-env.js";
import { validateProductionEnv } from "./lib/validateProductionEnv";
import app from "./app";
import { logger } from "./lib/logger";
import { startPayoutRetryScheduler } from "./lib/payoutRetryScheduler";
import { startOrphanUploadCleaner } from "./lib/orphanUploadCleaner";
import { startDocReminderScheduler } from "./lib/docReminderScheduler";
import { startAccountDeletionScheduler } from "./lib/accountDeletionScheduler";
import { runStartupMigrations } from "./lib/startupMigrations";

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

async function boot(): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    await runStartupMigrations();
  }

  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }

    logger.info({ port }, "Server listening");
    startPayoutRetryScheduler();
    startOrphanUploadCleaner();
    startDocReminderScheduler();
    startAccountDeletionScheduler();
  });
}

boot().catch((err) => {
  logger.error({ err }, "Failed to start API");
  process.exit(1);
});
