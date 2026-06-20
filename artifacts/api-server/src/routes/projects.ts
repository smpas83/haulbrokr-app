import { Router, type IRouter } from "express";
import { eq, and, sql } from "drizzle-orm";
import { db, projectsTable, requestsTable, jobsTable, profilesTable, projectAssignmentsTable } from "@workspace/db";
import { requireProfile } from "../middlewares/requireAuth";
import { isOrgManager } from "../lib/access";
import {
  ListProjectAssignmentsResponse,
  CreateProjectAssignmentBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/projects", requireProfile, async (req, res): Promise<void> => {
  const profile = (req as any).profile;
  if (profile.role !== "customer") {
    res.status(403).json({ error: "Only customers can access projects" });
    return;
  }
  const projects = await db.select().from(projectsTable)
    .where(eq(projectsTable.customerId, profile.id))
    .orderBy(sql`${projectsTable.createdAt} desc`);
  res.json(projects.map(p => ({
    ...p,
    totalBudget: p.totalBudget ? parseFloat(p.totalBudget) : null,
    spentAmount: parseFloat(p.spentAmount),
  })));
});

router.post("/projects", requireProfile, async (req, res): Promise<void> => {
  const profile = (req as any).profile;
  if (profile.role !== "customer") {
    res.status(403).json({ error: "Only customers can create projects" });
    return;
  }
  const { name, description, siteAddress, totalBudget, startDate, endDate, notes } = req.body;
  if (!name) { res.status(400).json({ error: "name is required" }); return; }
  const [project] = await db.insert(projectsTable).values({
    customerId: profile.id,
    name,
    description: description ?? null,
    siteAddress: siteAddress ?? null,
    totalBudget: totalBudget ? String(totalBudget) : null,
    startDate: startDate ? new Date(startDate) : null,
    endDate: endDate ? new Date(endDate) : null,
    notes: notes ?? null,
  }).returning();
  res.status(201).json({ ...project, totalBudget: project.totalBudget ? parseFloat(project.totalBudget) : null, spentAmount: parseFloat(project.spentAmount) });
});

router.get("/projects/:id", requireProfile, async (req, res): Promise<void> => {
  const profile = (req as any).profile;
  const id = parseInt(req.params.id as string, 10);
  const [project] = await db.select().from(projectsTable)
    .where(and(eq(projectsTable.id, id), eq(projectsTable.customerId, profile.id)));
  if (!project) { res.status(404).json({ error: "Project not found" }); return; }

  const requests = await db.select().from(requestsTable)
    .where(eq(requestsTable.projectId, id));

  const jobs = requests.length > 0
    ? await db.select().from(jobsTable)
        .where(sql`${jobsTable.requestId} = ANY(${requests.map(r => r.id)})`)
    : [];

  res.json({
    ...project,
    totalBudget: project.totalBudget ? parseFloat(project.totalBudget) : null,
    spentAmount: parseFloat(project.spentAmount),
    requests,
    jobCount: jobs.length,
    completedJobs: jobs.filter(j => j.status === "completed").length,
  });
});

router.patch("/projects/:id", requireProfile, async (req, res): Promise<void> => {
  const profile = (req as any).profile;
  const id = parseInt(req.params.id as string, 10);
  const { name, description, siteAddress, totalBudget, status, startDate, endDate, notes } = req.body;
  const updates: Record<string, any> = {};
  if (name !== undefined) updates.name = name;
  if (description !== undefined) updates.description = description;
  if (siteAddress !== undefined) updates.siteAddress = siteAddress;
  if (totalBudget !== undefined) updates.totalBudget = String(totalBudget);
  if (status !== undefined) updates.status = status;
  if (startDate !== undefined) updates.startDate = new Date(startDate);
  if (endDate !== undefined) updates.endDate = new Date(endDate);
  if (notes !== undefined) updates.notes = notes;

  const [project] = await db.update(projectsTable).set(updates)
    .where(and(eq(projectsTable.id, id), eq(projectsTable.customerId, profile.id)))
    .returning();
  if (!project) { res.status(404).json({ error: "Project not found" }); return; }
  res.json({ ...project, totalBudget: project.totalBudget ? parseFloat(project.totalBudget) : null, spentAmount: parseFloat(project.spentAmount) });
});

router.delete("/projects/:id", requireProfile, async (req, res): Promise<void> => {
  const profile = (req as any).profile;
  const id = parseInt(req.params.id as string, 10);
  const [deleted] = await db.delete(projectsTable)
    .where(and(eq(projectsTable.id, id), eq(projectsTable.customerId, profile.id)))
    .returning();
  if (!deleted) { res.status(404).json({ error: "Project not found" }); return; }
  res.json({ success: true });
});

