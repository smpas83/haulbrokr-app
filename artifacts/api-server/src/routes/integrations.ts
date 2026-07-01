import { Router, type IRouter } from "express";
import { attachClerkProfileIfPresent } from "../middlewares/requireAuth";
import { requireAdmin } from "../middlewares/requireAdmin";
import { attachStaffSession } from "../middlewares/staffAuth";
import { collectIntegrationStatus } from "../lib/integrationStatus";

const router: IRouter = Router();

router.use(attachStaffSession);
router.use(attachClerkProfileIfPresent);

router.get("/integrations/status", requireAdmin, (_req, res): void => {
  res.json(collectIntegrationStatus());
});

export default router;
