import { pgTable, text, serial, timestamp, integer, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { profilesTable } from "./profiles";
import { verificationStatusEnum } from "./w9";

export const accountTypeEnum = pgEnum("bank_account_type", ["checking", "savings"]);

export const payoutAccountsTable = pgTable("payout_accounts", {
  id: serial("id").primaryKey(),
  profileId: integer("profile_id").notNull().unique().references(() => profilesTable.id, { onDelete: "cascade" }),
  bankName: text("bank_name").notNull().default(""),
  accountHolderName: text("account_holder_name").notNull().default(""),
  accountType: accountTypeEnum("account_type").notNull().default("checking"),
  routingLast4: text("routing_last4").notNull().default(""),
  accountLast4: text("account_last4").notNull().default(""),
  status: verificationStatusEnum("payout_status").notNull().default("pending"),
  stripeAccountId: text("stripe_account_id"),
  chargesEnabled: integer("charges_enabled").notNull().default(0),
  payoutsEnabled: integer("payouts_enabled").notNull().default(0),
  detailsSubmitted: integer("details_submitted").notNull().default(0),
  // Last Connect bank payout observed via Stripe webhooks
  lastPayoutId: text("last_payout_id"),
  lastPayoutStatus: text("last_payout_status"),
  lastPayoutAmount: text("last_payout_amount"),
  lastPayoutAt: timestamp("last_payout_at", { withTimezone: true }),
  lastPayoutFailureCode: text("last_payout_failure_code"),
  lastPayoutFailureMessage: text("last_payout_failure_message"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertPayoutAccountSchema = createInsertSchema(payoutAccountsTable).omit({ id: true, createdAt: true, updatedAt: true, status: true });
export type InsertPayoutAccount = z.infer<typeof insertPayoutAccountSchema>;
export type PayoutAccount = typeof payoutAccountsTable.$inferSelect;
