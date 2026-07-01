import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import {
  commissionRulesTable,
  db,
  marketplaceQuotesTable,
  pricingRulesTable,
} from "@workspace/db";
import { z } from "zod/v4";
import {
  attachClerkProfileIfPresent,
  getRequestProfile,
  requireProfile,
} from "../middlewares/requireAuth";
import { requirePermission } from "../middlewares/requireAdmin";
import {
  attachStaffSession,
  requireStaffOrProfile,
} from "../middlewares/staffAuth";
import {
  computeMarketplaceAmounts,
  recordMarketplaceAudit,
  resolveCommissionRule,
} from "../lib/marketplaceCommission";
import { computeDynamicQuote } from "../lib/dynamicPricing";

const router: IRouter = Router();

router.use(attachStaffSession);
router.use(attachClerkProfileIfPresent);

const commissionRuleBody = z.object({
  scope: z
    .enum(["global", "customer", "vendor", "project", "emergency"])
    .default("global"),
  targetId: z.number().int().positive().nullable().optional(),
  rate: z.number().min(0).max(1),
  priority: z.number().int().default(0),
  active: z.number().int().min(0).max(1).default(1),
  reason: z.string().min(1).nullable().optional(),
  effectiveFrom: z.coerce.date().optional(),
  effectiveTo: z.coerce.date().nullable().optional(),
});

const pricingRuleBody = z.object({
  code: z.enum([
    "base_hourly_rate",
    "distance_mile_rate",
    "truck_type_multiplier",
    "material_multiplier",
    "demand_multiplier",
    "available_trucks_multiplier",
    "traffic_multiplier",
    "fuel_surcharge_pct",
    "night_surcharge_pct",
    "weekend_surcharge_pct",
    "holiday_surcharge_pct",
    "emergency_surcharge_pct",
    "remote_location_surcharge_pct",
    "weather_surcharge_pct",
    "waiting_time_hourly_rate",
    "extra_stop_fee",
  ]),
  label: z.string().min(1),
  valueType: z.enum(["fixed_amount", "percent", "multiplier"]),
  value: z.number(),
  targetKey: z.string().min(1).nullable().optional(),
  minInput: z.number().nullable().optional(),
  maxInput: z.number().nullable().optional(),
  priority: z.number().int().default(0),
  active: z.number().int().min(0).max(1).default(1),
  effectiveFrom: z.coerce.date().optional(),
  effectiveTo: z.coerce.date().nullable().optional(),
});

const commissionPreviewBody = z.object({
  workAmount: z.number().positive(),
  customerId: z.number().int().positive().nullable().optional(),
  vendorId: z.number().int().positive().nullable().optional(),
  projectId: z.number().int().positive().nullable().optional(),
  emergency: z.boolean().optional(),
});

const quoteBody = z.object({
  customerId: z.number().int().positive().nullable().optional(),
  vendorId: z.number().int().positive().nullable().optional(),
  projectId: z.number().int().positive().nullable().optional(),
  distanceMiles: z.number().min(0),
  estimatedHours: z.number().positive(),
  trucksNeeded: z.number().int().positive().default(1),
  baseRatePerHour: z.number().positive().nullable().optional(),
  truckType: z.string().nullable().optional(),
  materialType: z.string().nullable().optional(),
  demandLevel: z.string().nullable().optional(),
  availableTrucks: z.number().int().min(0).nullable().optional(),
  trafficLevel: z.string().nullable().optional(),
  fuelSurcharge: z.boolean().optional(),
  nightHauling: z.boolean().optional(),
  weekend: z.boolean().optional(),
  holiday: z.boolean().optional(),
  emergencyDispatch: z.boolean().optional(),
  remoteLocation: z.boolean().optional(),
  weatherSeverity: z.string().nullable().optional(),
  waitingTimeMinutes: z.number().min(0).nullable().optional(),
  extraStops: z.number().int().min(0).nullable().optional(),
  expiresAt: z.coerce.date().nullable().optional(),
});

