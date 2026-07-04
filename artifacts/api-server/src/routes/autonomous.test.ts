import { describe, it, expect, beforeEach, vi } from "vitest";
import express, { type Express } from "express";
import request from "supertest";

vi.mock("../middlewares/requireAuth", () => ({
  requireProfile: (_req: unknown, _res: unknown, next: () => void) => next(),
  getRequestProfile: () => ({ id: 1, role: "provider", companyName: "Haul Co", state: "CA" }),
}));

vi.mock("../lib/autonomousStatus", () => ({
  buildAutonomousLayer: vi.fn(async () => ({
    businessHealth: { overall: 82, operational: 78, revenue: 70, fleet: 85, customer: 60, vendor: 80, compliance: 95, dispatch: 75, driver: 88, aiConfidence: 90 },
    pendingApprovals: [{ id: 1, title: "Test", status: "pending", priority: "high" }],
    interruptQueue: [{ id: 1, title: "Test", status: "pending", priority: "high" }],
    autonomousActivity: [],
    executiveDigest: { period: "morning", title: "Brief", summary: "Hello", highlights: [], metrics: {}, recommendations: [], risks: [], opportunities: [] },
    memorySummary: { patterns: 2, approvals: 1, dismissals: 0 },
    engineStatus: { lastRunAt: new Date().toISOString(), recommendationsGenerated: 1, executedToday: 0 },
  })),
}));

vi.mock("../lib/autonomousMemory", () => ({
  searchTimeline: vi.fn(async () => [{ id: 1, eventType: "recommendation_created", title: "Test", description: "d", createdAt: new Date().toISOString() }]),
}));

vi.mock("../lib/autonomousExecution", () => ({
  approveRecommendation: vi.fn(async () => ({ id: 1, status: "approved" })),
  rejectRecommendation: vi.fn(async () => ({ id: 1, status: "rejected" })),
  executeApprovedRecommendation: vi.fn(async () => ({ success: true, message: "Done" })),
}));

vi.mock("../lib/autonomousEngine", () => ({
  listRecommendations: vi.fn(async () => []),
  countExecutedToday: vi.fn(async () => 0),
}));

vi.mock("../lib/operationsInsights", () => ({
  buildOperationsCenter: vi.fn(async () => ({
    morningBrief: "Hi",
    todayRevenue: 1000,
    todayJobs: 2,
    criticalAlerts: [],
    insights: [],
    analytics: { revenueForecast7d: 5000, fleetUtilization: 70, customerLifetimeValue: 0, regionalDemand: [] },
    complianceWarnings: [],
    lateJobs: [],
    highMarginOpportunities: [],
  })),
}));

vi.mock("../lib/businessHealth", () => ({
  computeBusinessHealth: vi.fn(() => ({ overall: 80, operational: 75, revenue: 70, fleet: 85, customer: 60, vendor: 80, compliance: 95, dispatch: 75, driver: 88, aiConfidence: 90 })),
}));

vi.mock("../lib/executiveDigest", () => ({
  generateExecutiveDigest: vi.fn(async () => ({ period: "morning", title: "Brief", summary: "Hi", highlights: [], metrics: {}, recommendations: [], risks: [], opportunities: [] })),
}));

import autonomousRouter from "./autonomous";

function makeApp(): Express {
  const app = express();
  app.use(express.json());
  app.use(autonomousRouter);
  return app;
}

describe("Autonomous Operations", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns autonomous status", async () => {
    const res = await request(makeApp()).get("/autonomous/status");
    expect(res.status).toBe(200);
    expect(res.body.businessHealth.overall).toBe(82);
    expect(res.body.pendingApprovals).toHaveLength(1);
  });

  it("searches timeline", async () => {
    const res = await request(makeApp()).get("/autonomous/timeline?q=test");
    expect(res.status).toBe(200);
    expect(res.body.events).toHaveLength(1);
  });

  it("approves recommendation", async () => {
    const res = await request(makeApp()).post("/autonomous/recommendations/1/approve");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("approved");
  });

  it("executes recommendation", async () => {
    const res = await request(makeApp()).post("/autonomous/recommendations/1/execute");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("returns executive digest", async () => {
    const res = await request(makeApp()).get("/autonomous/digest/morning");
    expect(res.status).toBe(200);
    expect(res.body.period).toBe("morning");
  });
});
