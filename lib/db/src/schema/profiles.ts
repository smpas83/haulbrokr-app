import { pgTable, text, serial, timestamp, pgEnum, integer, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const userRoleEnum = pgEnum("user_role", ["customer", "provider", "driver", "supervisor"]);

export const paymentTermsEnum = pgEnum("payment_terms", ["due_on_receipt", "net_15", "net_30", "prepaid"]);

export const orgRoleEnum = pgEnum("org_role", ["owner", "admin", "member"]);

// HaulBrokr internal staff roles. A profile with a non-null staffRole is a
// HaulBrokr employee with admin-dashboard access scoped to that role's
// permissions. Null = not staff. Distinct from userRole (customer/provider/
// driver/supervisor) and orgRole (owner/admin/member of a customer/provider org).
//
// The named roles are ceo, cto, cfo, accounting, and it. `ap`/`ar` are legacy
// values kept for backward compatibility — existing records resolve to the
// Accounting scope (see ROLE_PERMISSIONS in requireAdmin.ts) and are never
// offered when assigning a role.
export const staffRoleEnum = pgEnum("staff_role", [
  "ap", "ar", "cfo", "cto", "ceo", "accounting", "it", "president", "programmer",
]);

export const profilesTable = pgTable("profiles", {
  id: serial("id").primaryKey(),
  clerkId: text("clerk_id").notNull().unique(),
  role: userRoleEnum("role").notNull(),
  companyName: text("company_name").notNull(),
  contactName: text("contact_name"),
  phone: text("phone"),
  email: text("email"),
  address: text("address"),
  city: text("city"),
  state: text("state"),
  zip: text("zip"),
  organizationId: integer("organization_id"),
  orgRole: orgRoleEnum("org_role"),
  // HaulBrokr internal staff role (null = not a staff member). Grants
  // permission-scoped access to the admin dashboard.
  staffRole: staffRoleEnum("staff_role"),
  // Carrier — company details
  dba: text("dba"),
  website: text("website"),
  mcNumber: text("mc_number"),
  // Carrier — capacity profile
  capacityTons: numeric("capacity_tons", { precision: 10, scale: 2 }),
  capacityYards: numeric("capacity_yards", { precision: 10, scale: 2 }),
  countiesServed: text("counties_served"),
  hourlyRate: numeric("hourly_rate", { precision: 10, scale: 2 }),
  minimumHours: numeric("minimum_hours", { precision: 6, scale: 2 }),
  equipmentTypes: text("equipment_types"),
  // Customer — billing details
  billingEinLast4: text("billing_ein_last4"),
  apContactName: text("ap_contact_name"),
  apEmail: text("ap_email"),
  paymentTerms: paymentTermsEnum("payment_terms"),
  // Stripe Customer id (cus_…) for this profile's billing. Created the first time
  // the customer captures a card via SetupIntent; saved cards attach to it and
  // settlement charges them off-session.
  stripeCustomerId: text("stripe_customer_id"),
  // Last time a "missing documents" reminder email was sent to this profile.
  lastDocReminderAt: timestamp("last_doc_reminder_at", { withTimezone: true }),
  // Last time staff opened this carrier in the Admin Onboarding Center.
  lastAdminOnboardingViewAt: timestamp("last_admin_onboarding_view_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertProfileSchema = createInsertSchema(profilesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertProfile = z.infer<typeof insertProfileSchema>;
export type Profile = typeof profilesTable.$inferSelect;
