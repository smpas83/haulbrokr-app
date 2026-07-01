import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  rows: [] as Record<string, unknown>[],
  inserts: [] as Record<string, unknown>[],
}));

vi.mock("@workspace/db", () => {
  const makeTable = (name: string) =>
    new Proxy({}, { get: (_target, prop) => `${name}.${String(prop)}` });
  const commissionRulesTable = makeTable("commissionRules");
  const marketplaceAuditLogsTable = makeTable("marketplaceAuditLogs");
  return {
    commissionRulesTable,
    marketplaceAuditLogsTable,
    db: {
      select: () => ({
        from: () => ({
          where: () => Promise.resolve(h.rows),
        }),
      }),
      insert: () => ({
        values: (row: Record<string, unknown>) => {
          h.inserts.push(row);
          return Promise.resolve(undefined);
        },
      }),
    },
  };
});

import {
  computeJobAmounts,
  computeMarketplaceAmounts,
  recordMarketplaceAudit,
  resolveCommissionRule,
} from "./marketplaceCommission";

beforeEach(() => {
  h.rows = [];
  h.inserts = [];
});

describe("computeMarketplaceAmounts", () => {
  it("returns customer total, platform commission, vendor payout, GMV, and future driver payout", () => {
    expect(computeMarketplaceAmounts(1000, 0.2)).toEqual({
      workAmount: 1000,
      platformCommission: 200,
      vendorPayout: 1000,
      driverPayout: 0,
      marketplaceRevenue: 200,
      platformProfit: 200,
      customerTotal: 1200,
      gmv: 1200,
    });
  });

  it("rounds job amount calculations to cents", () => {
    expect(computeJobAmounts(33.33, 3, 0.2).customerTotal).toBe(119.99);
  });
});

describe("resolveCommissionRule", () => {
  it("prioritizes emergency, project, customer, vendor, then global rules", async () => {
    h.rows = [
      {
        id: 1,
        scope: "global",
        targetId: null,
        rate: "0.20",
        priority: 0,
        reason: "global",
      },
      {
        id: 2,
        scope: "vendor",
        targetId: 7,
        rate: "0.18",
        priority: 0,
        reason: "vendor",
      },
      {
        id: 3,
        scope: "customer",
        targetId: 5,
        rate: "0.17",
        priority: 0,
        reason: "customer",
      },
      {
        id: 4,
        scope: "project",
        targetId: 9,
        rate: "0.16",
        priority: 0,
        reason: "project",
      },
      {
        id: 5,
        scope: "emergency",
        targetId: null,
        rate: "0.30",
        priority: 0,
        reason: "emergency",
      },
    ];

    await expect(
      resolveCommissionRule({
        customerId: 5,
        vendorId: 7,
        projectId: 9,
        emergency: true,
      }),
    ).resolves.toMatchObject({ ruleId: 5, scope: "emergency", rate: 0.3 });
  });

  it("falls back to the required 20 percent default when no active rule matches", async () => {
    h.rows = [];

    await expect(
      resolveCommissionRule({ customerId: 5 }),
    ).resolves.toMatchObject({
      ruleId: null,
      scope: "system_default",
      rate: 0.2,
    });
  });
});

describe("recordMarketplaceAudit", () => {
  it("stores audit history without throwing", async () => {
    await recordMarketplaceAudit({
      actorProfileId: 1,
      action: "commission_rule.create",
      entityType: "commission_rule",
      entityId: 2,
      after: { rate: 0.2 },
    });

    expect(h.inserts).toEqual([
      expect.objectContaining({
        actorProfileId: 1,
        action: "commission_rule.create",
        entityType: "commission_rule",
        entityId: "2",
      }),
    ]);
  });
});
