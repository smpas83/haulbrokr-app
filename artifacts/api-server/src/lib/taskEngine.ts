import { db, enterpriseTasksTable } from "@workspace/db";
import { eq, and, desc, lte, isNull, or } from "drizzle-orm";
import { logEnterpriseAudit } from "./enterpriseAudit";

interface ProfileCtx {
  id: number;
  organizationId: number | null;
}

export async function listTasks(profile: ProfileCtx, status?: string) {
  const rows = await db.select()
    .from(enterpriseTasksTable)
    .where(status
      ? and(eq(enterpriseTasksTable.profileId, profile.id), eq(enterpriseTasksTable.status, status as "open"))
      : eq(enterpriseTasksTable.profileId, profile.id))
    .orderBy(desc(enterpriseTasksTable.dueAt))
    .limit(100);
  return rows.map(serializeTask);
}

export async function createTask(
  profile: ProfileCtx,
  input: {
    title: string;
    description?: string;
    entityType?: typeof enterpriseTasksTable.$inferInsert.entityType;
    entityId?: number;
    assigneeProfileId?: number;
    dueAt?: Date;
    priority?: "critical" | "high" | "medium" | "low";
    dependsOnTaskId?: number;
    recurringRule?: string;
  },
) {
  const [row] = await db.insert(enterpriseTasksTable).values({
    organizationId: profile.organizationId,
    profileId: profile.id,
    title: input.title,
    description: input.description,
    entityType: input.entityType ?? "general",
    entityId: input.entityId,
    assigneeProfileId: input.assigneeProfileId ?? profile.id,
    dueAt: input.dueAt,
    priority: input.priority ?? "medium",
    dependsOnTaskId: input.dependsOnTaskId,
    recurringRule: input.recurringRule,
    reminderAt: input.dueAt ? new Date(input.dueAt.getTime() - 3600000) : undefined,
  }).returning();

  await logEnterpriseAudit({
    organizationId: profile.organizationId,
    actorProfileId: profile.id,
    action: "task.create",
    resourceType: "task",
    resourceId: row!.id,
  });

  return serializeTask(row!);
}

export async function completeTask(profileId: number, taskId: number) {
  const [task] = await db.select().from(enterpriseTasksTable).where(eq(enterpriseTasksTable.id, taskId));
  if (!task || task.profileId !== profileId) return null;

  const [updated] = await db.update(enterpriseTasksTable)
    .set({ status: "done", completedAt: new Date(), updatedAt: new Date() })
    .where(eq(enterpriseTasksTable.id, taskId))
    .returning();

  if (updated?.recurringRule) {
    const nextDue = new Date(Date.now() + 7 * 86400000);
    await createTask(
      { id: profileId, organizationId: updated.organizationId },
      {
        title: updated.title,
        description: updated.description ?? undefined,
        entityType: updated.entityType,
        entityId: updated.entityId ?? undefined,
        assigneeProfileId: updated.assigneeProfileId ?? undefined,
        dueAt: nextDue,
        priority: updated.priority,
        recurringRule: updated.recurringRule,
      },
    );
  }

  return serializeTask(updated!);
}

export async function getOverdueTasks(profileId: number) {
  const now = new Date();
  const rows = await db.select()
    .from(enterpriseTasksTable)
    .where(and(
      eq(enterpriseTasksTable.profileId, profileId),
      lte(enterpriseTasksTable.dueAt, now),
      or(eq(enterpriseTasksTable.status, "open"), eq(enterpriseTasksTable.status, "in_progress")),
    ))
    .limit(20);
  return rows.map(serializeTask);
}

function serializeTask(row: typeof enterpriseTasksTable.$inferSelect) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    entityType: row.entityType,
    entityId: row.entityId,
    assigneeProfileId: row.assigneeProfileId,
    dueAt: row.dueAt?.toISOString() ?? null,
    recurringRule: row.recurringRule,
    dependsOnTaskId: row.dependsOnTaskId,
    completedAt: row.completedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function syncAiTasks(profile: ProfileCtx, recommendations: { id: number; title: string; priority: string }[]) {
  const created = [];
  for (const rec of recommendations.slice(0, 5)) {
    const [existing] = await db.select()
      .from(enterpriseTasksTable)
      .where(and(
        eq(enterpriseTasksTable.profileId, profile.id),
        eq(enterpriseTasksTable.entityType, "ai"),
        eq(enterpriseTasksTable.entityId, rec.id),
        or(eq(enterpriseTasksTable.status, "open"), eq(enterpriseTasksTable.status, "in_progress")),
      ))
      .limit(1);
    if (!existing) {
      const task = await createTask(profile, {
        title: rec.title,
        entityType: "ai",
        entityId: rec.id,
        priority: rec.priority as "critical" | "high" | "medium" | "low",
        dueAt: new Date(Date.now() + 86400000),
      });
      created.push(task);
    }
  }
  return created;
}
