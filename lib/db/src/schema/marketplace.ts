import {
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { profilesTable } from "./profiles";
import { projectsTable } from "./projects";
import { jobsTable } from "./jobs";

export const commissionRuleScopeEnum = pgEnum("commission_rule_scope", [
  "global",
  "customer",
  "vendor",
  "project",
  "emergency",
]);

export const pricingRuleCodeEnum = pgEnum("pricing_rule_code", [
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
]);

export const pricingValueTypeEnum = pgEnum("pricing_value_type", [
  "fixed_amount",
  "percent",
  "multiplier",
]);

export const quoteStatusEnum = pgEnum("marketplace_quote_status", [
  "quoted",
  "accepted",
  "expired",
  "cancelled",
]);

export const paymentTransactionKindEnum = pgEnum("payment_transaction_kind", [
  "checkout",
  "charge",
  "transfer",
  "refund",
  "application_fee",
]);

export const paymentTransactionStatusEnum = pgEnum(
  "payment_transaction_status",
  ["pending", "succeeded", "failed", "cancelled"],
);

export const invoiceStatusEnum = pgEnum("marketplace_invoice_status", [
  "draft",
  "open",
  "paid",
  "void",
  "overdue",
]);

export const refundStatusEnum = pgEnum("marketplace_refund_status", [
  "pending",
  "succeeded",
  "failed",
]);

export const payoutTransferStatusEnum = pgEnum("payout_transfer_status", [
  "pending",
  "paid",
  "failed",
  "reversed",
]);

export const commissionRulesTable = pgTable(
  "commission_rules",
  {
    id: serial("id").primaryKey(),
    scope: commissionRuleScopeEnum("scope").notNull().default("global"),
    targetId: integer("target_id"),
    rate: numeric("rate", { precision: 5, scale: 4 }).notNull(),
    priority: integer("priority").notNull().default(0),
    active: integer("active").notNull().default(1),
    reason: text("reason"),
    createdByProfileId: integer("created_by_profile_id").references(
      () => profilesTable.id,
    ),
    effectiveFrom: timestamp("effective_from", { withTimezone: true })
      .notNull()
      .defaultNow(),
    effectiveTo: timestamp("effective_to", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    activeScopeIdx: index("commission_rules_active_scope_idx").on(
      table.active,
      table.scope,
    ),
    targetIdx: index("commission_rules_target_idx").on(
      table.scope,
      table.targetId,
    ),
  }),
);

export const pricingRulesTable = pgTable(
  "pricing_rules",
  {
    id: serial("id").primaryKey(),
    code: pricingRuleCodeEnum("code").notNull(),
    label: text("label").notNull(),
    valueType: pricingValueTypeEnum("value_type").notNull(),
    value: numeric("value", { precision: 12, scale: 4 }).notNull(),
    targetKey: text("target_key"),
    minInput: numeric("min_input", { precision: 12, scale: 4 }),
    maxInput: numeric("max_input", { precision: 12, scale: 4 }),
    priority: integer("priority").notNull().default(0),
    active: integer("active").notNull().default(1),
    createdByProfileId: integer("created_by_profile_id").references(
      () => profilesTable.id,
    ),
    effectiveFrom: timestamp("effective_from", { withTimezone: true })
      .notNull()
      .defaultNow(),
    effectiveTo: timestamp("effective_to", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    activeCodeIdx: index("pricing_rules_active_code_idx").on(
      table.active,
      table.code,
    ),
    targetIdx: index("pricing_rules_target_idx").on(
      table.code,
      table.targetKey,
    ),
  }),
);

export const marketplaceQuotesTable = pgTable(
  "marketplace_quotes",
  {
    id: serial("id").primaryKey(),
    customerId: integer("customer_id").references(() => profilesTable.id),
    vendorId: integer("vendor_id").references(() => profilesTable.id),
    projectId: integer("project_id").references(() => projectsTable.id),
    jobId: integer("job_id").references(() => jobsTable.id),
    status: quoteStatusEnum("status").notNull().default("quoted"),
    input: jsonb("input").notNull(),
    pricingBreakdown: jsonb("pricing_breakdown").notNull(),
    commissionRuleId: integer("commission_rule_id").references(
      () => commissionRulesTable.id,
    ),
    commissionRate: numeric("commission_rate", {
      precision: 5,
      scale: 4,
    }).notNull(),
    vendorPayout: numeric("vendor_payout", {
      precision: 12,
      scale: 2,
    }).notNull(),
    driverPayout: numeric("driver_payout", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    platformCommission: numeric("platform_commission", {
      precision: 12,
      scale: 2,
    }).notNull(),
    marketplaceRevenue: numeric("marketplace_revenue", {
      precision: 12,
      scale: 2,
    }).notNull(),
    platformProfit: numeric("platform_profit", {
      precision: 12,
      scale: 2,
    }).notNull(),
    customerTotal: numeric("customer_total", {
      precision: 12,
      scale: 2,
    }).notNull(),
    gmv: numeric("gmv", { precision: 12, scale: 2 }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    customerIdx: index("marketplace_quotes_customer_idx").on(
      table.customerId,
      table.createdAt,
    ),
    jobIdx: index("marketplace_quotes_job_idx").on(table.jobId),
  }),
);

export const marketplaceAuditLogsTable = pgTable(
  "marketplace_audit_logs",
  {
    id: serial("id").primaryKey(),
    actorProfileId: integer("actor_profile_id").references(
      () => profilesTable.id,
    ),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    before: jsonb("before"),
    after: jsonb("after"),
    metadata: jsonb("metadata"),
    stripeEventId: text("stripe_event_id"),
    ip: text("ip"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    entityIdx: index("marketplace_audit_entity_idx").on(
      table.entityType,
      table.entityId,
    ),
    createdAtIdx: index("marketplace_audit_created_at_idx").on(table.createdAt),
  }),
);

export const paymentTransactionsTable = pgTable(
  "payment_transactions",
  {
    id: serial("id").primaryKey(),
    jobId: integer("job_id").references(() => jobsTable.id),
    kind: paymentTransactionKindEnum("kind").notNull(),
    status: paymentTransactionStatusEnum("status").notNull().default("pending"),
    amountCents: integer("amount_cents").notNull(),
    currency: text("currency").notNull().default("usd"),
    stripePaymentIntentId: text("stripe_payment_intent_id"),
    stripeChargeId: text("stripe_charge_id"),
    stripeTransferId: text("stripe_transfer_id"),
    stripeRefundId: text("stripe_refund_id"),
    stripeCheckoutSessionId: text("stripe_checkout_session_id"),
    idempotencyKey: text("idempotency_key"),
    attempt: integer("attempt").notNull().default(1),
    failureCode: text("failure_code"),
    failureMessage: text("failure_message"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    jobIdx: index("payment_transactions_job_idx").on(table.jobId),
    paymentIntentIdx: index("payment_transactions_pi_idx").on(
      table.stripePaymentIntentId,
    ),
    transferIdx: index("payment_transactions_transfer_idx").on(
      table.stripeTransferId,
    ),
    idempotencyIdx: uniqueIndex("payment_transactions_idempotency_idx").on(
      table.idempotencyKey,
    ),
  }),
);

export const stripeWebhookEventsTable = pgTable("stripe_webhook_events", {
  id: serial("id").primaryKey(),
  stripeEventId: text("stripe_event_id").notNull().unique(),
  eventType: text("event_type").notNull(),
  payload: jsonb("payload"),
  handled: integer("handled").notNull().default(0),
  handleResult: text("handle_result"),
  receivedAt: timestamp("received_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const invoicesTable = pgTable("invoices", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id")
    .notNull()
    .unique()
    .references(() => jobsTable.id),
  invoiceNumber: text("invoice_number").notNull().unique(),
  status: invoiceStatusEnum("status").notNull().default("draft"),
  subtotal: numeric("subtotal", { precision: 12, scale: 2 }).notNull(),
  platformFeeAmount: numeric("platform_fee_amount", {
    precision: 12,
    scale: 2,
  }).notNull(),
  totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).notNull(),
  dueDate: timestamp("due_date", { withTimezone: true }),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  externalRef: text("external_ref"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const refundsTable = pgTable(
  "refunds",
  {
    id: serial("id").primaryKey(),
    jobId: integer("job_id").references(() => jobsTable.id),
    paymentTransactionId: integer("payment_transaction_id").references(
      () => paymentTransactionsTable.id,
    ),
    amountCents: integer("amount_cents").notNull(),
    reason: text("reason"),
    stripeRefundId: text("stripe_refund_id").unique(),
    status: refundStatusEnum("status").notNull().default("pending"),
    initiatedByProfileId: integer("initiated_by_profile_id").references(
      () => profilesTable.id,
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    jobIdx: index("refunds_job_idx").on(table.jobId),
  }),
);

export const payoutTransfersTable = pgTable(
  "payout_transfers",
  {
    id: serial("id").primaryKey(),
    jobId: integer("job_id").references(() => jobsTable.id),
    providerProfileId: integer("provider_profile_id").references(
      () => profilesTable.id,
    ),
    stripeAccountId: text("stripe_account_id"),
    stripeTransferId: text("stripe_transfer_id").unique(),
    amountCents: integer("amount_cents").notNull(),
    status: payoutTransferStatusEnum("status").notNull().default("pending"),
    sourceChargeId: text("source_charge_id"),
    attempt: integer("attempt").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    releasedAt: timestamp("released_at", { withTimezone: true }),
  },
  (table) => ({
    jobIdx: index("payout_transfers_job_idx").on(table.jobId),
    providerIdx: index("payout_transfers_provider_idx").on(
      table.providerProfileId,
      table.status,
    ),
  }),
);

export const insertCommissionRuleSchema = createInsertSchema(
  commissionRulesTable,
).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPricingRuleSchema = createInsertSchema(
  pricingRulesTable,
).omit({ id: true, createdAt: true, updatedAt: true });
export const insertMarketplaceQuoteSchema = createInsertSchema(
  marketplaceQuotesTable,
).omit({ id: true, createdAt: true, updatedAt: true });

export type CommissionRule = typeof commissionRulesTable.$inferSelect;
export type InsertCommissionRule = z.infer<typeof insertCommissionRuleSchema>;
export type PricingRule = typeof pricingRulesTable.$inferSelect;
export type InsertPricingRule = z.infer<typeof insertPricingRuleSchema>;
export type MarketplaceQuote = typeof marketplaceQuotesTable.$inferSelect;
export type InsertMarketplaceQuote = z.infer<
  typeof insertMarketplaceQuoteSchema
>;
