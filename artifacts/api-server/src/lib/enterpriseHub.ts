import type { ProfileCtx } from "./operationsInsights";
import { buildOperationsCenter } from "./operationsInsights";
import { buildAutonomousLayer } from "./autonomousStatus";
import { listWorkflows, syncComplianceWorkflows, WORKFLOW_TEMPLATES } from "./workflowEngine";
import { listTasks, getOverdueTasks, syncAiTasks } from "./taskEngine";
import { aggregateDocuments, getExpiringDocuments } from "./documentCenter";
import { getScorecards } from "./scorecards";
import { getFinanceCenter, getFleetManagement } from "./financeCenter";
import { listReports, REPORT_TEMPLATES } from "./reportBuilder";
import { getSettings } from "./enterpriseSettings";
import { listAuditLogs } from "./enterpriseAudit";
import { getOrgPermissions } from "./enterprisePermissions";

export async function buildEnterpriseHub(profile: ProfileCtx & { organizationId: number | null; orgRole: string | null }) {
  const ctx = { id: profile.id, organizationId: profile.organizationId, role: profile.role };

  const [ops, autonomous, workflows, tasks, overdueTasks, documents, expiringDocs, scorecards, finance, fleet, reports, settings, audit, permissions] =
    await Promise.all([
      buildOperationsCenter(profile),
      buildAutonomousLayer(profile),
      listWorkflows({ id: profile.id, organizationId: profile.organizationId }),
      listTasks({ id: profile.id, organizationId: profile.organizationId }),
      getOverdueTasks(profile.id),
      aggregateDocuments({ id: profile.id, organizationId: profile.organizationId }),
      getExpiringDocuments(profile.id),
      getScorecards(ctx),
      getFinanceCenter(ctx),
      getFleetManagement(ctx),
      listReports(profile.id),
      getSettings(profile.organizationId, profile.id),
      listAuditLogs(profile.organizationId, profile.id, 20),
      getOrgPermissions(profile.organizationId, profile.orgRole, profile.role),
    ]);

  if (ops.complianceWarnings.length > 0) {
    await syncComplianceWorkflows({ id: profile.id, organizationId: profile.organizationId }, ops.complianceWarnings.map((w) => w.title));
  }
  if (autonomous.pendingApprovals.length > 0) {
    await syncAiTasks(
      { id: profile.id, organizationId: profile.organizationId },
      autonomous.pendingApprovals.map((r) => ({ id: r.id, title: r.title, priority: r.priority })),
    );
  }

  return {
    workflows: { items: workflows, templates: WORKFLOW_TEMPLATES },
    tasks: { items: tasks, overdue: overdueTasks },
    documents: { items: documents, expiring: expiringDocs },
    scorecards,
    finance,
    fleet,
    reports: { saved: reports, templates: REPORT_TEMPLATES },
    settings,
    audit,
    permissions,
    operations: {
      businessHealth: autonomous.businessHealth,
      executiveDigest: autonomous.executiveDigest,
    },
    updatedAt: new Date().toISOString(),
  };
}
