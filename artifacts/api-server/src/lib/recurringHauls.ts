import { and, eq, lte, isNull, or, sql } from "drizzle-orm";
import {
  db,
  recurringHaulsTable,
  recurringHaulOccurrencesTable,
  requestsTable,
  type RecurringHaul,
} from "@workspace/db";
import { notifyUser, notifyOrgRoles } from "./notificationPlatform";
import { logger } from "./logger";

export type RecurrenceFrequency = "daily" | "weekly" | "biweekly" | "monthly";

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d;
}

/** ISO weekday 1=Mon … 7=Sun */
export function isoWeekday(date: Date): number {
  const day = date.getUTCDay();
  return day === 0 ? 7 : day;
}

export function parseDaysOfWeek(raw: string | null | undefined): number[] | null {
  if (!raw) return null;
  const days = raw
    .split(",")
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n) && n >= 1 && n <= 7);
  return days.length ? [...new Set(days)].sort((a, b) => a - b) : null;
}

/**
 * Compute the next run after `from` (exclusive of from when from matches a slot
 * that was just executed — callers should pass the occurrence that just ran).
 */
export function computeNextRunAt(
  series: Pick<RecurringHaul, "frequency" | "daysOfWeek" | "dayOfMonth" | "startDate" | "endDate">,
  after: Date,
): Date | null {
  const end = series.endDate ? new Date(series.endDate) : null;
  let cursor = new Date(after);

  for (let i = 0; i < 400; i++) {
    let candidate: Date;
    switch (series.frequency) {
      case "daily":
        candidate = addDays(cursor, 1);
        break;
      case "weekly": {
        const days = parseDaysOfWeek(series.daysOfWeek) ?? [isoWeekday(new Date(series.startDate))];
        candidate = addDays(cursor, 1);
        while (!days.includes(isoWeekday(candidate))) {
          candidate = addDays(candidate, 1);
        }
        break;
      }
      case "biweekly": {
        const days = parseDaysOfWeek(series.daysOfWeek) ?? [isoWeekday(new Date(series.startDate))];
        // Advance one day, then if we've crossed into a new fortnight from start, skip a week
        candidate = addDays(cursor, 1);
        while (true) {
          if (days.includes(isoWeekday(candidate))) {
            const start = new Date(series.startDate);
            const diffDays = Math.floor((candidate.getTime() - start.getTime()) / 86_400_000);
            const fortnight = Math.floor(diffDays / 14);
            const dayInFortnight = diffDays - fortnight * 14;
            if (dayInFortnight < 7) break;
          }
          candidate = addDays(candidate, 1);
          if (candidate.getTime() - cursor.getTime() > 21 * 86_400_000) break;
        }
        break;
      }
      case "monthly": {
        const dom = series.dayOfMonth ?? new Date(series.startDate).getUTCDate();
        candidate = addMonths(cursor, 1);
        candidate.setUTCDate(Math.min(dom, 28));
        break;
      }
      default:
        return null;
    }

    if (end && candidate.getTime() > end.getTime()) return null;
    return candidate;
  }
  return null;
}

