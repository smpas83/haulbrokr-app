import { Router, type IRouter } from "express";
import { getRequestProfile, requireProfile } from "../middlewares/requireAuth";
import { buildEnterpriseHub } from "../lib/enterpriseHub";
import { globalSearch } from "../lib/globalSearch";
import { createWorkflow, listWorkflows, addWorkflowComment, updateWorkflowStatus, WORKFLOW_TEMPLATES } from "../lib/workflowEngine";
import { createTask, listTasks, completeTask } from "../lib/taskEngine";
import { aggregateDocuments, getExpiringDocuments } from "../lib/documentCenter";
import { getScorecards } from "../lib/scorecards";
import { getFinanceCenter, getFleetManagement } from "../lib/financeCenter";
import { listReports, saveReport, runReport, exportReportCsv, REPORT_TEMPLATES } from "../lib/reportBuilder";
import { getSettings, updateSettings } from "../lib/enterpriseSettings";
import { listAuditLogs } from "../lib/enterpriseAudit";
import { getOrgPermissions } from "../lib/enterprisePermissions";
import type { WorkflowTemplateKey } from "../lib/workflowEngine";

const router: IRouter = Router();

function profileCtx(req: Parameters<typeof getRequestProfile>[0]) {
  const p = getRequestProfile(req);
  return {
    id: p.id,
    role: p.role,
    companyName: p.companyName,
    state: p.state ?? null,
    organizationId: p.organizationId ?? null,
    orgRole: p.orgRole ?? null,
  };
}

router.get("/enterprise/hub", requireProfile, async (req, res): Promise<void> => {
  const data = await buildEnterpriseHub(profileCtx(req));
  res.json(data);
});

router.get("/enterprise/search", requireProfile, async (req, res): Promise<void> => {
  const profile = profileCtx(req);
  const q = String(req.query.q ?? "");
  const results = await globalSearch(profile, q);
  res.json({ results });
});

router.get("/enterprise/workflows", requireProfile, async (req, res): Promise<void> => {
  const profile = profileCtx(req);
  const items = await listWorkflows({ id: profile.id, organizationId: profile.organizationId });
  res.json({ items, templates: WORKFLOW_TEMPLATES });
});

router.post("/enterprise/workflows", requireProfile, async (req, res): Promise<void> => {
  const profile = profileCtx(req);
  const templateKey = String(req.body?.templateKey ?? "") as WorkflowTemplateKey;
  if (!WORKFLOW_TEMPLATES[templateKey]) {
    res.status(400).json({ error: "Invalid templateKey" });
    return;
  }
  const wf = await createWorkflow({ id: profile.id, organizationId: profile.organizationId }, {
    templateKey,
    title: req.body?.title,
    relatedEntityType: req.body?.relatedEntityType,
    relatedEntityId: req.body?.relatedEntityId,
  });
  res.status(201).json(wf);
});

router.post("/enterprise/workflows/:id/comment", requireProfile, async (req, res): Promise<void> => {
  const profile = getRequestProfile(req);
  const id = parseInt(String(req.params.id), 10);
  const comment = String(req.body?.comment ?? "").trim();
  if (!comment) { res.status(400).json({ error: "comment required" }); return; }
  const events = await addWorkflowComment(profile.id, id, comment, req.body?.attachmentPath);
  if (!events) { res.status(404).json({ error: "Workflow not found" }); return; }
  res.json({ events });
});

router.patch("/enterprise/workflows/:id/status", requireProfile, async (req, res): Promise<void> => {
  const profile = getRequestProfile(req);
  const id = parseInt(String(req.params.id), 10);
  const status = String(req.body?.status ?? "");
  const wf = await updateWorkflowStatus(profile.id, id, status);
  if (!wf) { res.status(404).json({ error: "Workflow not found" }); return; }
  res.json(wf);
});

router.get("/enterprise/tasks", requireProfile, async (req, res): Promise<void> => {
  const profile = profileCtx(req);
  const items = await listTasks({ id: profile.id, organizationId: profile.organizationId }, req.query.status as string | undefined);
  res.json({ items });
});

