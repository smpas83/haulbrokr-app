import { Router, type IRouter } from "express";
import { and, desc, eq, inArray, lt, sql } from "drizzle-orm";
import {
  activityTable,
  commissionRulesTable,
  db,
  invoicesTable,
  jobStatusUpdatesTable,
  jobsTable,
  marketplaceQuotesTable,
  paymentTransactionsTable,
  pricingRulesTable,
  refundsTable,
  trucksTable,
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
import { loadJobIfMember } from "../lib/access";
import { getUncachableStripeClient } from "../lib/stripeClient";
import {
  moneyToCents,
  recordPaymentTransaction,
} from "../lib/marketplacePayments";
import { computeDocumentStatus } from "../lib/documentStatus";

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

const refundBody = z.object({
  amountCents: z.number().int().positive().optional(),
  reason: z.string().min(1).max(500).nullable().optional(),
});

const activityQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.coerce.number().int().positive().optional(),
  type: z.string().min(1).optional(),
});

const fleetAvailabilityQuery = z.object({
  providerId: z.coerce.number().int().positive().optional(),
  truckType: z.string().min(1).optional(),
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

function serializeTransaction(row: any) {
  return {
    ...row,
    amount: Math.round(row.amountCents) / 100,
  };
}

function serializeInvoice(row: any) {
  return {
    ...row,
    subtotal: num(row.subtotal),
    platformFeeAmount: num(row.platformFeeAmount),
    totalAmount: num(row.totalAmount),
  };
}

function serializeRefund(row: any) {
  return {
    ...row,
    amount: Math.round(row.amountCents) / 100,
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
      res.status(400).json({
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
      res.status(400).json({
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

router.get(
  "/marketplace/jobs/:id/transactions",
  requireProfile,
  async (req, res): Promise<void> => {
    const profile = getRequestProfile(req);
    const rawId = Array.isArray(req.params.id)
      ? req.params.id[0]
      : req.params.id;
    const jobId = Number.parseInt(rawId, 10);
    if (!Number.isFinite(jobId)) {
      res.status(400).json({ error: "Invalid job id" });
      return;
    }
    const job = await loadJobIfMember(jobId, profile);
    if (!job) {
      res.status(404).json({ error: "Job not found" });
      return;
    }
    const rows = await db
      .select()
      .from(paymentTransactionsTable)
      .where(eq(paymentTransactionsTable.jobId, job.id))
      .orderBy(desc(paymentTransactionsTable.createdAt));
    res.json(rows.map(serializeTransaction));
  },
);

router.get(
  "/marketplace/invoices",
  requireProfile,
  async (req, res): Promise<void> => {
    const profile = getRequestProfile(req);
    const rows = await db
      .select()
      .from(invoicesTable)
      .where(
        sql`${invoicesTable.jobId} in (
        select id from jobs
        where customer_id = ${profile.id} or provider_id = ${profile.id}
      )`,
      )
      .orderBy(desc(invoicesTable.createdAt));
    res.json(rows.map(serializeInvoice));
  },
);

router.get(
  "/marketplace/invoices/:id",
  requireProfile,
  async (req, res): Promise<void> => {
    const profile = getRequestProfile(req);
    const rawId = Array.isArray(req.params.id)
      ? req.params.id[0]
      : req.params.id;
    const id = Number.parseInt(rawId, 10);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: "Invalid invoice id" });
      return;
    }
    const [invoice] = await db
      .select()
      .from(invoicesTable)
      .where(eq(invoicesTable.id, id));
    if (!invoice) {
      res.status(404).json({ error: "Invoice not found" });
      return;
    }
    const job = await loadJobIfMember(invoice.jobId, profile);
    if (!job) {
      res.status(404).json({ error: "Invoice not found" });
      return;
    }
    res.json(serializeInvoice(invoice));
  },
);

router.post(
  "/marketplace/jobs/:id/refunds",
  requireProfile,
  async (req, res): Promise<void> => {
    const profile = getRequestProfile(req);
    const rawId = Array.isArray(req.params.id)
      ? req.params.id[0]
      : req.params.id;
    const jobId = Number.parseInt(rawId, 10);
    const parsed = refundBody.safeParse(req.body ?? {});
    if (!Number.isFinite(jobId) || !parsed.success) {
      res.status(400).json({
        error: parsed.success ? "Invalid job id" : parsed.error.message,
      });
      return;
    }
    const job = await loadJobIfMember(jobId, profile);
    if (!job) {
      res.status(404).json({ error: "Job not found" });
      return;
    }
    if (job.customerId !== profile.id && !profile.staffRole) {
      res
        .status(403)
        .json({ error: "Only the customer or staff can refund this job." });
      return;
    }
    const grossCents = moneyToCents(job.customerTotalAmount);
    if (!grossCents || grossCents <= 0) {
      res.status(409).json({ error: "Job has no refundable customer total." });
      return;
    }
    const amountCents = parsed.data.amountCents ?? grossCents;
    if (amountCents > grossCents) {
      res
        .status(400)
        .json({ error: "Refund amount cannot exceed the customer total." });
      return;
    }
    if (!job.stripePaymentIntentId && !job.stripeChargeId) {
      res
        .status(409)
        .json({ error: "No Stripe payment is stored for this job." });
      return;
    }
    const stripe = await getUncachableStripeClient();
    const refund = await stripe.refunds.create(
      {
        amount: amountCents,
        ...(job.stripeChargeId
          ? { charge: job.stripeChargeId }
          : { payment_intent: job.stripePaymentIntentId! }),
        metadata: {
          jobId: String(job.id),
          initiatedByProfileId: String(profile.id),
        },
        ...(parsed.data.reason
          ? { reason: "requested_by_customer" as const }
          : {}),
      },
      { idempotencyKey: `job-refund:${job.id}:${amountCents}` },
    );
    await recordPaymentTransaction({
      jobId: job.id,
      kind: "refund",
      status: refund.status === "succeeded" ? "succeeded" : "pending",
      amountCents,
      stripePaymentIntentId: job.stripePaymentIntentId,
      stripeChargeId: job.stripeChargeId,
      stripeRefundId: refund.id,
      idempotencyKey: `job-refund:${job.id}:${amountCents}`,
      metadata: { reason: parsed.data.reason ?? null },
    });
    const [row] = await db
      .insert(refundsTable)
      .values({
        jobId: job.id,
        amountCents,
        reason: parsed.data.reason ?? null,
        stripeRefundId: refund.id,
        status: refund.status === "succeeded" ? "succeeded" : "pending",
        initiatedByProfileId: profile.id,
      })
      .returning();
    res.status(201).json(serializeRefund(row));
  },
);

router.get(
  "/marketplace/fleet-availability",
  requireProfile,
  async (req, res): Promise<void> => {
    const parsed = fleetAvailabilityQuery.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const conditions = [eq(trucksTable.isAvailable, true)];
    if (parsed.data.providerId)
      conditions.push(eq(trucksTable.ownerId, parsed.data.providerId));
    if (parsed.data.truckType)
      conditions.push(eq(trucksTable.truckType, parsed.data.truckType as any));
    const rows = await db
      .select({
        truckType: trucksTable.truckType,
        availableTrucks: sql<number>`count(*)`,
      })
      .from(trucksTable)
      .where(and(...conditions))
      .groupBy(trucksTable.truckType);
    const totalAvailable = rows.reduce(
      (sum, row) => sum + Number(row.availableTrucks ?? 0),
      0,
    );
    res.json({ totalAvailable, byTruckType: rows });
  },
);

router.get(
  "/marketplace/notifications",
  requireProfile,
  async (req, res): Promise<void> => {
    const profile = getRequestProfile(req);
    const parsed = activityQuery.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const conditions = [eq(activityTable.profileId, profile.id)];
    if (parsed.data.cursor)
      conditions.push(lt(activityTable.id, parsed.data.cursor));
    if (parsed.data.type)
      conditions.push(eq(activityTable.type, parsed.data.type as any));
    const rows = await db
      .select()
      .from(activityTable)
      .where(and(...conditions))
      .orderBy(desc(activityTable.createdAt))
      .limit(parsed.data.limit);
    res.json({
      items: rows,
      nextCursor:
        rows.length === parsed.data.limit ? (rows.at(-1)?.id ?? null) : null,
    });
  },
);

router.get(
  "/marketplace/jobs/:id/trips",
  requireProfile,
  async (req, res): Promise<void> => {
    const profile = getRequestProfile(req);
    const rawId = Array.isArray(req.params.id)
      ? req.params.id[0]
      : req.params.id;
    const jobId = Number.parseInt(rawId, 10);
    if (!Number.isFinite(jobId)) {
      res.status(400).json({ error: "Invalid job id" });
      return;
    }
    const job = await loadJobIfMember(jobId, profile);
    if (!job) {
      res.status(404).json({ error: "Job not found" });
      return;
    }
    const rows = await db
      .select()
      .from(jobStatusUpdatesTable)
      .where(eq(jobStatusUpdatesTable.jobId, job.id))
      .orderBy(desc(jobStatusUpdatesTable.createdAt));
    res.json({ jobId: job.id, status: job.status, timeline: rows });
  },
);

router.get(
  "/marketplace/document-status",
  requireProfile,
  async (req, res): Promise<void> => {
    const profile = getRequestProfile(req);
    res.json(await computeDocumentStatus(profile));
  },
);

export default router;
