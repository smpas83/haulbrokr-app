import { Router, type IRouter } from "express";
import { bootstrapHaulBrokrWorkspace } from "@workspace/haulbrokr-app";
import { IntelligenceRouter } from "@workspace/platform";
import { getRequestProfile, requireProfile } from "../middlewares/requireAuth";

bootstrapHaulBrokrWorkspace();

const router: IRouter = Router();

router.get(
  "/copilot/insights",
  requireProfile,
  async (req, res): Promise<void> => {
    const profile = getRequestProfile(req);
    const insights = await IntelligenceRouter.getInsights(profile);
    res.json(insights);
  },
);

router.post(
  "/copilot/chat",
  requireProfile,
  async (req, res): Promise<void> => {
    const profile = getRequestProfile(req);
    const message = String(req.body?.message ?? "").trim();
    if (!message) {
      res.status(400).json({ error: "message is required" });
      return;
    }

    try {
      const reply = await IntelligenceRouter.chat(message, profile);
      res.json(reply);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Invalid request";
      res.status(400).json({ error: msg });
    }
  },
);

export default router;