router.post("/enterprise/tasks", requireProfile, async (req, res): Promise<void> => {
  const profile = profileCtx(req);
  const title = String(req.body?.title ?? "").trim();
  if (!title) { res.status(400).json({ error: "title required" }); return; }
  const task = await createTask({ id: profile.id, organizationId: profile.organizationId }, {
    title,
    description: req.body?.description,
    entityType: req.body?.entityType,
    entityId: req.body?.entityId,
    dueAt: req.body?.dueAt ? new Date(req.body.dueAt) : undefined,
    priority: req.body?.priority,
  });
  res.status(201).json(task);
});

router.post("/enterprise/tasks/:id/complete", requireProfile, async (req, res): Promise<void> => {
  const profile = getRequestProfile(req);
  const id = parseInt(String(req.params.id), 10);
  const task = await completeTask(profile.id, id);
  if (!task) { res.status(404).json({ error: "Task not found" }); return; }
  res.json(task);
});

router.get("/enterprise/documents", requireProfile, async (req, res): Promise<void> => {
  const profile = profileCtx(req);
  const items = await aggregateDocuments({ id: profile.id, organizationId: profile.organizationId });
  const expiring = await getExpiringDocuments(profile.id);
  res.json({ items, expiring });
});

router.get("/enterprise/scorecards", requireProfile, async (req, res): Promise<void> => {
  const profile = profileCtx(req);
  res.json(await getScorecards(profile));
});

router.get("/enterprise/finance", requireProfile, async (req, res): Promise<void> => {
  const profile = profileCtx(req);
  res.json(await getFinanceCenter(profile));
});

router.get("/enterprise/fleet", requireProfile, async (req, res): Promise<void> => {
  const profile = profileCtx(req);
  res.json(await getFleetManagement(profile));
});

router.get("/enterprise/reports", requireProfile, async (req, res): Promise<void> => {
  const profile = getRequestProfile(req);
  res.json({ saved: await listReports(profile.id), templates: REPORT_TEMPLATES });
});

router.post("/enterprise/reports", requireProfile, async (req, res): Promise<void> => {
  const profile = profileCtx(req);
  const name = String(req.body?.name ?? "").trim();
  if (!name) { res.status(400).json({ error: "name required" }); return; }
  const report = await saveReport({ id: profile.id, organizationId: profile.organizationId }, {
    name,
    description: req.body?.description,
    config: req.body?.config ?? {},
    scheduleCron: req.body?.scheduleCron,
    shared: req.body?.shared,
  });
  res.status(201).json(report);
});

router.post("/enterprise/reports/:id/run", requireProfile, async (req, res): Promise<void> => {
  const profile = getRequestProfile(req);
  const id = parseInt(String(req.params.id), 10);
  const finance = await getFinanceCenter(profileCtx(req));
  const result = await runReport(id, profile.id, finance as unknown as Record<string, unknown>);
  if (!result) { res.status(404).json({ error: "Report not found" }); return; }
  res.json(result);
});

router.get("/enterprise/reports/:id/export.csv", requireProfile, async (req, res): Promise<void> => {
  const profile = getRequestProfile(req);
  const id = parseInt(String(req.params.id), 10);
  const finance = await getFinanceCenter(profileCtx(req));
  const result = await runReport(id, profile.id, finance as unknown as Record<string, unknown>);
  if (!result) { res.status(404).json({ error: "Report not found" }); return; }
  res.setHeader("Content-Type", "text/csv");
  res.send(exportReportCsv(result.data));
});

router.get("/enterprise/settings", requireProfile, async (req, res): Promise<void> => {
  const profile = profileCtx(req);
  const [settings, permissions] = await Promise.all([
    getSettings(profile.organizationId, profile.id),
    getOrgPermissions(profile.organizationId, profile.orgRole, profile.role),
  ]);
  res.json({ settings, permissions });
});

router.patch("/enterprise/settings", requireProfile, async (req, res): Promise<void> => {
  const profile = profileCtx(req);
  const settings = await updateSettings(profile.organizationId, profile.id, req.body ?? {});
  res.json(settings);
});

router.get("/enterprise/audit", requireProfile, async (req, res): Promise<void> => {
  const profile = profileCtx(req);
  res.json({ items: await listAuditLogs(profile.organizationId, profile.id) });
});

export default router;
