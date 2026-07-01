import { boolean, integer, numeric, pgEnum, pgTable, serial, text, timestamp, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { jobsTable } from "./jobs";
import { profilesTable } from "./profiles";

export const connectedAccountStatusEnum = pgEnum("connected_account_status", [
  "not_started",
  "pending",
  "verified",
  "restricted",
  "rejected",
]);

export const vendorPayoutStatusEnum = pgEnum("vendor_payout_status", [
  "pending",
  "approved",
  "paid",
  "failed",
  "cancelled",
  "partial",
]);

export const driverEarningStatusEnum = pgEnum("driver_earning_status", [
  "pending",
  "available",
  "paid",
  "adjusted",
  "cancelled",
]);

export const paymentHistoryStatusEnum = pgEnum("payment_history_status", [
  "pending",
  "requires_action",
  "succeeded",
  "failed",
  "refunded",
  "partially_refunded",
  "disputed",
  "reconciled",
]);

export const paymentHistoryTypeEnum = pgEnum("payment_history_type", [
  "payment_intent",
  "charge",
  "checkout",
  "invoice",
  "transfer",
  "payout",
  "refund",
  "chargeback",
  "manual_adjustment",
  "reconciliation",
]);

export const refundStatusEnum = pgEnum("refund_status", [
  "pending",
  "succeeded",
  "failed",
  "cancelled",
]);

export const reviewModerationStatusEnum = pgEnum("review_moderation_status", [
  "visible",
  "flagged",
  "removed",
]);

export const notificationChannelEnum = pgEnum("notification_channel", [
  "email",
  "sms",
  "push",
  "in_app",
]);

export const notificationStatusEnum = pgEnum("notification_status", [
  "queued",
  "sent",
  "failed",
  "cancelled",
]);

export const invoiceStatusEnum = pgEnum("invoice_status", [
  "draft",
  "issued",
  "paid",
  "partially_refunded",
  "refunded",
  "void",
]);

export const stripeConnectedAccountsTable = pgTable("stripe_connected_accounts", {
  id: serial("id").primaryKey(),
  profileId: integer("profile_id").notNull().unique().references(() => profilesTable.id, { onDelete: "cascade" }),
  stripeAccountId: text("stripe_account_id").notNull().unique(),
  status: connectedAccountStatusEnum("status").notNull().default("pending"),
  chargesEnabled: boolean("charges_enabled").notNull().default(false),
  payoutsEnabled: boolean("payouts_enabled").notNull().default(false),
  detailsSubmitted: boolean("details_submitted").notNull().default(false),
  verificationStatus: text("verification_status"),
  requirementsJson: text("requirements_json"),
  payoutSchedule: text("payout_schedule").notNull().default("standard"),
  instantPayoutsEligible: boolean("instant_payouts_eligible").notNull().default(false),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const vendorPayoutsTable = pgTable("vendor_payouts", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id").notNull().references(() => jobsTable.id, { onDelete: "cascade" }),
  vendorProfileId: integer("vendor_profile_id").notNull().references(() => profilesTable.id),
  driverProfileId: integer("driver_profile_id").references(() => profilesTable.id),
  grossAmount: numeric("gross_amount", { precision: 12, scale: 2 }).notNull(),
  platformFeeAmount: numeric("platform_fee_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  netAmount: numeric("net_amount", { precision: 12, scale: 2 }).notNull(),
  paidAmount: numeric("paid_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  status: vendorPayoutStatusEnum("status").notNull().default("pending"),
  stripeTransferId: text("stripe_transfer_id"),
  stripePayoutId: text("stripe_payout_id"),
  failureReason: text("failure_reason"),
  adjustmentReason: text("adjustment_reason"),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => ({
  jobVendorUnique: unique("vendor_payouts_job_vendor_unique").on(table.jobId, table.vendorProfileId),
}));

export const driverWalletTable = pgTable("driver_wallet", {
  id: serial("id").primaryKey(),
  driverProfileId: integer("driver_profile_id").notNull().unique().references(() => profilesTable.id, { onDelete: "cascade" }),
  pendingBalance: numeric("pending_balance", { precision: 12, scale: 2 }).notNull().default("0"),
  availableBalance: numeric("available_balance", { precision: 12, scale: 2 }).notNull().default("0"),
  paidOutBalance: numeric("paid_out_balance", { precision: 12, scale: 2 }).notNull().default("0"),
  lifetimeEarnings: numeric("lifetime_earnings", { precision: 12, scale: 2 }).notNull().default("0"),
  lastCalculatedAt: timestamp("last_calculated_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const driverEarningsTable = pgTable("driver_earnings", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id").notNull().references(() => jobsTable.id, { onDelete: "cascade" }),
  driverProfileId: integer("driver_profile_id").notNull().references(() => profilesTable.id),
  vendorProfileId: integer("vendor_profile_id").notNull().references(() => profilesTable.id),
  grossEarnings: numeric("gross_earnings", { precision: 12, scale: 2 }).notNull(),
  platformFees: numeric("platform_fees", { precision: 12, scale: 2 }).notNull().default("0"),
  fuelAdjustments: numeric("fuel_adjustments", { precision: 12, scale: 2 }).notNull().default("0"),
  bonuses: numeric("bonuses", { precision: 12, scale: 2 }).notNull().default("0"),
  tips: numeric("tips", { precision: 12, scale: 2 }).notNull().default("0"),
  netEarnings: numeric("net_earnings", { precision: 12, scale: 2 }).notNull(),
  status: driverEarningStatusEnum("status").notNull().default("pending"),
  earnedAt: timestamp("earned_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => ({
  jobDriverUnique: unique("driver_earnings_job_driver_unique").on(table.jobId, table.driverProfileId),
}));

export const paymentHistoryTable = pgTable("payment_history", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id").references(() => jobsTable.id, { onDelete: "set null" }),
  customerProfileId: integer("customer_profile_id").references(() => profilesTable.id),
  vendorProfileId: integer("vendor_profile_id").references(() => profilesTable.id),
  type: paymentHistoryTypeEnum("type").notNull(),
  status: paymentHistoryStatusEnum("status").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull().default("0"),
  platformFeeAmount: numeric("platform_fee_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  currency: text("currency").notNull().default("usd"),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  stripeChargeId: text("stripe_charge_id"),
  stripeTransferId: text("stripe_transfer_id"),
  stripeRefundId: text("stripe_refund_id"),
  stripeDisputeId: text("stripe_dispute_id"),
  eventType: text("event_type").notNull(),
  metadataJson: text("metadata_json"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const refundHistoryTable = pgTable("refund_history", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id").notNull().references(() => jobsTable.id, { onDelete: "cascade" }),
  paymentHistoryId: integer("payment_history_id").references(() => paymentHistoryTable.id, { onDelete: "set null" }),
  customerProfileId: integer("customer_profile_id").notNull().references(() => profilesTable.id),
  vendorProfileId: integer("vendor_profile_id").notNull().references(() => profilesTable.id),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("usd"),
  reason: text("reason"),
  status: refundStatusEnum("status").notNull().default("pending"),
  stripeRefundId: text("stripe_refund_id"),
  requestedByProfileId: integer("requested_by_profile_id").references(() => profilesTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const reviewHistoryTable = pgTable("review_history", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id").notNull().references(() => jobsTable.id, { onDelete: "cascade" }),
  ratingId: integer("rating_id"),
  raterProfileId: integer("rater_profile_id").notNull().references(() => profilesTable.id),
  rateeProfileId: integer("ratee_profile_id").notNull().references(() => profilesTable.id),
  subjectType: text("subject_type").notNull().default("profile"),
  stars: integer("stars").notNull(),
  comment: text("comment"),
  moderationStatus: reviewModerationStatusEnum("moderation_status").notNull().default("visible"),
  removedByProfileId: integer("removed_by_profile_id").references(() => profilesTable.id),
  removedReason: text("removed_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const reviewFlagsTable = pgTable("review_flags", {
  id: serial("id").primaryKey(),
  reviewHistoryId: integer("review_history_id").notNull().references(() => reviewHistoryTable.id, { onDelete: "cascade" }),
  flaggedByProfileId: integer("flagged_by_profile_id").notNull().references(() => profilesTable.id),
  reason: text("reason").notNull(),
  status: text("status").notNull().default("open"),
  resolvedByProfileId: integer("resolved_by_profile_id").references(() => profilesTable.id),
  resolutionNote: text("resolution_note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
});

export const reviewStatsTable = pgTable("review_stats", {
  id: serial("id").primaryKey(),
  profileId: integer("profile_id").notNull().unique().references(() => profilesTable.id, { onDelete: "cascade" }),
  averageRating: numeric("average_rating", { precision: 4, scale: 2 }).notNull().default("0"),
  reviewCount: integer("review_count").notNull().default(0),
  completedJobs: integer("completed_jobs").notNull().default(0),
  responseRate: numeric("response_rate", { precision: 5, scale: 2 }).notNull().default("0"),
  cancellationRate: numeric("cancellation_rate", { precision: 5, scale: 2 }).notNull().default("0"),
  repeatCustomerPercentage: numeric("repeat_customer_percentage", { precision: 5, scale: 2 }).notNull().default("0"),
  flaggedReviewCount: integer("flagged_review_count").notNull().default(0),
  lastCalculatedAt: timestamp("last_calculated_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const notificationQueueTable = pgTable("notification_queue", {
  id: serial("id").primaryKey(),
  profileId: integer("profile_id").references(() => profilesTable.id, { onDelete: "cascade" }),
  eventType: text("event_type").notNull(),
  channel: notificationChannelEnum("channel").notNull(),
  subject: text("subject"),
  body: text("body").notNull(),
  relatedJobId: integer("related_job_id").references(() => jobsTable.id, { onDelete: "set null" }),
  status: notificationStatusEnum("status").notNull().default("queued"),
  scheduledFor: timestamp("scheduled_for", { withTimezone: true }).notNull().defaultNow(),
  attempts: integer("attempts").notNull().default(0),
  maxAttempts: integer("max_attempts").notNull().default(3),
  lastError: text("last_error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const notificationDeliveryTable = pgTable("notification_delivery", {
  id: serial("id").primaryKey(),
  notificationId: integer("notification_id").notNull().references(() => notificationQueueTable.id, { onDelete: "cascade" }),
  channel: notificationChannelEnum("channel").notNull(),
  status: notificationStatusEnum("status").notNull(),
  providerMessageId: text("provider_message_id"),
  error: text("error"),
  attemptedAt: timestamp("attempted_at", { withTimezone: true }).notNull().defaultNow(),
});

export const invoiceDocumentsTable = pgTable("invoice_documents", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id").notNull().references(() => jobsTable.id, { onDelete: "cascade" }),
  customerProfileId: integer("customer_profile_id").notNull().references(() => profilesTable.id),
  invoiceNumber: text("invoice_number").notNull().unique(),
  status: invoiceStatusEnum("status").notNull().default("issued"),
  subtotalAmount: numeric("subtotal_amount", { precision: 12, scale: 2 }).notNull(),
  platformFeeAmount: numeric("platform_fee_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).notNull(),
  amountPaid: numeric("amount_paid", { precision: 12, scale: 2 }).notNull().default("0"),
  amountRefunded: numeric("amount_refunded", { precision: 12, scale: 2 }).notNull().default("0"),
  dueAt: timestamp("due_at", { withTimezone: true }),
  pdfUrl: text("pdf_url"),
  issuedAt: timestamp("issued_at", { withTimezone: true }).notNull().defaultNow(),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertStripeConnectedAccountSchema = createInsertSchema(stripeConnectedAccountsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertStripeConnectedAccount = z.infer<typeof insertStripeConnectedAccountSchema>;
export type StripeConnectedAccount = typeof stripeConnectedAccountsTable.$inferSelect;

export const insertVendorPayoutSchema = createInsertSchema(vendorPayoutsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertVendorPayout = z.infer<typeof insertVendorPayoutSchema>;
export type VendorPayout = typeof vendorPayoutsTable.$inferSelect;

export const insertDriverWalletSchema = createInsertSchema(driverWalletTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertDriverWallet = z.infer<typeof insertDriverWalletSchema>;
export type DriverWallet = typeof driverWalletTable.$inferSelect;

export const insertDriverEarningSchema = createInsertSchema(driverEarningsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertDriverEarning = z.infer<typeof insertDriverEarningSchema>;
export type DriverEarning = typeof driverEarningsTable.$inferSelect;

export const insertPaymentHistorySchema = createInsertSchema(paymentHistoryTable).omit({ id: true, createdAt: true });
export type InsertPaymentHistory = z.infer<typeof insertPaymentHistorySchema>;
export type PaymentHistory = typeof paymentHistoryTable.$inferSelect;

export const insertRefundHistorySchema = createInsertSchema(refundHistoryTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertRefundHistory = z.infer<typeof insertRefundHistorySchema>;
export type RefundHistory = typeof refundHistoryTable.$inferSelect;

export const insertReviewHistorySchema = createInsertSchema(reviewHistoryTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertReviewHistory = z.infer<typeof insertReviewHistorySchema>;
export type ReviewHistory = typeof reviewHistoryTable.$inferSelect;

export const insertNotificationQueueSchema = createInsertSchema(notificationQueueTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertNotificationQueue = z.infer<typeof insertNotificationQueueSchema>;
export type NotificationQueue = typeof notificationQueueTable.$inferSelect;

export const insertInvoiceDocumentSchema = createInsertSchema(invoiceDocumentsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertInvoiceDocument = z.infer<typeof insertInvoiceDocumentSchema>;
export type InvoiceDocument = typeof invoiceDocumentsTable.$inferSelect;
