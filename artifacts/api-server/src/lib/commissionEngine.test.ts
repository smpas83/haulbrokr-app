import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  configs: [] as any[],
  inserted: [] as { table: unknown; values: Record<string, unknown> }[],
  updated: [] as Record<string, unknown>[],
}));

vi.mock("@workspace/db", () => {
  const makeTable = (name: string) =>
    new Proxy({}, { get: (_target, prop) => `${name}.${String(prop)}` });

  const commissionConfigsTable = makeTable("commissionConfigs");
  const commissionAuditTable = makeTable("commissionAudit");
  const commissionCalculationsTable = makeTable("commissionCalculations");

  function matchingConfig(scopeType: string, scopeId: number | null) {
    return h.configs
      .filter((row) => row.scopeType === scopeType && (row.scopeId ?? null) === scopeId && row.active === 1)
      .sort((a, b) => Number(b.id) - Number(a.id));
  }

  const db = {
    select: () => ({
      from: () => ({
        where: (condition: any) => {
          const sqlText = String(condition?.queryChunks?.map?.((chunk: any) => chunk?.value?.[0] ?? chunk).join(" ") ?? condition);
          const scopeType = ["project", "vendor", "customer", "global"].find((scope) => sqlText.includes(scope));
          const scopeId = scopeType === "global" ? null : Number(sqlText.match(/\$[0-9]+/) ? NaN : NaN);
          const chain = {
            orderBy: () => ({
              limit: () => Promise.resolve(scopeType ? matchingConfig(scopeType, scopeId).slice(0, 1) : []),
            }),
          };
          return chain;
        },
      }),
    }),
    update: () => ({
      set: (values: Record<string, unknown>) => {
        h.updated.push(values);
        return {
          where: () => ({
            returning: () => {
              const existing = h.configs[0] ?? {};
              const updated = { ...existing, ...values };
              h.configs[0] = updated;
              return Promise.resolve([updated]);
            },
          }),
        };
      },
    }),
    insert: (table: unknown) => ({
      values: (values: Record<string, unknown>) => {
        h.inserted.push({ table, values });
        return {
          returning: () => {
            const row = { id: h.configs.length + 1, active: 1, ...values };
            if (table === commissionConfigsTable) h.configs.push(row);
            return Promise.resolve([row]);
          },
        };
      },
    }),
  };

  return {
    db,
    commissionConfigsTable,
    commissionAuditTable,
    commissionCalculationsTable,
  };
});

import {
  calculateCommission,
  calculateCommissionFromHours,
  DEFAULT_COMMISSION_RATE,
  recordCommissionCalculation,
  upsertCommissionConfig,
} from "./commissionEngine";
import { commissionAuditTable, commissionCalculationsTable } from "@workspace/db";

beforeEach(() => {
  h.configs = [];
  h.inserted = [];
  h.updated = [];
});

describe("calculateCommission", () => {
  it("defaults marketplace math to a 20% commission", () => {
    expect(DEFAULT_COMMISSION_RATE).toBe(0.2);
    expect(calculateCommission(100, DEFAULT_COMMISSION_RATE)).toMatchObject({
      workAmount: 100,
      platformCommission: 20,
      customerTotal: 120,
      vendorPayout: 100,
      driverPayout: null,
      internalProfit: 20,
      marketplaceGmv: 120,
      commissionRate: 0.2,
    });
  });

  it("rounds all money fields to cents", () => {
    expect(calculateCommissionFromHours(33.33, 3, 0.2)).toMatchObject({
      workAmount: 99.99,
      platformCommission: 20,
      customerTotal: 119.99,
      vendorPayout: 99.99,
    });
  });

  it("rejects invalid commission rates", () => {
    expect(() => calculateCommission(100, 1.5)).toThrow(/between 0 and 1/);
  });
});

describe("commission persistence helpers", () => {
  it("creates a global config and writes audit history", async () => {
    const row = await upsertCommissionConfig({
      scopeType: "global",
      rate: 0.22,
      actorProfileId: 10,
      reason: "beta marketplace rate",
    });

    expect(row.rate).toBe("0.22");
    const audit = h.inserted.find((entry) => entry.table === commissionAuditTable);
    expect(audit?.values).toMatchObject({
      action: "created",
      scopeType: "global",
      scopeId: null,
      newRate: "0.22",
      actorProfileId: 10,
      reason: "beta marketplace rate",
    });
  });

  it("persists every commission calculation", async () => {
    await recordCommissionCalculation({
      jobId: 7,
      resolved: { rate: 0.2, scopeType: "vendor", scopeId: 99, configId: 3 },
      breakdown: calculateCommission(500, 0.2),
    });

    const calculation = h.inserted.find((entry) => entry.table === commissionCalculationsTable);
    expect(calculation?.values).toMatchObject({
      jobId: 7,
      sourceConfigId: 3,
      scopeType: "vendor",
      scopeId: 99,
      commissionRate: "0.2",
      workAmount: "500",
      platformCommission: "100",
      customerTotal: "600",
      vendorPayout: "500",
      internalProfit: "100",
      marketplaceGmv: "600",
    });
  });
});
