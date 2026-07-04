import {
  db,
  autonomousMemoryTable,
  autonomousTimelineTable,
} from "@workspace/db";
import { eq, and, desc, ilike, or, sql } from "drizzle-orm";

export type MemoryType = "decision" | "approval" | "dismissal" | "pattern" | "reasoning";

export async function remember(
  profileId: number,
  memoryType: MemoryType,
  key: string,
  value: Record<string, unknown>,
) {
  const json = JSON.stringify(value);
  const [existing] = await db.select()
    .from(autonomousMemoryTable)
    .where(and(
      eq(autonomousMemoryTable.profileId, profileId),
      eq(autonomousMemoryTable.memoryType, memoryType),
      eq(autonomousMemoryTable.key, key),
    ))
    .limit(1);

  if (existing) {
    await db.update(autonomousMemoryTable)
      .set({ value: json })
      .where(eq(autonomousMemoryTable.id, existing.id));
    return existing.id;
  }

  const [row] = await db.insert(autonomousMemoryTable).values({
    profileId,
    memoryType,
    key,
    value: json,
  }).returning({ id: autonomousMemoryTable.id });
  return row!.id;
}

export async function recall(profileId: number, memoryType: MemoryType, key: string) {
  const [row] = await db.select()
    .from(autonomousMemoryTable)
    .where(and(
      eq(autonomousMemoryTable.profileId, profileId),
      eq(autonomousMemoryTable.memoryType, memoryType),
      eq(autonomousMemoryTable.key, key),
    ))
    .limit(1);
  if (!row) return null;
  try {
    return JSON.parse(row.value) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function isDismissed(profileId: number, externalKey: string): Promise<boolean> {
  const val = await recall(profileId, "dismissal", externalKey);
  return val != null;
}

export async function listMemory(profileId: number, memoryType?: MemoryType, limit = 50) {
  const rows = await db.select()
    .from(autonomousMemoryTable)
    .where(memoryType
      ? and(eq(autonomousMemoryTable.profileId, profileId), eq(autonomousMemoryTable.memoryType, memoryType))
      : eq(autonomousMemoryTable.profileId, profileId))
    .orderBy(desc(autonomousMemoryTable.createdAt))
    .limit(limit);
  return rows.map((r) => ({
    id: r.id,
    memoryType: r.memoryType as MemoryType,
    key: r.key,
    value: safeParse(r.value),
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function recordTimelineEvent(input: {
  profileId: number;
  eventType: string;
  title: string;
  description: string;
  recommendationId?: number;
  metadata?: Record<string, unknown>;
}) {
  const [row] = await db.insert(autonomousTimelineTable).values({
    profileId: input.profileId,
    eventType: input.eventType,
    title: input.title,
    description: input.description,
    recommendationId: input.recommendationId,
    metadata: JSON.stringify(input.metadata ?? {}),
  }).returning();
  return row!;
}

export async function searchTimeline(profileId: number, query: string, limit = 50) {
  const q = query.trim();
  const base = db.select()
    .from(autonomousTimelineTable)
    .where(eq(autonomousTimelineTable.profileId, profileId))
    .orderBy(desc(autonomousTimelineTable.createdAt))
    .limit(limit);

  if (!q) {
    return (await base).map(serializeTimeline);
  }

  const pattern = `%${q}%`;
  const rows = await db.select()
    .from(autonomousTimelineTable)
    .where(and(
      eq(autonomousTimelineTable.profileId, profileId),
      or(
        ilike(autonomousTimelineTable.title, pattern),
        ilike(autonomousTimelineTable.description, pattern),
        ilike(autonomousTimelineTable.eventType, pattern),
      ),
    ))
    .orderBy(desc(autonomousTimelineTable.createdAt))
    .limit(limit);

  return rows.map(serializeTimeline);
}

export async function listTimeline(profileId: number, limit = 30) {
  return searchTimeline(profileId, "", limit);
}

function serializeTimeline(row: typeof autonomousTimelineTable.$inferSelect) {
  return {
    id: row.id,
    eventType: row.eventType,
    title: row.title,
    description: row.description,
    recommendationId: row.recommendationId,
    metadata: safeParse(row.metadata ?? "{}"),
    createdAt: row.createdAt.toISOString(),
  };
}

function safeParse(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export async function countTimelineSince(profileId: number, since: Date) {
  const [row] = await db.select({ count: sql<number>`count(*)` })
    .from(autonomousTimelineTable)
    .where(and(
      eq(autonomousTimelineTable.profileId, profileId),
      sql`${autonomousTimelineTable.createdAt} >= ${since}`,
    ));
  return Number(row?.count ?? 0);
}
