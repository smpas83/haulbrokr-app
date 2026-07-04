import type { OperationsCenterPayload } from "./operationsInsights";
import type { BusinessHealthScores } from "./businessHealth";
import { countTimelineSince, listTimeline } from "./autonomousMemory";

export type DigestPeriod = "morning" | "evening" | "weekly" | "monthly";

export interface ExecutiveDigest {
  period: DigestPeriod;
  title: string;
  generatedAt: string;
  summary: string;
  highlights: string[];
  metrics: {
    todayRevenue: number;
    todayJobs: number;
    pendingApprovals: number;
    criticalAlerts: number;
    overallHealth: number;
    operationalScore: number;
  };
  recommendations: string[];
  risks: string[];
  opportunities: string[];
}

export async function generateExecutiveDigest(
  profileId: number,
  profileName: string,
  period: DigestPeriod,
  ops: OperationsCenterPayload,
  health: BusinessHealthScores,
  pendingCount: number,
): Promise<ExecutiveDigest> {
  const now = new Date();
  const titles: Record<DigestPeriod, string> = {
    morning: "Morning Executive Brief",
    evening: "Evening Operations Summary",
    weekly: "Weekly Executive Report",
    monthly: "Monthly Executive Report",
  };

  const since = periodStart(period, now);
  const timelineCount = await countTimelineSince(profileId, since);

  const highlights: string[] = [];
  if (ops.todayRevenue > 0) highlights.push(`Today's revenue: $${ops.todayRevenue.toLocaleString()}`);
  if (ops.todayJobs > 0) highlights.push(`${ops.todayJobs} job(s) scheduled today`);
  if (pendingCount > 0) highlights.push(`${pendingCount} AI recommendation(s) awaiting approval`);
  if (ops.lateJobs.length > 0) highlights.push(`${ops.lateJobs.length} late job(s) need attention`);
  if (timelineCount > 0) highlights.push(`${timelineCount} autonomous events in this period`);

  const risks = [
    ...ops.criticalAlerts.map((a) => a.title),
    ...ops.complianceWarnings.map((w) => w.title),
    ...(ops.lateJobs.length > 0 ? [`${ops.lateJobs.length} deliveries running late`] : []),
  ].slice(0, 6);

  const opportunities = [
    ...ops.highMarginOpportunities.map((o) => `Load #${o.id}: $${o.budgetPerHour}/hr (${o.materialType})`),
    ...ops.insights.filter((i) => i.category === "Opportunity").map((i) => i.title),
  ].slice(0, 6);

  const recommendations = ops.insights.slice(0, 5).map((i) => i.recommendedAction);

  let summary: string;
  switch (period) {
    case "morning":
      summary = ops.morningBrief;
      break;
    case "evening":
      summary = `${profileName} — end of day: ${ops.todayJobs} jobs, $${ops.todayRevenue.toLocaleString()} revenue. Company health ${health.overall}/100, operational score ${health.operational}/100. ${pendingCount} pending AI approvals.`;
      break;
    case "weekly":
      summary = `Weekly report for ${profileName}: 7-day revenue forecast $${ops.analytics.revenueForecast7d.toLocaleString()}, fleet utilization ${ops.analytics.fleetUtilization}%. ${ops.insights.length} active AI insights. Overall health ${health.overall}/100.`;
      break;
    case "monthly":
      summary = `Monthly executive summary: CLV $${ops.analytics.customerLifetimeValue.toLocaleString()}, ${ops.analytics.regionalDemand.length} active regions. Compliance score ${health.compliance}/100. AI confidence ${health.aiConfidence}%.`;
      break;
  }

  return {
    period,
    title: titles[period],
    generatedAt: now.toISOString(),
    summary,
    highlights,
    metrics: {
      todayRevenue: ops.todayRevenue,
      todayJobs: ops.todayJobs,
      pendingApprovals: pendingCount,
      criticalAlerts: ops.criticalAlerts.length,
      overallHealth: health.overall,
      operationalScore: health.operational,
    },
    recommendations,
    risks,
    opportunities,
  };
}

function periodStart(period: DigestPeriod, now: Date): Date {
  const d = new Date(now);
  switch (period) {
    case "morning":
    case "evening":
      d.setHours(0, 0, 0, 0);
      return d;
    case "weekly":
      d.setDate(d.getDate() - 7);
      return d;
    case "monthly":
      d.setDate(d.getDate() - 30);
      return d;
  }
}

export async function getRecentAutonomousActivity(profileId: number, limit = 15) {
  return listTimeline(profileId, limit);
}
