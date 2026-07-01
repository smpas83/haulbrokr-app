import { beforeEach, describe, expect, it, vi } from "vitest";
import express, { type Express } from "express";
import request from "supertest";

const h = vi.hoisted(() => ({
  profile: {
    id: 1,
    role: "customer",
    companyName: "Customer Co",
    staffRole: "cto",
  } as Record<string, unknown>,
  pricingRules: [] as Record<string, unknown>[],
  commissionRules: [] as Record<string, unknown>[],
  inserts: [] as { table: unknown; row: Record<string, unknown> }[],
  nextId: 1,
}));

vi.mock("@workspace/db", () => {
  const makeTable = (name: string) =>
    new Proxy({}, { get: (_target, prop) => `${name}.${String(prop)}` });
  const commissionRulesTable = makeTable("commissionRules");
  const pricingRulesTable = makeTable("pricingRules");
  const marketplaceQuotesTable = makeTable("marketplaceQuotes");
  const marketplaceAuditLogsTable = makeTable("marketplaceAuditLogs");
  return {
    commissionRulesTable,
    pricingRulesTable,
    marketplaceQuotesTable,
    marketplaceAuditLogsTable,
    db: {
      select: () => ({
        from: (table: unknown) => ({
          where: () => {
            if (table === pricingRulesTable)
              return Promise.resolve(h.pricingRules);
            if (table === commissionRulesTable)
              return Promise.resolve(h.commissionRules);
            return Promise.resolve([]);
          },
          orderBy: () => {
            if (table === pricingRulesTable)
              return Promise.resolve(h.pricingRules);
            if (table === commissionRulesTable)
              return Promise.resolve(h.commissionRules);
            return Promise.resolve([]);
          },
        }),
      }),
      insert: (table: unknown) => ({
        values: (row: Record<string, unknown>) => {
          h.inserts.push({ table, row });
          return {
            returning: () =>
              Promise.resolve([
                {
                  id: h.nextId++,
                  status: "quoted",
                  createdAt: new Date("2026-07-01T00:00:00Z"),
                  ...row,
                },
              ]),
          };
        },
      }),
      update: () => ({
        set: (row: Record<string, unknown>) => ({
          where: () => ({
            returning: () =>
              Promise.resolve([
                {
                  id: 1,
                  createdAt: new Date("2026-07-01T00:00:00Z"),
                  updatedAt: new Date("2026-07-01T00:00:00Z"),
                  ...row,
                },
              ]),
          }),
        }),
      }),
    },
  };
});

vi.mock("../middlewares/requireAuth", () => ({
  requireProfile: (req: any, _res: any, next: any) => {
    req.profile = h.profile;
    next();
  },
  getRequestProfile: (req: any) => req.profile,
  attachClerkProfileIfPresent: (req: any, _res: any, next: any) => {
    req.profile = h.profile;
    next();
  },
}));

vi.mock("../middlewares/staffAuth", () => ({
  attachStaffSession: (_req: any, _res: any, next: any) => next(),
  requireStaffOrProfile: (_req: any, _res: any, next: any) => next(),
}));

vi.mock("../middlewares/requireAdmin", () => ({
  requirePermission: () => (_req: any, _res: any, next: any) => next(),
}));

import marketplaceRouter from "./marketplace";

function makeApp(): Express {
  const app = express();
  app.use(express.json());
  app.use(marketplaceRouter);
  return app;
}

beforeEach(() => {
  h.profile = {
    id: 1,
    role: "customer",
    companyName: "Customer Co",
    staffRole: "cto",
  };
  h.pricingRules = [
    {
      id: 1,
      code: "base_hourly_rate",
      label: "Base",
      valueType: "fixed_amount",
      value: "100",
      priority: 0,
    },
    {
      id: 2,
      code: "distance_mile_rate",
      label: "Distance",
      valueType: "fixed_amount",
      value: "5",
      priority: 0,
    },
  ];
  h.commissionRules = [
    {
      id: 3,
      scope: "global",
      targetId: null,
      rate: "0.20",
      priority: 0,
      reason: "global",
    },
  ];
  h.inserts = [];
  h.nextId = 1;
});

describe("POST /marketplace/quotes", () => {
  it("creates a persisted quote with customer total, vendor payout, commission, and GMV", async () => {
    const res = await request(makeApp()).post("/marketplace/quotes").send({
      distanceMiles: 10,
      estimatedHours: 2,
      trucksNeeded: 1,
      truckType: "dump_truck",
      materialType: "gravel",
    });

    expect(res.status).toBe(201);
    expect(res.body.vendorPayout).toBe(250);
    expect(res.body.platformCommission).toBe(50);
    expect(res.body.customerQuote).toBe(300);
    expect(res.body.gmv).toBe(300);
    expect(h.inserts.some((entry) => entry.row.customerTotal === "300")).toBe(
      true,
    );
  });
});

describe("POST /admin/marketplace/commission-rules", () => {
  it("creates an admin-configurable commission rule and audit record", async () => {
    const res = await request(makeApp())
      .post("/admin/marketplace/commission-rules")
      .send({
        scope: "customer",
        targetId: 42,
        rate: 0.15,
        reason: "Strategic account",
      });

    expect(res.status).toBe(201);
    expect(res.body.scope).toBe("customer");
    expect(res.body.rate).toBe(0.15);
    expect(h.inserts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          row: expect.objectContaining({
            scope: "customer",
            targetId: 42,
            rate: "0.15",
          }),
        }),
        expect.objectContaining({
          row: expect.objectContaining({ action: "commission_rule.create" }),
        }),
      ]),
    );
  });
});
