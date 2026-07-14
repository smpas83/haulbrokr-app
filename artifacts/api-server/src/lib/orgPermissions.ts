import type { Profile } from "@workspace/db";
import { isOrgManager } from "./access";

/** Org-level permissions for company administration. */
export type OrgPermission =
  | "manage_company"
  | "manage_members"
  | "manage_roles"
  | "manage_fleet"
  | "dispatch_jobs"
  | "view_compliance"
  | "invite_drivers"
  | "invite_customers"
  | "view_billing";

const ROLE_PERMISSIONS: Record<string, OrgPermission[]> = {
  owner: [
    "manage_company",
    "manage_members",
    "manage_roles",
    "manage_fleet",
    "dispatch_jobs",
    "view_compliance",
    "invite_drivers",
    "invite_customers",
    "view_billing",
  ],
  admin: [
    "manage_company",
    "manage_members",
    "manage_roles",
    "manage_fleet",
    "dispatch_jobs",
    "view_compliance",
    "invite_drivers",
    "invite_customers",
    "view_billing",
  ],
  fleet_manager: [
    "manage_fleet",
    "dispatch_jobs",
    "view_compliance",
    "invite_drivers",
  ],
  dispatcher: ["dispatch_jobs", "view_compliance", "invite_drivers"],
  member: [],
};

export const ASSIGNABLE_ORG_ROLES = [
  "admin",
  "member",
  "fleet_manager",
  "dispatcher",
] as const;
export type AssignableOrgRole = (typeof ASSIGNABLE_ORG_ROLES)[number];

export function orgPermissionsFor(profile: Profile): OrgPermission[] {
  if (profile.orgRole && ROLE_PERMISSIONS[profile.orgRole]) {
    return ROLE_PERMISSIONS[profile.orgRole];
  }
  // Base customer/provider accounts are treated as owners of their company.
  if (profile.role === "customer" || profile.role === "provider") {
    return ROLE_PERMISSIONS.owner;
  }
  return [];
}

export function hasOrgPermission(
  profile: Profile,
  permission: OrgPermission,
): boolean {
  return orgPermissionsFor(profile).includes(permission);
}

/** Owners, admins, and base customer/provider accounts may manage the company. */
export function canManageCompany(profile: Profile): boolean {
  return hasOrgPermission(profile, "manage_company") || isOrgManager(profile);
}

export function canManageMembers(profile: Profile): boolean {
  return hasOrgPermission(profile, "manage_members") || isOrgManager(profile);
}

export function canDispatch(profile: Profile): boolean {
  return hasOrgPermission(profile, "dispatch_jobs") || isOrgManager(profile);
}

export function canManageFleet(profile: Profile): boolean {
  return hasOrgPermission(profile, "manage_fleet") || isOrgManager(profile);
}

export function isAssignableOrgRole(value: string): value is AssignableOrgRole {
  return (ASSIGNABLE_ORG_ROLES as readonly string[]).includes(value);
}

export function classifyMemberAudience(profile: Profile): {
  isFleetManager: boolean;
  isDispatcher: boolean;
  isDriver: boolean;
  isCustomer: boolean;
  isSupervisor: boolean;
} {
  return {
    isFleetManager:
      profile.orgRole === "fleet_manager" ||
      profile.orgRole === "owner" ||
      (profile.orgRole === "admin" && profile.role === "provider"),
    isDispatcher:
      profile.orgRole === "dispatcher" || profile.orgRole === "admin",
    isDriver: profile.role === "driver",
    isCustomer: profile.role === "customer",
    isSupervisor: profile.role === "supervisor",
  };
}
