import { describe, it, expect, vi, beforeEach } from "vitest";
import express, { type Express } from "express";
import request from "supertest";

vi.mock("../middlewares/requireAuth", () => ({
  requireProfile: (_req: unknown, _res: unknown, next: () => void) => next(),
  getRequestProfile: () => ({
    id: 1, role: "provider", companyName: "Haul Co", state: "CA", organizationId: 1, orgRole: "owner",
  }),
}));

vi.mock("../lib/enterpriseHub", () => ({
  buildEnterpriseHub: vi.fn(async () => ({
    workflows: { items: [], templates: {} },
    tasks: { items: [], overdue: [] },
    documents: { items: [], expiring: [] },
    scorecards: { vendor: { acceptanceRate: 90 } },
    finance: { revenue: 50000 },
    fleet: { summary: { total: 3 } },
    reports: { saved: [], templates: [] },
    settings: {},
    audit: [],
    permissions: ["workflows_view"],
    operations: {},
    updatedAt: new Date().toISOString(),
  })),
}));

vi.mock("../lib/globalSearch", () => ({
  globalSearch: vi.fn(async () => [{ type: "load", label: "Job #1", href: "/jobs/1", category: "Loads" }]),
}));

vi.mock("../lib/workflowEngine", () => ({
  WORKFLOW_TEMPLATES: { load_approval: { title: "Load", slaHours: 4, priority: "critical" } },
  listWorkflows: vi.fn(async () => []),
  createWorkflow: vi.fn(async () => ({ id: 1, title: "Test" })),
  addWorkflowComment: vi.fn(async () => []),
  updateWorkflowStatus: vi.fn(async () => ({ id: 1, status: "completed" })),
}));

vi.mock("../lib/taskEngine", () => ({
  listTasks: vi.fn(async () => []),
  createTask: vi.fn(async () => ({ id: 1, title: "Task" })),
  completeTask: vi.fn(async () => ({ id: 1, status: "done" })),
}));

vi.mock("../lib/documentCenter", () => ({
  aggregateDocuments: vi.fn(async () => []),
  getExpiringDocuments: vi.fn(async () => []),
}));

vi.mock("../lib/scorecards", () => ({
  getScorecards: vi.fn(async () => ({})),
}));

vi.mock("../lib/financeCenter", () => ({
  getFinanceCenter: vi.fn(async () => ({ revenue: 1000 })),
  getFleetManagement: vi.fn(async () => ({ summary: { total: 0 } })),
}));

vi.mock("../lib/reportBuilder", () => ({
  REPORT_TEMPLATES: [],
  listReports: vi.fn(async () => []),
  saveReport: vi.fn(async () => ({ id: 1 })),
  runReport: vi.fn(async () => ({ data: {} })),
  exportReportCsv: vi.fn(() => "key,value"),
}));

vi.mock("../lib/enterpriseSettings", () => ({
  getSettings: vi.fn(async () => ({})),
  updateSettings: vi.fn(async () => ({})),
}));

vi.mock("../lib/enterpriseAudit", () => ({
  listAuditLogs: vi.fn(async () => []),
}));

vi.mock("../lib/enterprisePermissions", () => ({
  getOrgPermissions: vi.fn(async () => ["workflows_view"]),
}));

import enterpriseRouter from "./enterprise";

function makeApp(): Express {
  const app = express();
  app.use(express.json());
  app.use(enterpriseRouter);
  return app;
}

describe("Enterprise OS", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns enterprise hub", async () => {
    const res = await request(makeApp()).get("/enterprise/hub");
    expect(res.status).toBe(200);
    expect(res.body.finance.revenue).toBe(50000);
  });

  it("global search", async () => {
    const res = await request(makeApp()).get("/enterprise/search?q=job");
    expect(res.status).toBe(200);
    expect(res.body.results).toHaveLength(1);
  });

  it("creates workflow", async () => {
    const res = await request(makeApp()).post("/enterprise/workflows").send({ templateKey: "load_approval" });
    expect(res.status).toBe(201);
  });

  it("creates task", async () => {
    const res = await request(makeApp()).post("/enterprise/tasks").send({ title: "Review load" });
    expect(res.status).toBe(201);
  });
});
