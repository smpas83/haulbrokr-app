import {
  pgTable,
  text,
  serial,
  timestamp,
  integer,
  numeric,
  pgEnum,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { jobsTable } from "./jobs";
import { profilesTable } from "./profiles";

export const refundStatusEnum = pgEnum("refund_status", [
  "pending",
  "succeeded",
  "failed",
  "canceled",
]);

export const paymentRefundsTable = pgTable(
  "payment_refunds",
  {
    id: serial("id").primaryKey(),
    jobId: integer("job_id")
      .notNull()
      .references(() => jobsTable.id),
    stripeRefundId: text("stripe_refund_id").notNull(),
    stripePaymentIntentId: text("stripe_payment_intent_id").notNull(),
    stripeChargeId: text("stripe_charge_id").notNull(),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    reason: text("reason"),
    status: refundStatusEnum("status").notNull().default("pending"),
    createdByProfileId: integer("created_by_profile_id").references(
      () => profilesTable.id,
    ),
    createdByStaffUsername: text("created_by_staff_username"),
    idempotencyKey: text("idempotency_key").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("payment_refunds_stripe_refund_id_idx").on(
      table.stripeRefundId,
    ),
    uniqueIndex("payment_refunds_idempotency_key_idx").on(table.idempotencyKey),
  ],
);

export const insertPaymentRefundSchema = createInsertSchema(
  paymentRefundsTable,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertPaymentRefund = z.infer<typeof insertPaymentRefundSchema>;
export type PaymentRefund = typeof paymentRefundsTable.$inferSelect;
