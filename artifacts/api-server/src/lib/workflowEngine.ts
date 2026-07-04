import {
  db,
  enterpriseWorkflowsTable,
  enterpriseWorkflowEventsTable,
} from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { logEnterpriseAudit } from "./enterpriseAudit";

export const WORKFLOW_TEMPLATES = {
  customer_onboarding: { title: "New Customer Onboarding", slaHours: 72, priority: "high" as const },
  vendor_approval: { title: "Vendor Approval", slaHours: 48, priority: "high" as const },
  driver_onboarding: { title: "Driver Onboarding", slaHours: 48, priority: "medium" as const },
  insurance_verification: { title: "Insurance Verification", slaHours: 24, priority: "critical" as const },
  w9_approval: { title: "W-9 Approval", slaHours: 24, priority: "high" as const },
  coi_approval: { title: "COI Approval", slaHours: 24, priority: "high" as const },
  dot_verification: { title: "DOT Verification", slaHours: 48, priority: "high" as const },
  load_approval: { title: "Load Approval", slaHours: 4, priority: "critical" as const },
  invoice_approval: { title: "Invoice Approval", slaHours: 24, priority: "high" as const },
  payment_approval: { title: "Payment Approval", slaHours: 24, priority: "high" as const },
  dispute_resolution: { title: "Dispute Resolution", slaHours: 72, priority: "critical" as const },
  maintenance_request: { title: "Maintenance Request", slaHours: 48, priority: "medium" as const },
  equipment_inspection: { title: "Equipment Inspection", slaHours: 168, priority: "medium" as const },
} as const;

export type WorkflowTemplateKey = keyof typeof WORKFLOW_TEMPLATES;

interface ProfileCtx {
  id: number;
  organizationId: number | null;
}

export async function listWorkflows(profile: ProfileCtx) {
  const rows = await db.select()
    .from(enterpriseWorkflowsTable)
    .where(eq(enterpriseWorkflowsTable.profileId, profile.id))
    .orderBy(desc(enterpriseWorkflowsTable.updatedAt))
    .limit(100);
  return rows.map(serializeWorkflow);
}

export async function createWorkflow(
  profile: ProfileCtx,
  input: {
    templateKey: WorkflowTemplateKey;
    title?: string;
    ownerProfileId?: number;
    relatedEntityType?: string;
    relatedEntityId?: number;
    priority?: "critical" | "high" | "medium" | "low";
  },
) {
  const tmpl = WORKFLOW_TEMPLATES[input.templateKey];
  const slaHours = tmpl.slaHours;
  const dueAt = new Date(Date.now() + slaHours * 3600000);

  const [row] = await db.insert(enterpriseWorkflowsTable).values({
    organizationId: profile.organizationId,
    profileId: profile.id,
    templateKey: input.templateKey,
    title: input.title ?? tmpl.title,
    priority: input.priority ?? tmpl.priority,
    ownerProfileId: input.ownerProfileId ?? profile.id,
    slaHours,
    dueAt,
    relatedEntityType: input.relatedEntityType,
    relatedEntityId: input.relatedEntityId,
  }).returning();

  await db.insert(enterpriseWorkflowEventsTable).values({
    workflowId: row!.id,
    actorProfileId: profile.id,
    eventType: "created",
    comment: `Workflow started from template ${input.templateKey}`,
  });

  await logEnterpriseAudit({
    organizationId: profile.organizationId,
    actorProfileId: profile.id,
    action: "workflow.create",
    resourceType: "workflow",
    resourceId: row!.id,
  });

  return serializeWorkflow(row!);
}

export async function addWorkflowComment(
  profileId: number,
  workflowId: number,
  comment: string,
  attachmentPath?: string,
) {
  const [wf] = await db.select().from(enterpriseWorkflowsTable).where(eq(enterpriseWorkflowsTable.id, workflowId));
  if (!wf || wf.profileId !== profileId) return null;

  await db.insert(enterpriseWorkflowEventsTable).values({
    workflowId,
    actorProfileId: profileId,
    eventType: "comment",
    comment,
    attachmentPath,
  });

  return getWorkflowAudit(workflowId);
}

export async function updateWorkflowStatus(profileId: number, workflowId: number, status: string) {
  const [wf] = await db.select().from(enterpriseWorkflowsTable).where(eq(enterpriseWorkflowsTable.id, workflowId));
  if (!wf || wf.profileId !== profileId) return null;

  const [updated] = await db.update(enterpriseWorkflowsTable)
    .set({ status: status as typeof wf.status, updatedAt: new Date() })
    .where(eq(enterpriseWorkflowsTable.id, workflowId))
    .returning();

  await db.insert(enterpriseWorkflowEventsTable).values({
    workflowId,
    actorProfileId: profileId,
    eventType: "status_change",
    comment: `Status changed to ${status}`,
  });

  return serializeWorkflow(updated!);
}

export async function getWorkflowAudit(workflowId: number) {
  return db.select()
    .from(enterpriseWorkflowEventsTable)
    .where(eq(enterpriseWorkflowEventsTable.workflowId, workflowId))
    .orderBy(desc(enterpriseWorkflowEventsTable.createdAt));
}

function serializeWorkflow(row: typeof enterpriseWorkflowsTable.$inferSelect) {
  return {
    id: row.id,
    templateKey: row.templateKey,
    title: row.title,
    status: row.status,
    priority: row.priority,
    ownerProfileId: row.ownerProfileId,
    slaHours: row.slaHours,
    dueAt: row.dueAt?.toISOString() ?? null,
    relatedEntityType: row.relatedEntityType,
    relatedEntityId: row.relatedEntityId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function syncComplianceWorkflows(profile: ProfileCtx, issues: string[]) {
  const created = [];
  for (const issue of issues) {
    let key: WorkflowTemplateKey = "insurance_verification";
    if (issue.includes("W-9")) key = "w9_approval";
    else if (issue.includes("COI")) key = "coi_approval";
    else if (issue.includes("DOT")) key = "dot_verification";

    const [existing] = await db.select()
      .from(enterpriseWorkflowsTable)
      .where(and(
        eq(enterpriseWorkflowsTable.profileId, profile.id),
        eq(enterpriseWorkflowsTable.templateKey, key),
        eq(enterpriseWorkflowsTable.status, "pending"),
      ))
      .limit(1);

    if (!existing) {
      const wf = await createWorkflow(profile, { templateKey: key, title: issue });
      created.push(wf);
    }
  }
  return created;
}
