import { describe, it, expect, beforeEach, vi } from "vitest";
import express, { type Express } from "express";
import request from "supertest";

const h = vi.hoisted(() => ({
  profile: { id: 1, role: "provider", companyName: "Haul Co", state: "CA" } as Record<string, unknown>,
}));

vi.mock("../middlewares/requireAuth", () => ({
  requireProfile: (_req: unknown, _res: unknown, next: () => void) => next(),
  getRequestProfile: () => h.profile,
}));

vi.mock("../lib/operationsInsights", () => ({
  buildOperationsCenter: vi.fn(async () => ({
    morningBrief: "Good morning, Haul Co.",
    todayRevenue: 1200,
    todayJobs: 2,
    fleetStatus: { total: 3, available: 1, onJob: 2, offline: 0 },
    driverAvailability: { assigned: 2, unassigned: 1 },
    weather: null,
    traffic: null,
    criticalAlerts: [],
    lateJobs: [],
    highMarginOpportunities: [],
    insights: [{
      id: "test",
      category: "Fleet",
      title: "Test insight",
      description: "Test",
      severity: "medium",
      confidence: 90,
      businessImpact: "High",
      recommendedAction: "Act",
      actions: [{ label: "Go", href: "/fleet" }],
    }],
    recentActivity: [],
    upcomingDeliveries: [],
    complianceWarnings: [],
    fuelAlerts: [],
    liveStream: [],
    dispatchSuggestions: [],
    analytics: {
      revenueForecast7d: 5000,
      marginForecast7d: 4250,
      fleetUtilization: 67,
      customerLifetimeValue: 0,
      vendorScore: 85,
      driverScore: 80,
      regionalDemand: [],
      weeklyEvents: [],
    },
    digitalTwinHealth: {
      fleetHealth: { score: 90, label: "OK", issues: [] },
      driverHealth: { score: 80, label: "OK", issues: [] },
      equipmentHealth: { score: 100, label: "OK", issues: [] },
      maintenance: { overdue: 0, upcoming: 0 },
      compliance: { status: "good", issues: [] },
      insurance: { status: "verified", expiringWithin30Days: false },
      fuel: { alertCount: 0 },
      utilization: 67,
    },
    updatedAt: new Date().toISOString(),
  })),
  searchOperations: vi.fn(async (_profile, q: string) => ({
    results: q ? [{ type: "nav", label: "Dashboard", href: "/dashboard" }] : [],
  })),
}));

import operationsRouter from "./operations";
import { buildOperationsCenter, searchOperations } from "../lib/operationsInsights";

function makeApp(): Express {
  const app = express();
  app.use(express.json());
  app.use(operationsRouter);
  return app;
}

describe("Operations Center", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns operations center payload", async () => {
    const res = await request(makeApp()).get("/operations/center");
    expect(res.status).toBe(200);
    expect(res.body.morningBrief).toContain("Good morning");
    expect(res.body.insights).toHaveLength(1);
    expect(buildOperationsCenter).toHaveBeenCalled();
  });

  it("searches operations", async () => {
    const res = await request(makeApp()).get("/operations/search?q=dashboard");
    expect(res.status).toBe(200);
    expect(res.body.results).toHaveLength(1);
    expect(searchOperations).toHaveBeenCalled();
  });
});
