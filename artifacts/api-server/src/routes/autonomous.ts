import { Router, type IRouter } from "express";
import { getRequestProfile, requireProfile } from "../middlewares/requireAuth";
import { buildAutonomousLayer } from "../lib/autonomousStatus";
import { buildOperationsCenter } from "../lib/operationsInsights";
import { searchTimeline } from "../lib/autonomousMemory";
import { approveRecommendation, rejectRecommendation, executeApprovedRecommendation } from "../lib/autonomousExecution";
import { generateExecutiveDigest } from "../lib/executiveDigest";
import { computeBusinessHealth } from "../lib/businessHealth";
import { listRecommendations, countExecutedToday } from "../lib/autonomousEngine";

const router: IRouter = Router();

function profileCtx(req: Parameters<typeof getRequestProfile>[0]) {
  const p = getRequestProfile(req);
  return { id: p.id, role: p.role, companyName: p.companyName, state: p.state ?? null };
}

router.get("/autonomous/status", requireProfile, async (req, res): Promise<void> => {
  const data = await buildAutonomousLayer(profileCtx(req));
  res.json(data);
});

router.get("/autonomous/timeline", requireProfile, async (req, res): Promise<void> => {
  const profile = getRequestProfile(req);
  const q = String(req.query.q ?? "");
  const events = await searchTimeline(profile.id, q, 100);
  res.json({ events });
});

router.get("/autonomous/recommendations", requireProfile, async (req, res): Promise<void> => {
  const profile = getRequestProfile(req);
  const status = String(req.query.status ?? "pending");
  const statuses = status === "all"
    ? ["pending", "approved", "modified", "executed", "rejected", "dismissed"] as const
    : [status] as ("pending" | "approved" | "modified" | "executed" | "rejected" | "dismissed")[];
  const items = await listRecommendations(profile.id, [...statuses]);
  res.json({ recommendations: items });
});

router.post("/autonomous/recommendations/:id/approve", requireProfile, async (req, res): Promise<void> => {
  const profile = getRequestProfile(req);
  const id = parseInt(String(req.params.id), 10);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const modifiedPayload = req.body?.payload && typeof req.body.payload === "object" ? req.body.payload : undefined;
  const rec = await approveRecommendation(profile.id, id, profile.id, modifiedPayload);
  if (!rec) { res.status(404).json({ error: "Recommendation not found or not pending" }); return; }
  res.json(rec);
});

router.post("/autonomous/recommendations/:id/reject", requireProfile, async (req, res): Promise<void> => {
  const profile = getRequestProfile(req);
  const id = parseInt(String(req.params.id), 10);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const reason = typeof req.body?.reason === "string" ? req.body.reason : undefined;
  const rec = await rejectRecommendation(profile.id, id, reason);
  if (!rec) { res.status(404).json({ error: "Recommendation not found or not pending" }); return; }
  res.json(rec);
});

router.post("/autonomous/recommendations/:id/modify", requireProfile, async (req, res): Promise<void> => {
  const profile = getRequestProfile(req);
  const id = parseInt(String(req.params.id), 10);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const payload = req.body?.payload;
  if (!payload || typeof payload !== "object") {
    res.status(400).json({ error: "payload object is required" });
    return;
  }

  const rec = await approveRecommendation(profile.id, id, profile.id, payload as Record<string, unknown>);
  if (!rec) { res.status(404).json({ error: "Recommendation not found or not pending" }); return; }
  res.json(rec);
});

router.post("/autonomous/recommendations/:id/execute", requireProfile, async (req, res): Promise<void> => {
  const profile = getRequestProfile(req);
  const id = parseInt(String(req.params.id), 10);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const result = await executeApprovedRecommendation(profile, id);
  if (!result.success) {
    res.status(result.message.includes("not found") ? 404 : 400).json({ error: result.message });
    return;
  }
  res.json(result);
});

router.get("/autonomous/digest/:period", requireProfile, async (req, res): Promise<void> => {
  const profile = getRequestProfile(req);
  const period = String(req.params.period) as "morning" | "evening" | "weekly" | "monthly";
  if (!["morning", "evening", "weekly", "monthly"].includes(period)) {
    res.status(400).json({ error: "Invalid period" });
    return;
  }

  const ctx = profileCtx(req);
  const ops = await buildOperationsCenter(ctx);
  const pending = await listRecommendations(profile.id, ["pending"]);
  const executedToday = await countExecutedToday(profile.id);
  const health = computeBusinessHealth(ops, profile.role, pending.length, executedToday);
  const digest = await generateExecutiveDigest(profile.id, profile.companyName, period, ops, health, pending.length);
  res.json(digest);
});

export default router;
