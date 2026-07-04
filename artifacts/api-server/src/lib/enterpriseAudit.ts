import { db, enterpriseAuditLogsTable } from "@workspace/db";
import { eq, desc, or } from "drizzle-orm";

export async function logEnterpriseAudit(input: {
  organizationId?: number | null;
  actorProfileId?: number | null;
  action: string;
  resourceType: string;
  resourceId?: string | number;
  details?: Record<string, unknown>;
  ipAddress?: string;
}) {
  await db.insert(enterpriseAuditLogsTable).values({
    organizationId: input.organizationId ?? null,
    actorProfileId: input.actorProfileId ?? null,
    action: input.action,
    resourceType: input.resourceType,
    resourceId: input.resourceId != null ? String(input.resourceId) : null,
    details: JSON.stringify(input.details ?? {}),
    ipAddress: input.ipAddress ?? null,
  });
}

export async function listAuditLogs(orgId: number | null, profileId: number, limit = 50) {
  const rows = await db.select()
    .from(enterpriseAuditLogsTable)
    .where(orgId
      ? eq(enterpriseAuditLogsTable.organizationId, orgId)
      : eq(enterpriseAuditLogsTable.actorProfileId, profileId))
    .orderBy(desc(enterpriseAuditLogsTable.createdAt))
    .limit(limit);
  return rows.map((r) => ({
    id: r.id,
    action: r.action,
    resourceType: r.resourceType,
    resourceId: r.resourceId,
    details: safeJson(r.details ?? "{}"),
    createdAt: r.createdAt.toISOString(),
  }));
}

function safeJson(raw: string) {
  try { return JSON.parse(raw); } catch { return {}; }
}
