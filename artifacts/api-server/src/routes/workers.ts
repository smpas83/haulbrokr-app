import { Router, type IRouter } from "express";
import { requireAutomationKey } from "../middlewares/requireAutomationKey";
import {
  retryFailedRecurringGenerations,
  runRecurringHaulWorker,
} from "../lib/recurringHauls";
import { expireOldExports } from "../lib/dataExport";
import { getFmcsaReadiness } from "../lib/fmcsa";
import { logger } from "../lib/logger";

const router: IRouter = Router();

/**
 * Authenticated worker endpoint for recurring haul materialization.
 * Secure with AUTOMATION_KEY (or CRON_SECRET aliased below).
 *
 * Compatible with Render cron / external schedulers:
 *   POST /api/workers/recurring-hauls
 *   Header: x-automation-key: $AUTOMATION_KEY
 */
router.post(
  "/workers/recurring-hauls",
  requireAutomationKey,
  async (req, res): Promise<void> => {
    try {
      const scheduleIds = Array.isArray(req.body?.scheduleIds)
        ? req.body.scheduleIds
            .map(Number)
            .filter((n: number) => Number.isFinite(n))
        : undefined;
      const summary = await runRecurringHaulWorker({ scheduleIds });
      const retried = await retryFailedRecurringGenerations();
      logger.info(
        {
          created: summary.created,
          failed: summary.failed,
          duplicates: summary.duplicates,
          retried,
        },
        "Recurring worker endpoint completed",
      );
      res.json({ ok: true, ...summary, retried, results: undefined });
    } catch (err) {
      logger.error({ err }, "Recurring worker endpoint failed");
      res.status(500).json({ error: "Recurring worker failed" });
    }
  },
);

router.post(
  "/workers/expire-exports",
  requireAutomationKey,
  async (_req, res): Promise<void> => {
    try {
      const expired = await expireOldExports();
      res.json({ ok: true, expired });
    } catch (err) {
      logger.error({ err }, "Export expiry worker failed");
      res.status(500).json({ error: "Export expiry failed" });
    }
  },
);

router.get(
  "/workers/fmcsa-status",
  requireAutomationKey,
  async (_req, res): Promise<void> => {
    const readiness = await getFmcsaReadiness();
    res.json(readiness);
  },
);

export default router;
