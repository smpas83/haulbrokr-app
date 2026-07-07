import { Router, type IRouter, type RequestHandler } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { pool } from "@workspace/db";

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
    }
    const data = HealthCheckResponse.parse({ status: "ok" });
    res.json(data);
  } catch {
    res.status(503).json({ status: "unavailable" });
  }
});

export default router;
