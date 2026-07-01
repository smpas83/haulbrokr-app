import { and, eq, isNull, lte, or, sql } from "drizzle-orm";
import {
  commissionRulesTable,
  db,
  marketplaceAuditLogsTable,
  type CommissionRule,
} from "@workspace/db";

export const DEFAULT_COMMISSION_RATE = Number(
  process.env.HAULBROKR_DEFAULT_COMMISSION_RATE ?? "0.2",
);

export type CommissionScope =
  | "global"
  | "customer"
  | "vendor"
  | "project"
  | "material"
  | "region"
  | "emergency";

export type CommissionContext = {
  customerId?: number | null;
  vendorId?: number | null;
  projectId?: number | null;
  materialType?: string | null;
  region?: string | null;
  emergency?: boolean | null;
  now?: Date;
};

export type MarketplaceAmounts = {
  workAmount: number;
  platformCommission: number;
  vendorPayout: number;
  driverPayout: number;
  marketplaceRevenue: number;
  platformProfit: number;
  customerTotal: number;
  gmv: number;
};

export type CommissionResolution = {
  ruleId: number | null;
  scope: CommissionScope | "system_default";
  rate: number;
  reason: string | null;
};

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function num(value: string | number | null | undefined): number | null {
  if (value == null) return null;
  const parsed = typeof value === "number" ? value : Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function targetMatches(
  rule: CommissionRule,
  context: CommissionContext,
): boolean {
  if (rule.scope === "global") return rule.targetId == null;
  if (rule.scope === "emergency")
    return !!context.emergency && rule.targetId == null;
  if (rule.scope === "customer") return rule.targetId === context.customerId;
  if (rule.scope === "vendor") return rule.targetId === context.vendorId;
  if (rule.scope === "project") return rule.targetId === context.projectId;
  if (rule.scope === "material") return rule.targetKey === context.materialType;
  if (rule.scope === "region") return rule.targetKey === context.region;
  return false;
}

function specificity(scope: CommissionRule["scope"]): number {
  return {
    emergency: 50,
    project: 40,
    customer: 30,
    vendor: 20,
    material: 15,
    region: 15,
    global: 10,
  }[scope];
}

export async function resolveCommissionRule(
  context: CommissionContext,
): Promise<CommissionResolution> {
  const now = context.now ?? new Date();
  const rules = await db
    .select()
    .from(commissionRulesTable)
    .where(
      and(
        eq(commissionRulesTable.active, 1),
        lte(commissionRulesTable.effectiveFrom, now),
        or(
          isNull(commissionRulesTable.effectiveTo),
          sql`${commissionRulesTable.effectiveTo} > ${now}`,
        ),
      ),
    );

  const matching = rules
    .filter((rule) => targetMatches(rule, context))
    .sort((a, b) => {
      const priority = b.priority - a.priority;
      if (priority !== 0) return priority;
      return specificity(b.scope) - specificity(a.scope);
    });

  const selected = matching[0];
  if (!selected) {
    return {
      ruleId: null,
      scope: "system_default",
      rate: DEFAULT_COMMISSION_RATE,
      reason: "Default marketplace commission",
    };
  }

  return {
    ruleId: selected.id,
    scope: selected.scope,
    rate: num(selected.rate) ?? DEFAULT_COMMISSION_RATE,
    reason: selected.reason,
  };
}

export function computeMarketplaceAmounts(
  workAmount: number,
  commissionRate: number,
): MarketplaceAmounts {
  const vendorPayout = roundMoney(workAmount);
  const platformCommission = roundMoney(vendorPayout * commissionRate);
  const customerTotal = roundMoney(vendorPayout + platformCommission);
  return {
    workAmount: vendorPayout,
    platformCommission,
    vendorPayout,
    driverPayout: 0,
    marketplaceRevenue: platformCommission,
    platformProfit: platformCommission,
    customerTotal,
    gmv: customerTotal,
  };
}

export function computeJobAmounts(
  ratePerHour: number,
  hours: number,
  commissionRate: number,
): MarketplaceAmounts {
  return computeMarketplaceAmounts(
    roundMoney(ratePerHour * hours),
    commissionRate,
  );
}

export async function recordMarketplaceAudit(input: {
  actorProfileId?: number | null;
  action: string;
  entityType: string;
  entityId: string | number;
  before?: unknown;
  after?: unknown;
  metadata?: unknown;
  stripeEventId?: string | null;
  ip?: string | null;
}): Promise<void> {
  try {
    await db.insert(marketplaceAuditLogsTable).values({
      actorProfileId: input.actorProfileId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: String(input.entityId),
      before: input.before ?? null,
      after: input.after ?? null,
      metadata: input.metadata ?? null,
      stripeEventId: input.stripeEventId ?? null,
      ip: input.ip ?? null,
    });
  } catch (err) {
    console.error("Failed to record marketplace audit log", err);
  }
}
