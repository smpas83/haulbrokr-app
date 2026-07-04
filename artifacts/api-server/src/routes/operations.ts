import { Router, type IRouter } from "express";
import { getRequestProfile, requireProfile } from "../middlewares/requireAuth";
import { buildOperationsCenter, searchOperations } from "../lib/operationsInsights";

const router: IRouter = Router();

router.get("/operations/center", requireProfile, async (req, res): Promise<void> => {
  const profile = getRequestProfile(req);
  const data = await buildOperationsCenter({
    id: profile.id,
    role: profile.role,
    companyName: profile.companyName,
    state: profile.state ?? null,
  });
  res.json(data);
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
