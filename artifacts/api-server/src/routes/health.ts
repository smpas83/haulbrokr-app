import { Router, type IRouter, type RequestHandler } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { pool } from "@workspace/db";
import { getFmcsaReadiness } from "../lib/fmcsa";

const router: IRouter = Router();

const sendHealth: RequestHandler = (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
};

router.get("/", sendHealth);
router.get("/healthz", sendHealth);
router.get("/readyz", async (_req, res): Promise<void> => {
  try {
    await pool.query("select 1");
    if (process.env.NODE_ENV === "production") {
      await pool.query("select 1 from payment_refunds limit 1");
      await pool.query("select 1 from device_tokens limit 1");
    }
    const data = HealthCheckResponse.parse({ status: "ok" });
    res.json(data);
  } catch {
    res.status(503).json({ status: "unavailable" });
  }
});

/**
 * Non-blocking readiness detail for operators. FMCSA issues never fail the process.
 * GET /api/readyz/details
 */
router.get("/readyz/details", async (_req, res): Promise<void> => {
  let dbOk = false;
  try {
    await pool.query("select 1");
    dbOk = true;
  } catch {
    dbOk = false;
  }

  let fmcsa;
  try {
    fmcsa = await getFmcsaReadiness();
  } catch {
    fmcsa = {
      provider: "manual_review",
      health: "configured_unavailable" as const,
      liveConfigured: Boolean(process.env.FMCSA_WEB_KEY?.trim()),
      manualFallbackAvailable: true,
    };
  }

  res.status(dbOk ? 200 : 503).json({
    status: dbOk ? "ok" : "unavailable",
    database: dbOk ? "ok" : "unavailable",
    fmcsa,
    note: "FMCSA health is informational and does not block application startup.",
  });
});

export default router;
