import { describe, it, expect } from "vitest";
import { computeBusinessHealth } from "./businessHealth";
import type { OperationsCenterPayload } from "./operationsInsights";

const baseOps = (): OperationsCenterPayload => ({
  morningBrief: "Hi",
  todayRevenue: 2000,
  todayJobs: 3,
  fleetStatus: { total: 5, available: 2, onJob: 3, offline: 0 },
  driverAvailability: { assigned: 3, unassigned: 1 },
  weather: null,
  traffic: null,
  criticalAlerts: [],
  lateJobs: [],
  highMarginOpportunities: [],
  insights: [{ id: "1", category: "Fleet", title: "T", description: "D", severity: "medium", confidence: 90, businessImpact: "B", recommendedAction: "A", actions: [] }],
  recentActivity: [],
  upcomingDeliveries: [],
  complianceWarnings: [],
  fuelAlerts: [],
  liveStream: [],
  dispatchSuggestions: [],
  analytics: {
    revenueForecast7d: 10000,
    marginForecast7d: 8500,
    fleetUtilization: 75,
    customerLifetimeValue: 50000,
    vendorScore: 85,
    driverScore: 80,
    regionalDemand: [],
    weeklyEvents: [],
  },
  digitalTwinHealth: {
    fleetHealth: { score: 90, label: "OK", issues: [] },
    driverHealth: { score: 85, label: "OK", issues: [] },
    equipmentHealth: { score: 95, label: "OK", issues: [] },
    maintenance: { overdue: 0, upcoming: 0 },
    compliance: { status: "good", issues: [] },
    insurance: { status: "verified", expiringWithin30Days: false },
    fuel: { alertCount: 0 },
    utilization: 75,
  },
  updatedAt: new Date().toISOString(),
});

describe("Business Health", () => {
  it("computes scores within 0-100", () => {
    const scores = computeBusinessHealth(baseOps(), "provider", 2, 1);
    expect(scores.overall).toBeGreaterThan(0);
    expect(scores.overall).toBeLessThanOrEqual(100);
    expect(scores.operational).toBeLessThanOrEqual(100);
    expect(scores.aiConfidence).toBe(90);
  });

  it("lowers dispatch score with late jobs", () => {
    const ops = baseOps();
    ops.lateJobs = [{ id: 1, materialType: "gravel", scheduledDate: new Date().toISOString(), status: "active", pickupAddress: "123 Main" }];
    const withLate = computeBusinessHealth(ops, "provider", 0, 0);
    const without = computeBusinessHealth(baseOps(), "provider", 0, 0);
    expect(withLate.dispatch).toBeLessThan(without.dispatch);
  });
});