function num(value: string | number | null | undefined): number | null {
  if (value == null) return null;
  const parsed = typeof value === "number" ? value : Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function serializeCommissionRule(rule: any) {
  return {
    ...rule,
    rate: num(rule.rate),
  };
}

function serializePricingRule(rule: any) {
  return {
    ...rule,
    value: num(rule.value),
    minInput: num(rule.minInput),
    maxInput: num(rule.maxInput),
  };
}

function serializeQuote(quote: any) {
  return {
    ...quote,
    commissionRate: num(quote.commissionRate),
    vendorPayout: num(quote.vendorPayout),
    driverPayout: num(quote.driverPayout),
    platformCommission: num(quote.platformCommission),
    marketplaceRevenue: num(quote.marketplaceRevenue),
    platformProfit: num(quote.platformProfit),
    customerTotal: num(quote.customerTotal),
    gmv: num(quote.gmv),
  };
}

router.get(
  "/admin/marketplace/commission-rules",
  requireStaffOrProfile,
  requirePermission("pricing"),
  async (_req, res): Promise<void> => {
    const rules = await db
      .select()
      .from(commissionRulesTable)
      .orderBy(desc(commissionRulesTable.priority));
    res.json(rules.map(serializeCommissionRule));
  },
);

router.post(
  "/admin/marketplace/commission-rules",
  requireStaffOrProfile,
  requirePermission("pricing"),
  async (req, res): Promise<void> => {
    const parsed = commissionRuleBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const actorProfileId = req.profile?.id ?? null;
    const [rule] = await db
      .insert(commissionRulesTable)
      .values({
        ...parsed.data,
        targetId: parsed.data.targetId ?? null,
        rate: String(parsed.data.rate),
        reason: parsed.data.reason ?? null,
        createdByProfileId: actorProfileId,
      })
      .returning();
    await recordMarketplaceAudit({
      actorProfileId,
      action: "commission_rule.create",
      entityType: "commission_rule",
      entityId: rule.id,
      after: serializeCommissionRule(rule),
      ip: req.ip,
    });
    res.status(201).json(serializeCommissionRule(rule));
  },
);

router.patch(
  "/admin/marketplace/commission-rules/:id",
  requireStaffOrProfile,
  requirePermission("pricing"),
  async (req, res): Promise<void> => {
    const rawId = Array.isArray(req.params.id)
      ? req.params.id[0]
      : req.params.id;
    const id = Number.parseInt(rawId, 10);
    const parsed = commissionRuleBody.partial().safeParse(req.body);
    if (!Number.isFinite(id) || !parsed.success) {
      res
        .status(400)
        .json({
          error: parsed.success ? "Invalid rule id" : parsed.error.message,
        });
      return;
    }
    const [before] = await db
      .select()
      .from(commissionRulesTable)
      .where(eq(commissionRulesTable.id, id));
    const updates: any = { ...parsed.data };
    if (parsed.data.rate != null) updates.rate = String(parsed.data.rate);
    if (parsed.data.targetId !== undefined)
      updates.targetId = parsed.data.targetId;
    const [rule] = await db
      .update(commissionRulesTable)
      .set(updates)
      .where(eq(commissionRulesTable.id, id))
      .returning();
    if (!rule) {
      res.status(404).json({ error: "Commission rule not found" });
      return;
    }
    const actorProfileId = req.profile?.id ?? null;
    await recordMarketplaceAudit({
      actorProfileId,
      action: "commission_rule.update",
      entityType: "commission_rule",
      entityId: id,
      before: before ? serializeCommissionRule(before) : null,
      after: serializeCommissionRule(rule),
      ip: req.ip,
    });
    res.json(serializeCommissionRule(rule));
  },
);

router.get(
  "/admin/marketplace/pricing-rules",
  requireStaffOrProfile,
  requirePermission("pricing"),
  async (_req, res): Promise<void> => {
    const rules = await db
      .select()
      .from(pricingRulesTable)
      .orderBy(desc(pricingRulesTable.priority));
    res.json(rules.map(serializePricingRule));
  },
);

router.post(
  "/admin/marketplace/pricing-rules",
  requireStaffOrProfile,
  requirePermission("pricing"),
  async (req, res): Promise<void> => {
    const parsed = pricingRuleBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const actorProfileId = req.profile?.id ?? null;
    const [rule] = await db
      .insert(pricingRulesTable)
      .values({
        ...parsed.data,
        value: String(parsed.data.value),
        targetKey: parsed.data.targetKey ?? null,
        minInput:
          parsed.data.minInput != null ? String(parsed.data.minInput) : null,
        maxInput:
          parsed.data.maxInput != null ? String(parsed.data.maxInput) : null,
        createdByProfileId: actorProfileId,
      })
      .returning();
    await recordMarketplaceAudit({
      actorProfileId,
      action: "pricing_rule.create",
      entityType: "pricing_rule",
      entityId: rule.id,
      after: serializePricingRule(rule),
      ip: req.ip,
    });
    res.status(201).json(serializePricingRule(rule));
  },
);

router.patch(
  "/admin/marketplace/pricing-rules/:id",
  requireStaffOrProfile,
  requirePermission("pricing"),
  async (req, res): Promise<void> => {
    const rawId = Array.isArray(req.params.id)
      ? req.params.id[0]
      : req.params.id;
    const id = Number.parseInt(rawId, 10);
    const parsed = pricingRuleBody.partial().safeParse(req.body);
    if (!Number.isFinite(id) || !parsed.success) {
      res
        .status(400)
        .json({
          error: parsed.success ? "Invalid rule id" : parsed.error.message,
        });
      return;
    }
    const [before] = await db
      .select()
      .from(pricingRulesTable)
      .where(eq(pricingRulesTable.id, id));
    const updates: any = { ...parsed.data };
    if (parsed.data.value != null) updates.value = String(parsed.data.value);
    if (parsed.data.minInput !== undefined)
      updates.minInput =
        parsed.data.minInput != null ? String(parsed.data.minInput) : null;
    if (parsed.data.maxInput !== undefined)
      updates.maxInput =
        parsed.data.maxInput != null ? String(parsed.data.maxInput) : null;
    const [rule] = await db
      .update(pricingRulesTable)
      .set(updates)
      .where(eq(pricingRulesTable.id, id))
      .returning();
    if (!rule) {
      res.status(404).json({ error: "Pricing rule not found" });
      return;
    }
    const actorProfileId = req.profile?.id ?? null;
    await recordMarketplaceAudit({
      actorProfileId,
      action: "pricing_rule.update",
      entityType: "pricing_rule",
      entityId: id,
      before: before ? serializePricingRule(before) : null,
      after: serializePricingRule(rule),
      ip: req.ip,
    });
    res.json(serializePricingRule(rule));
  },
);

router.post(
  "/marketplace/commission/preview",
  requireProfile,
  async (req, res): Promise<void> => {
    const parsed = commissionPreviewBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const profile = getRequestProfile(req);
    const commission = await resolveCommissionRule({
      customerId:
        parsed.data.customerId ??
        (profile.role === "customer" ? profile.id : null),
      vendorId:
        parsed.data.vendorId ??
        (profile.role === "provider" ? profile.id : null),
      projectId: parsed.data.projectId ?? null,
      emergency: parsed.data.emergency ?? false,
    });
    res.json({
      commission,
      amounts: computeMarketplaceAmounts(
        parsed.data.workAmount,
        commission.rate,
      ),
    });
  },
);

router.post(
  "/marketplace/quotes",
  requireProfile,
  async (req, res): Promise<void> => {
    const parsed = quoteBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const profile = getRequestProfile(req);
    const input = {
      ...parsed.data,
      customerId:
        parsed.data.customerId ??
        (profile.role === "customer" ? profile.id : null),
      vendorId:
        parsed.data.vendorId ??
        (profile.role === "provider" ? profile.id : null),
      emergency: parsed.data.emergencyDispatch ?? false,
    };
    try {
      const quote = await computeDynamicQuote(input);
      const [row] = await db
        .insert(marketplaceQuotesTable)
        .values({
          customerId: input.customerId ?? null,
          vendorId: input.vendorId ?? null,
          projectId: input.projectId ?? null,
          input,
          pricingBreakdown: quote.pricingBreakdown,
          commissionRuleId: quote.commissionRuleId,
          commissionRate: String(quote.commissionRate),
          vendorPayout: String(quote.vendorPayout),
          driverPayout: String(quote.driverPayout),
          platformCommission: String(quote.platformCommission),
          marketplaceRevenue: String(quote.marketplaceRevenue),
          platformProfit: String(quote.platformProfit),
          customerTotal: String(quote.customerTotal),
          gmv: String(quote.gmv),
          expiresAt: parsed.data.expiresAt ?? null,
        })
        .returning();
      await recordMarketplaceAudit({
        actorProfileId: profile.id,
        action: "marketplace_quote.create",
        entityType: "marketplace_quote",
        entityId: row.id,
        after: serializeQuote(row),
        ip: req.ip,
      });
      res.status(201).json({
        ...quote,
        id: row.id,
        status: row.status,
        expiresAt: row.expiresAt,
        createdAt: row.createdAt,
      });
    } catch (err: any) {
      res
        .status(409)
        .json({ error: err?.message ?? "Could not calculate quote" });
    }
  },
);

export default router;
