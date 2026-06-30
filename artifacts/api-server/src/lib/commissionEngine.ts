import { and, desc, eq, isNull } from "drizzle-orm";
import {
  commissionAuditTable,
  commissionCalculationsTable,
  commissionConfigsTable,
  db,
  type CommissionConfig,
} from "@workspace/db";

export const DEFAULT_COMMISSION_RATE = 0.2;

export type CommissionScopeType = "global" | "customer" | "vendor" | "project";

export type CommissionContext = {
  customerId: number;
  vendorId: number;
  projectId?: number | null;
};

export type ResolvedCommission = {
  rate: number;
  scopeType: CommissionScopeType;
  scopeId: number | null;
  configId: number | null;
};

export type CommissionBreakdown = {
  workAmount: number;
  platformCommission: number;
  customerTotal: number;
  vendorPayout: number;
  driverPayout: number | null;
  internalProfit: number;
  marketplaceGmv: number;
  commissionRate: number;
};

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function normalizeRate(rate: number): number {
  if (!Number.isFinite(rate) || rate < 0 || rate > 1) {
    throw new Error("Commission rate must be between 0 and 1.");
  }
  return Math.round(rate * 10_000) / 10_000;
}

export function calculateCommission(workAmount: number, commissionRate: number): CommissionBreakdown {
  const normalizedRate = normalizeRate(commissionRate);
  const normalizedWorkAmount = roundMoney(workAmount);
  const platformCommission = roundMoney(normalizedWorkAmount * normalizedRate);
  const customerTotal = roundMoney(normalizedWorkAmount + platformCommission);
  return {
    workAmount: normalizedWorkAmount,
    platformCommission,
    customerTotal,
    vendorPayout: normalizedWorkAmount,
    driverPayout: null,
    internalProfit: platformCommission,
    marketplaceGmv: customerTotal,
    commissionRate: normalizedRate,
  };
}

export function calculateCommissionFromHours(ratePerHour: number, hours: number, commissionRate: number): CommissionBreakdown {
  return calculateCommission(roundMoney(ratePerHour * hours), commissionRate);
}

function rowToResolved(row: CommissionConfig | undefined, fallback: ResolvedCommission): ResolvedCommission {
  if (!row) return fallback;
  return {
    rate: normalizeRate(parseFloat(row.rate)),
    scopeType: row.scopeType,
    scopeId: row.scopeId ?? null,
    configId: row.id,
  };
}

async function latestActiveConfig(scopeType: CommissionScopeType, scopeId: number | null): Promise<CommissionConfig | undefined> {
  const where = scopeId == null
    ? and(eq(commissionConfigsTable.scopeType, scopeType), isNull(commissionConfigsTable.scopeId), eq(commissionConfigsTable.active, 1))
    : and(eq(commissionConfigsTable.scopeType, scopeType), eq(commissionConfigsTable.scopeId, scopeId), eq(commissionConfigsTable.active, 1));
  const [row] = await db
    .select()
    .from(commissionConfigsTable)
    .where(where)
    .orderBy(desc(commissionConfigsTable.updatedAt))
    .limit(1);
  return row;
}

export async function resolveCommission(context: CommissionContext): Promise<ResolvedCommission> {
  const fallback: ResolvedCommission = {
    rate: DEFAULT_COMMISSION_RATE,
    scopeType: "global",
    scopeId: null,
    configId: null,
  };

  if (context.projectId != null) {
    const project = await latestActiveConfig("project", context.projectId);
    if (project) return rowToResolved(project, fallback);
  }

  const vendor = await latestActiveConfig("vendor", context.vendorId);
  if (vendor) return rowToResolved(vendor, fallback);

  const customer = await latestActiveConfig("customer", context.customerId);
  if (customer) return rowToResolved(customer, fallback);

  const global = await latestActiveConfig("global", null);
  return rowToResolved(global, fallback);
}

export async function recordCommissionCalculation(args: {
  jobId: number;
  resolved: ResolvedCommission;
  breakdown: CommissionBreakdown;
}): Promise<void> {
  const { jobId, resolved, breakdown } = args;
  await db.insert(commissionCalculationsTable).values({
    jobId,
    sourceConfigId: resolved.configId,
    scopeType: resolved.scopeType,
    scopeId: resolved.scopeId,
    commissionRate: String(breakdown.commissionRate),
    workAmount: String(breakdown.workAmount),
    platformCommission: String(breakdown.platformCommission),
    customerTotal: String(breakdown.customerTotal),
    vendorPayout: String(breakdown.vendorPayout),
    driverPayout: breakdown.driverPayout == null ? null : String(breakdown.driverPayout),
    internalProfit: String(breakdown.internalProfit),
    marketplaceGmv: String(breakdown.marketplaceGmv),
  });
}

export async function upsertCommissionConfig(args: {
  scopeType: CommissionScopeType;
  scopeId?: number | null;
  rate: number;
  actorProfileId?: number | null;
  reason?: string | null;
}): Promise<CommissionConfig> {
  const scopeId = args.scopeType === "global" ? null : args.scopeId ?? null;
  if (args.scopeType !== "global" && scopeId == null) {
    throw new Error("scopeId is required for customer, vendor, and project commission overrides.");
  }
  const rate = normalizeRate(args.rate);
  const existing = await latestActiveConfig(args.scopeType, scopeId);

  let row: CommissionConfig;
  if (existing) {
    [row] = await db
      .update(commissionConfigsTable)
      .set({
        rate: String(rate),
        reason: args.reason ?? null,
        createdByProfileId: args.actorProfileId ?? null,
      })
      .where(eq(commissionConfigsTable.id, existing.id))
      .returning();
  } else {
    [row] = await db
      .insert(commissionConfigsTable)
      .values({
        scopeType: args.scopeType,
        scopeId,
        rate: String(rate),
        reason: args.reason ?? null,
        createdByProfileId: args.actorProfileId ?? null,
      })
      .returning();
  }

  await db.insert(commissionAuditTable).values({
    action: existing ? "updated" : "created",
    scopeType: args.scopeType,
    scopeId,
    configId: row.id,
    previousRate: existing?.rate ?? null,
    newRate: String(rate),
    actorProfileId: args.actorProfileId ?? null,
    reason: args.reason ?? null,
  });

  return row;
}
