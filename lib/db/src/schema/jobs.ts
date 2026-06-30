import { pgTable, text, serial, timestamp, integer, numeric, pgEnum, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { profilesTable } from "./profiles";
import { requestsTable } from "./requests";
import { bidsTable } from "./bids";
import { projectsTable } from "./projects";
import { truckTypeEnum } from "./trucks";

export const jobStatusEnum = pgEnum("job_status", [
  "active",
  "awarded",
  "accepted",
  "declined",
  "cancelled",
  "in_progress",
  "completed",
]);

export const jobCompletionApprovalEnum = pgEnum("job_completion_approval", ["pending", "approved", "flagged"]);

export const jobPaymentStatusEnum = pgEnum("job_payment_status", [
  "unpaid", "invoiced", "paid", "released", "failed", "requires_action",
]);

export const jobsTable = pgTable("jobs", {
  id: serial("id").primaryKey(),
  requestId: integer("request_id").notNull().references(() => requestsTable.id),
  bidId: integer("bid_id").notNull().references(() => bidsTable.id),
  customerId: integer("customer_id").notNull().references(() => profilesTable.id),
  providerId: integer("provider_id").notNull().references(() => profilesTable.id),
  projectId: integer("project_id").references(() => projectsTable.id),
  ratePerHour: numeric("rate_per_hour", { precision: 10, scale: 2 }).notNull(),
  trucksAssigned: integer("trucks_assigned").notNull().default(1),
  status: jobStatusEnum("status").notNull().default("active"),
  materialType: text("material_type").notNull(),
  truckType: truckTypeEnum("truck_type").notNull().default("dump_truck"),
  pickupAddress: text("pickup_address").notNull(),
  deliveryAddress: text("delivery_address").notNull(),
  scheduledDate: timestamp("scheduled_date", { withTimezone: true }).notNull(),
  startTime: text("start_time").notNull().default("08:00"),
  estimatedHours: numeric("estimated_hours", { precision: 8, scale: 2 }).notNull().default("8"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  totalHours: numeric("total_hours", { precision: 8, scale: 2 }),
  totalAmount: numeric("total_amount", { precision: 12, scale: 2 }),
  // ── Broker-fee revenue model (15% taken before the driver is paid) ──
  platformFeeRate: numeric("platform_fee_rate", { precision: 5, scale: 4 }).notNull().default("0.15"),
  platformFeeAmount: numeric("platform_fee_amount", { precision: 12, scale: 2 }),
  customerTotalAmount: numeric("customer_total_amount", { precision: 12, scale: 2 }),
  providerNetAmount: numeric("provider_net_amount", { precision: 12, scale: 2 }),
  paymentStatus: jobPaymentStatusEnum("payment_status").notNull().default("unpaid"),
  paymentDueDate: timestamp("payment_due_date", { withTimezone: true }),
  invoicedAt: timestamp("invoiced_at", { withTimezone: true }),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  releasedAt: timestamp("released_at", { withTimezone: true }),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  stripeTransferId: text("stripe_transfer_id"),
  // Number of settlement attempts made for this job. Incremented on every
  // charge/release attempt so each retry uses a fresh Stripe idempotency key
  // (otherwise Stripe replays the previously declined intent).
  paymentAttempts: integer("payment_attempts").notNull().default(0),
  // Consecutive transfer-leg failures while the payout has been stuck in
  // `requires_action`. Incremented by the retry sweep on each failed transfer
  // and reset to 0 on a successful release. Used to alert admins after repeated
  // failures (see payoutRetry.ts).
  payoutRetryFailures: integer("payout_retry_failures").notNull().default(0),
  // When the "this payout keeps failing" admin alert was last sent for this job.
  // Set once the failure count crosses the alert threshold so admins are not
  // spammed every sweep; cleared on a successful release.
  payoutAlertSentAt: timestamp("payout_alert_sent_at", { withTimezone: true }),
  completionApproval: jobCompletionApprovalEnum("completion_approval"),
  approvedByProfileId: integer("approved_by_profile_id").references(() => profilesTable.id),
  completionApprovedAt: timestamp("completion_approved_at", { withTimezone: true }),
  flagReason: text("flag_reason"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  index("jobs_customer_status_idx").on(table.customerId, table.status),
  index("jobs_provider_status_idx").on(table.providerId, table.status),
  index("jobs_payment_status_idx").on(table.paymentStatus),
]);

export const insertJobSchema = createInsertSchema(jobsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertJob = z.infer<typeof insertJobSchema>;
export type Job = typeof jobsTable.$inferSelect;
