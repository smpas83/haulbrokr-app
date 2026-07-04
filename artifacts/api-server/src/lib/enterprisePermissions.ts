import type { Request } from "express";
import { db, enterpriseRolePermissionsTable, profilesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { getRequestProfile } from "../middlewares/requireAuth";

export type EnterprisePermission =
  | "workflows_view" | "workflows_manage"
  | "tasks_view" | "tasks_manage"
  | "documents_view" | "documents_manage"
  | "finance_view" | "finance_manage"
  | "reports_view" | "reports_manage"
  | "settings_view" | "settings_manage"
  | "scorecards_view"
  | "audit_view";

const DEFAULT_ROLE_PERMISSIONS: Record<string, EnterprisePermission[]> = {
  owner: [
    "workflows_view", "workflows_manage", "tasks_view", "tasks_manage",
    "documents_view", "documents_manage", "finance_view", "finance_manage",
    "reports_view", "reports_manage", "settings_view", "settings_manage",
    "scorecards_view", "audit_view",
  ],
  admin: [
    "workflows_view", "workflows_manage", "tasks_view", "tasks_manage",
    "documents_view", "documents_manage", "finance_view", "finance_manage",
    "reports_view", "reports_manage", "settings_view", "scorecards_view", "audit_view",
  ],
  member: [
    "workflows_view", "tasks_view", "tasks_manage", "documents_view",
    "finance_view", "reports_view", "scorecards_view",
  ],
  driver: ["tasks_view", "tasks_manage", "documents_view"],
  supervisor: [
    "workflows_view", "tasks_view", "tasks_manage", "documents_view", "scorecards_view",
  ],
};

export async function getOrgPermissions(orgId: number | null, orgRole: string | null, userRole: string): Promise<EnterprisePermission[]> {
  const role = orgRole ?? (userRole === "driver" ? "driver" : userRole === "supervisor" ? "supervisor" : "member");

  if (!orgId) {
    return DEFAULT_ROLE_PERMISSIONS.owner ?? DEFAULT_ROLE_PERMISSIONS.member!;
  }

  const rows = await db.select()
    .from(enterpriseRolePermissionsTable)
    .where(and(
      eq(enterpriseRolePermissionsTable.organizationId, orgId),
      eq(enterpriseRolePermissionsTable.orgRole, role),
    ));

  if (rows.length > 0) {
    return rows.map((r) => r.permission as EnterprisePermission);
  }

  return DEFAULT_ROLE_PERMISSIONS[role] ?? DEFAULT_ROLE_PERMISSIONS.member!;
}

export async function hasEnterprisePermission(req: Request, permission: EnterprisePermission): Promise<boolean> {
  const profile = getRequestProfile(req);
  const perms = await getOrgPermissions(profile.organizationId ?? null, profile.orgRole ?? null, profile.role);
  if (profile.orgRole === "owner" || profile.role === "customer" || profile.role === "provider") {
    if (!profile.organizationId && (profile.role === "customer" || profile.role === "provider")) {
      return true;
    }
  }
  return perms.includes(permission);
}

export function requireEnterprisePermission(permission: EnterprisePermission) {
  return async (req: Request, res: import("express").Response, next: import("express").NextFunction) => {
    const ok = await hasEnterprisePermission(req, permission);
    if (!ok) {
      res.status(403).json({ error: `Missing permission: ${permission}` });
      return;
    }
    next();
  };
}

export async function seedDefaultPermissions(orgId: number) {
  for (const [role, perms] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
    for (const permission of perms) {
      const [existing] = await db.select()
        .from(enterpriseRolePermissionsTable)
        .where(and(
          eq(enterpriseRolePermissionsTable.organizationId, orgId),
          eq(enterpriseRolePermissionsTable.orgRole, role),
          eq(enterpriseRolePermissionsTable.permission, permission as EnterprisePermission),
        ))
        .limit(1);
      if (!existing) {
        await db.insert(enterpriseRolePermissionsTable)
          .values({ organizationId: orgId, orgRole: role, permission: permission as EnterprisePermission });
      }
    }
  }
}
