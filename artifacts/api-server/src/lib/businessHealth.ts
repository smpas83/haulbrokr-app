import type { OperationsCenterPayload } from "./operationsInsights";

export interface BusinessHealthScores {
  revenue: number;
  fleet: number;
  customer: number;
  vendor: number;
  compliance: number;
  dispatch: number;
  driver: number;
  aiConfidence: number;
  overall: number;
  operational: number;
}

export function computeBusinessHealth(
  ops: OperationsCenterPayload,
  profileRole: string,
  pendingApprovals: number,
  executedToday: number,
): BusinessHealthScores {
  const isProvider = profileRole === "provider" || profileRole === "driver";

  const revenueBase = ops.todayRevenue > 0
    ? Math.min(100, 50 + Math.log10(ops.todayRevenue + 1) * 15)
    : ops.analytics.revenueForecast7d > 0 ? 45 : 30;
  const revenue = Math.round(revenueBase);

  const fleet = ops.digitalTwinHealth.fleetHealth.score;

  const customer = isProvider
    ? Math.min(100, 60 + ops.upcomingDeliveries.length * 5)
    : Math.min(100, ops.analytics.customerLifetimeValue > 0 ? 70 : 55);

  const vendor = ops.analytics.vendorScore ?? (isProvider ? fleet : 70);

  const compliance = ops.digitalTwinHealth.compliance.status === "good"
    ? 95
    : Math.max(20, 100 - ops.complianceWarnings.length * 25);

  const dispatch = Math.min(100, ops.analytics.fleetUtilization + (ops.lateJobs.length === 0 ? 15 : -ops.lateJobs.length * 10));

  const driver = ops.digitalTwinHealth.driverHealth.score;

  const aiConfidence = ops.insights.length > 0
    ? Math.round(ops.insights.reduce((s, i) => s + i.confidence, 0) / ops.insights.length)
    : 85;

  const overall = Math.round(
    revenue * 0.2 +
    fleet * 0.15 +
    customer * 0.1 +
    vendor * 0.1 +
    compliance * 0.15 +
    dispatch * 0.15 +
    driver * 0.1 +
    aiConfidence * 0.05,
  );

  const operational = Math.round(
    dispatch * 0.3 +
    fleet * 0.25 +
    (100 - Math.min(100, pendingApprovals * 8)) * 0.2 +
    (ops.criticalAlerts.length === 0 ? 100 : Math.max(30, 100 - ops.criticalAlerts.length * 20)) * 0.15 +
    Math.min(100, executedToday * 10) * 0.1,
  );

  return {
    revenue,
    fleet,
    customer,
    vendor,
    compliance,
    dispatch,
    driver,
    aiConfidence,
    overall: Math.max(0, Math.min(100, overall)),
    operational: Math.max(0, Math.min(100, operational)),
  };
}
