import {
  pgTable,
  text,
  serial,
  timestamp,
  integer,
  pgEnum,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { profilesTable } from "./profiles";

export const paymentMethodTypeEnum = pgEnum("payment_method_type", [
  "credit_card",
  "ach",
  "net_15",
  "net_30",
  "net_45",
]);

export const paymentMethodsTable = pgTable("payment_methods", {
  id: serial("id").primaryKey(),
  profileId: integer("profile_id")
    .notNull()
    .unique()
    .references(() => profilesTable.id, { onDelete: "cascade" }),
  methodType: paymentMethodTypeEnum("method_type").notNull(),
  // Stripe PaymentMethod id (pm_…) captured via SetupIntent. When set, this is a
  // real off-session-chargeable instrument; the card_* columns below are just
  // descriptive metadata mirrored from Stripe for display.
  stripePaymentMethodId: text("stripe_payment_method_id"),
  // Stripe SetupIntent id (seti_…) for the saved instrument. Retained for ACH so
  // a customer can finish micro-deposit verification later (verifyMicrodeposits).
  stripeSetupIntentId: text("stripe_setup_intent_id"),
  // Verification state of the saved instrument. null = nothing to verify (cards,
  // net terms, instantly-verified ACH); "pending" = ACH awaiting micro-deposit
  // confirmation (not yet chargeable); "verified" = ACH confirmed and chargeable.
  verificationStatus: text("verification_status"),
  cardBrand: text("card_brand"),
  cardLast4: text("card_last4"),
  cardExpMonth: text("card_exp_month"),
  cardExpYear: text("card_exp_year"),
  cardholderName: text("cardholder_name"),
  bankName: text("bank_name"),
  accountLast4: text("account_last4"),
  routingLast4: text("routing_last4"),
  billingAddress: text("billing_address"),
  billingCity: text("billing_city"),
  billingState: text("billing_state"),
  billingZip: text("billing_zip"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertPaymentMethodSchema = createInsertSchema(
  paymentMethodsTable,
).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPaymentMethod = z.infer<typeof insertPaymentMethodSchema>;
export type PaymentMethod = typeof paymentMethodsTable.$inferSelect;
