import { db, enterpriseReportsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { logEnterpriseAudit } from "./enterpriseAudit";

interface ProfileCtx {
  id: number;
  organizationId: number | null;
}

export const REPORT_TEMPLATES = [
  { key: "revenue_summary", name: "Revenue Summary", metrics: ["revenue", "margin", "monthRevenue"] },
  { key: "fleet_utilization", name: "Fleet Utilization", metrics: ["utilization", "available", "maintenanceDue"] },
  { key: "compliance_status", name: "Compliance Status", metrics: ["complianceScore", "expiringDocs"] },
  { key: "customer_aging", name: "Customer Aging", metrics: ["accountsReceivable", "outstandingInvoices"] },
  { key: "load_profitability", name: "Load Profitability", metrics: ["profitabilityByLoad", "profitabilityByRegion"] },
] as const;

export async function listReports(profileId: number) {
  const rows = await db.select()
    .from(enterpriseReportsTable)
    .where(eq(enterpriseReportsTable.profileId, profileId))
    .orderBy(desc(enterpriseReportsTable.updatedAt));
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    config: safeJson(r.config),
    scheduleCron: r.scheduleCron,
    shared: r.shared,
    lastRunAt: r.lastRunAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function saveReport(profile: ProfileCtx, input: { name: string; description?: string; config: Record<string, unknown>; scheduleCron?: string; shared?: boolean }) {
  const [row] = await db.insert(enterpriseReportsTable).values({
    organizationId: profile.organizationId,
    profileId: profile.id,
    name: input.name,
    description: input.description,
    config: JSON.stringify(input.config),
    scheduleCron: input.scheduleCron,
    shared: input.shared ?? false,
  }).returning();

  await logEnterpriseAudit({
    organizationId: profile.organizationId,
    actorProfileId: profile.id,
    action: "report.save",
    resourceType: "report",
    resourceId: row!.id,
  });

  return { id: row!.id, name: row!.name };
}

export async function runReport(reportId: number, profileId: number, data: Record<string, unknown>) {
  const [report] = await db.select().from(enterpriseReportsTable).where(eq(enterpriseReportsTable.id, reportId));
  if (!report || report.profileId !== profileId) return null;

  await db.update(enterpriseReportsTable)
    .set({ lastRunAt: new Date() })
    .where(eq(enterpriseReportsTable.id, reportId));

  const config = safeJson(report.config);
  return {
    reportId,
    name: report.name,
    generatedAt: new Date().toISOString(),
    format: "json",
    data,
    config,
    exportFormats: ["pdf", "csv", "xlsx"],
  };
}

export function exportReportCsv(data: Record<string, unknown>): string {
  const rows: string[] = ["key,value"];
  for (const [k, v] of Object.entries(data)) {
    rows.push(`${k},${JSON.stringify(v)}`);
  }
  return rows.join("\n");
}

function safeJson(raw: string) {
  try { return JSON.parse(raw) as Record<string, unknown>; } catch { return {}; }
}