export function serializeRecurringHaul(row: RecurringHaul) {
  return {
    id: row.id,
    customerId: row.customerId,
    organizationId: row.organizationId,
    projectId: row.projectId,
    materialType: row.materialType,
    truckType: row.truckType,
    quantityTons: parseFloat(row.quantityTons),
    pickupAddress: row.pickupAddress,
    deliveryAddress: row.deliveryAddress,
    startTime: row.startTime,
    estimatedHours: parseFloat(row.estimatedHours),
    trucksNeeded: row.trucksNeeded,
    budgetPerHour: row.budgetPerHour != null ? parseFloat(row.budgetPerHour) : null,
    notes: row.notes,
    frequency: row.frequency,
    daysOfWeek: parseDaysOfWeek(row.daysOfWeek),
    dayOfMonth: row.dayOfMonth,
    startDate: row.startDate,
    endDate: row.endDate,
    nextRunAt: row.nextRunAt,
    reminderHoursBefore: row.reminderHoursBefore,
    status: row.status,
    occurrenceCount: row.occurrenceCount,
    maxOccurrences: row.maxOccurrences,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function createOccurrenceRequest(series: RecurringHaul, scheduledDate: Date): Promise<number> {
  const [request] = await db
    .insert(requestsTable)
    .values({
      customerId: series.customerId,
      materialType: series.materialType,
      truckType: series.truckType,
      quantityTons: series.quantityTons,
      pickupAddress: series.pickupAddress,
      deliveryAddress: series.deliveryAddress,
      scheduledDate,
      startTime: series.startTime,
      estimatedHours: series.estimatedHours,
      trucksNeeded: series.trucksNeeded,
      budgetPerHour: series.budgetPerHour,
      projectId: series.projectId,
      notes: series.notes
        ? `${series.notes}\n\n[Recurring haul #${series.id}]`
        : `Auto-created from recurring haul #${series.id}`,
      status: "open",
    })
    .returning();

  await db.insert(recurringHaulOccurrencesTable).values({
    recurringHaulId: series.id,
    requestId: request.id,
    scheduledDate,
  });

  return request.id;
}

export async function processDueRecurringHauls(
  now = new Date(),
): Promise<{ processed: number; created: number }> {
  const due = await db
    .select()
    .from(recurringHaulsTable)
    .where(and(eq(recurringHaulsTable.status, "active"), lte(recurringHaulsTable.nextRunAt, now)));

  let created = 0;
  for (const series of due) {
    try {
      if (series.maxOccurrences != null && series.occurrenceCount >= series.maxOccurrences) {
        await db
          .update(recurringHaulsTable)
          .set({ status: "completed" })
          .where(eq(recurringHaulsTable.id, series.id));
        continue;
      }

      const scheduledDate = new Date(series.nextRunAt);
      const requestId = await createOccurrenceRequest(series, scheduledDate);
      created += 1;

      const next = computeNextRunAt(series, scheduledDate);
      const hitMax =
        series.maxOccurrences != null && series.occurrenceCount + 1 >= series.maxOccurrences;

      await db
        .update(recurringHaulsTable)
        .set({
          occurrenceCount: series.occurrenceCount + 1,
          nextRunAt: next ?? scheduledDate,
          status: !next || hitMax ? "completed" : "active",
        })
        .where(eq(recurringHaulsTable.id, series.id));

      await notifyUser({
        profileId: series.customerId,
        type: "recurring_created",
        topic: "job",
        title: "Recurring haul posted",
        description: `Recurring haul #${series.id} created request #${requestId} for ${series.materialType}.`,
        relatedId: requestId,
      });

      if (series.organizationId) {
        await notifyOrgRoles(series.organizationId, ["dispatcher", "fleet_manager"], {
          type: "recurring_created",
          topic: "job",
          title: "Recurring haul posted",
          description: `Recurring haul #${series.id} created request #${requestId}.`,
          relatedId: requestId,
        });
      }
    } catch (err) {
      logger.error({ err, seriesId: series.id }, "Failed to process recurring haul");
    }
  }

  return { processed: due.length, created };
}

/**
 * Send reminder notifications for upcoming occurrences within the reminder window.
 */
export async function processRecurringReminders(
  now = new Date(),
): Promise<{ reminded: number }> {
  const rows = await db
    .select({
      occurrence: recurringHaulOccurrencesTable,
      series: recurringHaulsTable,
    })
    .from(recurringHaulOccurrencesTable)
    .innerJoin(
      recurringHaulsTable,
      eq(recurringHaulOccurrencesTable.recurringHaulId, recurringHaulsTable.id),
    )
    .where(
      and(
        isNull(recurringHaulOccurrencesTable.reminderSentAt),
        eq(recurringHaulsTable.status, "active"),
      ),
    );

  let reminded = 0;
  for (const { occurrence, series } of rows) {
    const hours = series.reminderHoursBefore ?? 24;
    const windowMs = hours * 60 * 60 * 1000;
    const scheduled = new Date(occurrence.scheduledDate).getTime();
    const delta = scheduled - now.getTime();
    if (delta < 0 || delta > windowMs) continue;

    try {
      await notifyUser({
        profileId: series.customerId,
        type: "job_reminder",
        topic: "reminder",
        title: "Upcoming haul reminder",
        description: `Reminder: recurring ${series.materialType} haul is scheduled for ${new Date(occurrence.scheduledDate).toISOString()} (request #${occurrence.requestId ?? "pending"}).`,
        relatedId: occurrence.requestId ?? undefined,
      });

      if (series.organizationId) {
        await notifyOrgRoles(series.organizationId, ["dispatcher", "driver"], {
          type: "job_reminder",
          topic: "reminder",
          title: "Upcoming haul reminder",
          description: `Haul reminder: ${series.materialType} from ${series.pickupAddress} on ${new Date(occurrence.scheduledDate).toISOString()}.`,
          relatedId: occurrence.requestId ?? undefined,
        });
      }

      await db
        .update(recurringHaulOccurrencesTable)
        .set({ reminderSentAt: now })
        .where(eq(recurringHaulOccurrencesTable.id, occurrence.id));
      reminded += 1;
    } catch (err) {
      logger.error({ err, occurrenceId: occurrence.id }, "Recurring reminder failed");
    }
  }

  return { reminded };
}

/** Calendar occurrences in [from, to] for a customer (and optional org). */
export async function listCalendarOccurrences(opts: {
  customerId: number;
  organizationId?: number | null;
  from: Date;
  to: Date;
}) {
  const conditions = [
    sql`${recurringHaulOccurrencesTable.scheduledDate} >= ${opts.from}`,
    sql`${recurringHaulOccurrencesTable.scheduledDate} <= ${opts.to}`,
    or(
      eq(recurringHaulsTable.customerId, opts.customerId),
      opts.organizationId
        ? eq(recurringHaulsTable.organizationId, opts.organizationId)
        : sql`false`,
    ),
  ];

  const rows = await db
    .select({
      occurrence: recurringHaulOccurrencesTable,
      series: recurringHaulsTable,
    })
    .from(recurringHaulOccurrencesTable)
    .innerJoin(
      recurringHaulsTable,
      eq(recurringHaulOccurrencesTable.recurringHaulId, recurringHaulsTable.id),
    )
    .where(and(...conditions));

  return rows.map(({ occurrence, series }) => ({
    id: occurrence.id,
    recurringHaulId: series.id,
    requestId: occurrence.requestId,
    scheduledDate: occurrence.scheduledDate,
    reminderSentAt: occurrence.reminderSentAt,
    materialType: series.materialType,
    truckType: series.truckType,
    pickupAddress: series.pickupAddress,
    deliveryAddress: series.deliveryAddress,
    startTime: series.startTime,
    frequency: series.frequency,
    status: series.status,
  }));
}