// ── Foreman (supervisor) assignments to a job site ──────────────────────────
async function loadProjectIfOwned(projectId: number, profile: any) {
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
  if (!project) return null;
  if (project.customerId === profile.id) return project;
  if (profile.organizationId) {
    const [owner] = await db.select().from(profilesTable).where(eq(profilesTable.id, project.customerId));
    if (owner?.organizationId === profile.organizationId) return project;
  }
  return null;
}

router.get("/projects/:id/assignments", requireProfile, async (req, res): Promise<void> => {
  const profile = (req as any).profile;
  const projectId = parseInt(String(req.params.id), 10);
  if (!Number.isFinite(projectId)) { res.status(400).json({ error: "Invalid project id" }); return; }
  const project = await loadProjectIfOwned(projectId, profile);
  if (!project) { res.status(404).json({ error: "Project not found" }); return; }

  const rows = await db
    .select({
      id: projectAssignmentsTable.id,
      projectId: projectAssignmentsTable.projectId,
      supervisorProfileId: projectAssignmentsTable.supervisorProfileId,
      assignedByProfileId: projectAssignmentsTable.assignedByProfileId,
      createdAt: projectAssignmentsTable.createdAt,
      supervisorName: profilesTable.contactName,
      supervisorCompany: profilesTable.companyName,
    })
    .from(projectAssignmentsTable)
    .leftJoin(profilesTable, eq(profilesTable.id, projectAssignmentsTable.supervisorProfileId))
    .where(eq(projectAssignmentsTable.projectId, projectId));

  const enriched = rows.map(({ supervisorCompany, supervisorName, ...r }) => ({ ...r, supervisorName: supervisorName ?? supervisorCompany }));
  res.json(ListProjectAssignmentsResponse.parse(enriched));
});

router.post("/projects/:id/assignments", requireProfile, async (req, res): Promise<void> => {
  const profile = (req as any).profile;
  const projectId = parseInt(String(req.params.id), 10);
  if (!Number.isFinite(projectId)) { res.status(400).json({ error: "Invalid project id" }); return; }
  if (!isOrgManager(profile)) {
    res.status(403).json({ error: "Only the owner or an admin can assign foremen." });
    return;
  }
  const project = await loadProjectIfOwned(projectId, profile);
  if (!project) { res.status(404).json({ error: "Project not found" }); return; }

  const parsed = CreateProjectAssignmentBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  // Foreman must be a supervisor in the same customer organisation.
  const [foreman] = await db.select().from(profilesTable).where(eq(profilesTable.id, parsed.data.supervisorProfileId));
  if (!foreman || foreman.role !== "supervisor" || foreman.organizationId !== profile.organizationId) {
    res.status(400).json({ error: "Foreman must be a supervisor in your company." });
    return;
  }

  const [existing] = await db.select().from(projectAssignmentsTable).where(and(
    eq(projectAssignmentsTable.projectId, projectId),
    eq(projectAssignmentsTable.supervisorProfileId, parsed.data.supervisorProfileId),
  ));
  if (existing) {
    res.status(201).json({ ...existing, supervisorName: foreman.contactName ?? foreman.companyName });
    return;
  }

  const [assignment] = await db.insert(projectAssignmentsTable).values({
    projectId,
    supervisorProfileId: parsed.data.supervisorProfileId,
    assignedByProfileId: profile.id,
  }).returning();

  res.status(201).json({ ...assignment, supervisorName: foreman.contactName ?? foreman.companyName });
});

router.delete("/projects/:id/assignments/:profileId", requireProfile, async (req, res): Promise<void> => {
  const profile = (req as any).profile;
  const projectId = parseInt(String(req.params.id), 10);
  const supervisorProfileId = parseInt(String(req.params.profileId), 10);
  if (!Number.isFinite(projectId) || !Number.isFinite(supervisorProfileId)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  if (!isOrgManager(profile)) {
    res.status(403).json({ error: "Only the owner or an admin can unassign foremen." });
    return;
  }
  const project = await loadProjectIfOwned(projectId, profile);
  if (!project) { res.status(404).json({ error: "Project not found" }); return; }

  await db.delete(projectAssignmentsTable).where(and(
    eq(projectAssignmentsTable.projectId, projectId),
    eq(projectAssignmentsTable.supervisorProfileId, supervisorProfileId),
  ));
  res.sendStatus(204);
});

export default router;
