import type { Request, Response, NextFunction } from "express";
import { db, profilesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

// HaulBrokr internal staff roles + the capabilities each one unlocks on the
// admin command center. The named roles are:
//   - CEO        — sees everything (Overview + all review tabs + bin orders) and
//                  can VIEW the team roster, but cannot make staff-role edits.
//   - President  — same executive visibility as CEO (Overview + reviews + bins + team roster).
//   - Programmer — technical superadmin (same as CTO / IT).
//   - CFO        — all finance (payouts/credit/compliance) + bin orders + staff
//                  management + Overview.
//   - Accounting — combined former AP/AR scope (payouts/credit/compliance) + Overview,
//                  no staff management and no bin-order operations.
// `ap`/`ar` are legacy enum values kept for backward compatibility: they resolve
// to the Accounting scope so existing staff keep working. They are never offered
// when assigning a role (see ASSIGNABLE_ROLES).
export type StaffRole =
  | "ap"
  | "ar"
  | "cfo"
  | "cto"
  | "ceo"
  | "accounting"
  | "it"
  | "president"
  | "programmer";
export type Permission =
  | "overview"
  | "payouts"
  | "credit"
  | "compliance"
  | "bins"
  | "view_staff"
  | "manage_staff";

// The finance/review scope shared by every role (Overview + the three review areas).
const REVIEW_SCOPE: Permission[] = ["overview", "payouts", "credit", "compliance"];

// `bins` is bin-order fulfillment/operations — an operational, non-finance scope.
// It is intentionally NOT held by the finance roles: Accounting (ap/ar/accounting)
// is finance-only, and CFO is finance + staff management (no operational bins).
// Only the org head (CEO) and the technical superadmins (CTO/IT) hold it.
export const ROLE_PERMISSIONS: Record<StaffRole, Permission[]> = {
  // Legacy roles → Accounting scope (back-compat): finance review only, no bins.
  ap: [...REVIEW_SCOPE],
  ar: [...REVIEW_SCOPE],
  accounting: [...REVIEW_SCOPE],
  // CEO: full visibility incl. bins + read-only team roster, no staff edits.
  ceo: [...REVIEW_SCOPE, "bins", "view_staff"],
  // President: executive visibility incl. bins + read-only team roster.
  president: [...REVIEW_SCOPE, "bins", "view_staff"],
  // CFO: finance review + full staff management, but NO operational bins.
  cfo: [...REVIEW_SCOPE, "view_staff", "manage_staff"],
  // Technical superadmins: review scope + bins + full staff management.
  cto: [...REVIEW_SCOPE, "bins", "view_staff", "manage_staff"],
  it: [...REVIEW_SCOPE, "bins", "view_staff", "manage_staff"],
  programmer: [...REVIEW_SCOPE, "bins", "view_staff", "manage_staff"],
};

export const STAFF_ROLES: StaffRole[] = [
  "ap", "ar", "cfo", "cto", "ceo", "accounting", "it", "president", "programmer",
];

export const ASSIGNABLE_ROLES: StaffRole[] = [
  "ceo", "president", "cto", "cfo", "accounting", "it", "programmer",
];

function isStaffRole(value: unknown): value is StaffRole {
  return typeof value === "string" && (STAFF_ROLES as string[]).includes(value);
}

// Whether the configured allowlist (ADMIN_USER_IDS) treats this request as a
// bootstrap superadmin. When no allowlist is configured we grant superadmin
// outside production so the demo/dev flow can exercise the admin dashboard —
// never a self-serve hole in prod.
function isAllowlistedSuperadmin(req: Request): boolean {
  const allowlist = (process.env.ADMIN_USER_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  // When an explicit allowlist is configured, only those Clerk IDs bootstrap
  // superadmin. This is the intended production path: set ADMIN_USER_IDS to the
  // first admin's Clerk user ID, then assign the rest from the Team tab.
  if (allowlist.length > 0) {
    const clerkId = req.clerkId;
    return !!clerkId && allowlist.includes(clerkId);
  }

  // No allowlist configured. Outside production we grant superadmin so the
  // dev/test/demo flow can exercise the admin dashboard without seeding a
  // staffRole first. In production with no allowlist we never auto-grant —
  // access then comes solely from a real staff session (staffRole column).
  return process.env.NODE_ENV !== "production";
}

// Resolve the effective staff role for a request. Allowlisted/dev superadmins
// are treated as "cto" (full access) so they can bootstrap the team by
// assigning roles to other staff. Otherwise the role comes from the profile's
// staffRole column. Returns null for non-staff.
export async function getStaffRole(req: Request): Promise<StaffRole | null> {
  if (req.staffUser?.staffRole && isStaffRole(req.staffUser.staffRole)) {
    return req.staffUser.staffRole;
  }
  if (isAllowlistedSuperadmin(req)) return "cto";
  // Prefer a profile already attached by requireProfile to avoid a re-query.
  const attached = req.profile;
  if (attached && isStaffRole(attached.staffRole)) return attached.staffRole;
  if (attached && attached.staffRole == null) return null;
  const clerkId = req.clerkId;
  if (!clerkId) return null;
  const [profile] = await db
    .select({ staffRole: profilesTable.staffRole })
    .from(profilesTable)
    .where(eq(profilesTable.clerkId, clerkId));
  return isStaffRole(profile?.staffRole) ? profile.staffRole : null;
}

export async function getPermissions(req: Request): Promise<Permission[]> {
  const role = await getStaffRole(req);
  return role ? ROLE_PERMISSIONS[role] : [];
}

export async function hasPermission(req: Request, permission: Permission): Promise<boolean> {
  const perms = await getPermissions(req);
  return perms.includes(permission);
}

// Backwards-compatible "is this user staff at all" check. True when the request
// resolves to any staff role (i.e. has at least one permission).
export async function isAdmin(req: Request): Promise<boolean> {
  return (await getStaffRole(req)) != null;
}

// Middleware: require any staff role. Kept for endpoints that any staff member
// may read (e.g. the access flag). Prefer requirePermission for actions.
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  isAdmin(req)
    .then((ok) => {
      if (!ok) {
        res.status(403).json({ error: "Admin access required." });
        return;
      }
      next();
    })
    .catch(next);
}

// Middleware factory: require a specific staff permission.
export function requirePermission(permission: Permission) {
  return (req: Request, res: Response, next: NextFunction): void => {
    hasPermission(req, permission)
      .then((ok) => {
        if (!ok) {
          res.status(403).json({ error: `Missing required permission: ${permission}.` });
          return;
        }
        next();
      })
      .catch(next);
  };
}
