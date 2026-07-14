import { describe, it, expect } from "vitest";
import {
  orgPermissionsFor,
  hasOrgPermission,
  canManageFleet,
  canDispatch,
  isAssignableOrgRole,
  classifyMemberAudience,
} from "./orgPermissions";
import type { Profile } from "@workspace/db";

function profile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: 1,
    clerkId: "c1",
    role: "provider",
    companyName: "Acme",
    contactName: "A",
    phone: null,
    email: null,
    address: null,
    city: null,
    state: null,
    zip: null,
    organizationId: 5,
    orgRole: "owner",
    staffRole: null,
    dba: null,
    website: null,
    mcNumber: null,
    capacityTons: null,
    capacityYards: null,
    countiesServed: null,
    hourlyRate: null,
    minimumHours: null,
    equipmentTypes: null,
    billingEinLast4: null,
    apContactName: null,
    apEmail: null,
    paymentTerms: null,
    stripeCustomerId: null,
    lastDocReminderAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Profile;
}

describe("orgPermissions", () => {
  it("grants owners full company permissions", () => {
    const perms = orgPermissionsFor(profile({ orgRole: "owner" }));
    expect(perms).toContain("manage_company");
    expect(perms).toContain("manage_fleet");
    expect(perms).toContain("dispatch_jobs");
  });

  it("scopes fleet managers to fleet + dispatch", () => {
    const p = profile({ orgRole: "fleet_manager", role: "provider" });
    expect(hasOrgPermission(p, "manage_fleet")).toBe(true);
    expect(hasOrgPermission(p, "dispatch_jobs")).toBe(true);
    expect(hasOrgPermission(p, "manage_company")).toBe(false);
    expect(canManageFleet(p)).toBe(true);
  });

  it("allows dispatchers to dispatch but not manage company", () => {
    const p = profile({ orgRole: "dispatcher", role: "provider" });
    expect(canDispatch(p)).toBe(true);
    expect(hasOrgPermission(p, "manage_members")).toBe(false);
  });

  it("treats base customer/provider accounts as owners", () => {
    const p = profile({ orgRole: null, role: "customer" });
    expect(hasOrgPermission(p, "manage_company")).toBe(true);
  });

  it("validates assignable roles", () => {
    expect(isAssignableOrgRole("fleet_manager")).toBe(true);
    expect(isAssignableOrgRole("owner")).toBe(false);
  });

  it("classifies audience roles", () => {
    expect(classifyMemberAudience(profile({ role: "driver", orgRole: "member" })).isDriver).toBe(true);
    expect(classifyMemberAudience(profile({ orgRole: "dispatcher" })).isDispatcher).toBe(true);
    expect(classifyMemberAudience(profile({ orgRole: "fleet_manager" })).isFleetManager).toBe(true);
  });
});
