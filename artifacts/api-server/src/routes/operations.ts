import { Router, type IRouter } from "express";
import { getRequestProfile, requireProfile } from "../middlewares/requireAuth";
import { buildOperationsCenter, searchOperations } from "../lib/operationsInsights";
import { buildAutonomousLayer } from "../lib/autonomousStatus";

const router: IRouter = Router();

router.get("/operations/center", requireProfile, async (req, res): Promise<void> => {
  const profile = getRequestProfile(req);
  const ctx = {
    id: profile.id,
    role: profile.role,
    companyName: profile.companyName,
    state: profile.state ?? null,
  };
  const [operations, autonomous] = await Promise.all([
    buildOperationsCenter(ctx),
    buildAutonomousLayer(ctx),
  ]);
  res.json({ ...operations, autonomous });
});

router.get("/operations/search", requireProfile, async (req, res): Promise<void> => {
  const profile = getRequestProfile(req);
  const q = String(req.query.q ?? "");
  const data = await searchOperations(
    { id: profile.id, role: profile.role, companyName: profile.companyName, state: profile.state ?? null },
    q,
  );
  res.json(data);
});

export default router;
