import { buildOperationsCenter, type ProfileCtx } from "./operationsInsights";
import { syncRecommendations, listRecommendations, countExecutedToday } from "./autonomousEngine";
import { computeBusinessHealth } from "./businessHealth";
import { generateExecutiveDigest, getRecentAutonomousActivity } from "./executiveDigest";
import { listMemory } from "./autonomousMemory";

export interface AutonomousLayerPayload {
  businessHealth: ReturnType<typeof computeBusinessHealth>;
  pendingApprovals: Awaited<ReturnType<typeof listRecommendations>>;
  interruptQueue: Awaited<ReturnType<typeof listRecommendations>>;
  autonomousActivity: Awaited<ReturnType<typeof getRecentAutonomousActivity>>;
  executiveDigest: Awaited<ReturnType<typeof generateExecutiveDigest>>;
  memorySummary: {
    patterns: number;
    approvals: number;
    dismissals: number;
  };
  engineStatus: {
    lastRunAt: string;
    recommendationsGenerated: number;
    executedToday: number;
  };
}

export async function buildAutonomousLayer(profile: ProfileCtx): Promise<AutonomousLayerPayload> {
  const ops = await buildOperationsCenter(profile);

  await syncRecommendations(profile, ops);

  const pendingApprovals = await listRecommendations(profile.id, ["pending"]);
  const interruptQueue = pendingApprovals.filter((r) => r.priority === "critical" || r.priority === "high");
  const executedToday = await countExecutedToday(profile.id);

  const businessHealth = computeBusinessHealth(ops, profile.role, pendingApprovals.length, executedToday);

  const hour = new Date().getHours();
  const digestPeriod = hour < 12 ? "morning" as const : hour >= 17 ? "evening" as const : "morning" as const;

  const [executiveDigest, autonomousActivity, patterns, approvals, dismissals] = await Promise.all([
    generateExecutiveDigest(profile.id, profile.companyName, digestPeriod, ops, businessHealth, pendingApprovals.length),
    getRecentAutonomousActivity(profile.id, 20),
    listMemory(profile.id, "pattern", 20),
    listMemory(profile.id, "approval", 20),
    listMemory(profile.id, "dismissal", 20),
  ]);

  return {
    businessHealth,
    pendingApprovals,
    interruptQueue,
    autonomousActivity,
    executiveDigest,
    memorySummary: {
      patterns: patterns.length,
      approvals: approvals.length,
      dismissals: dismissals.length,
    },
    engineStatus: {
      lastRunAt: new Date().toISOString(),
      recommendationsGenerated: pendingApprovals.length + interruptQueue.length,
      executedToday,
    },
  };
}
