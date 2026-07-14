import { and, eq, inArray, sql } from "drizzle-orm";
import {
  db,
  recurringGenerationRunsTable,
  recurringSchedulesTable,
  requestsTable,
  type RecurringSchedule,
} from "@workspace/db";
import { logger } from "./logger";

/** US federal holidays (fixed + observed approximations for scheduling skips). */
function isUsFederalHoliday(dateStr: string): boolean {
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return false;
  // Fixed-date holidays
  const fixed = new Set([`${m}-${d}`]);
  if (fixed.has("1-1") || fixed.has("6-19") || fixed.has("7-4") || fixed.has("11-11") || fixed.has("12-25")) {
    return true;
  }
  // Thanksgiving: 4th Thursday of November
  if (m === 11) {
    const first = new Date(Date.UTC(y, 10, 1));
    const firstDow = first.getUTCDay();
    const firstThu = firstDow <= 4 ? 1 + (4 - firstDow) : 1 + (11 - firstDow);
    if (d === firstThu + 21) return true;
  }
  // Labor Day: 1st Monday of September
  if (m === 9) {
    const first = new Date(Date.UTC(y, 8, 1));
    const firstDow = first.getUTCDay();
    const firstMon = firstDow === 1 ? 1 : 1 + ((8 - firstDow) % 7);
    if (d === firstMon) return true;
  }
  // Memorial Day: last Monday of May
  if (m === 5) {
    const last = new Date(Date.UTC(y, 5, 0)); // last day of May
    const lastDow = last.getUTCDay();
    const lastMon = last.getUTCDate() - ((lastDow + 6) % 7);
    if (d === lastMon) return true;
  }
  return false;
}

/** Format a Date as YYYY-MM-DD in the given IANA timezone. */
export function formatDateInTimezone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const d = parts.find((p) => p.type === "day")?.value;
  return `${y}-${m}-${d}`;
}

/** Parse YYYY-MM-DD as noon UTC to avoid DST edge flips when converting. */
export function parseDateOnly(dateStr: string): Date {
  return new Date(`${dateStr}T12:00:00.000Z`);
}

function addDays(dateStr: string, days: number): string {
  const dt = parseDateOnly(dateStr);
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

function dayOfWeekInTimezone(dateStr: string, timeZone: string): number {
  // Use midday UTC then format weekday in TZ
  const dt = parseDateOnly(dateStr);
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(dt);
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return map[weekday] ?? 0;
}

function dayOfMonthInTimezone(dateStr: string, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    day: "2-digit",
  }).formatToParts(parseDateOnly(dateStr));
  return Number(parts.find((p) => p.type === "day")?.value ?? "0");
}

export function buildIdempotencyKey(scheduleId: number, occurrenceDate: string): string {
  return `recurring:${scheduleId}:${occurrenceDate}`;
}

export function shouldGenerateOnDate(schedule: RecurringSchedule, dateStr: string): boolean {
  if (schedule.status !== "active") return false;

  const startStr = formatDateInTimezone(schedule.startDate, schedule.timezone);
  if (dateStr < startStr) return false;
  if (schedule.endDate) {
    const endStr = formatDateInTimezone(schedule.endDate, schedule.timezone);
    if (dateStr > endStr) return false;
  }

  const skip = new Set(schedule.skipDates ?? []);
  if (skip.has(dateStr)) return false;

  if (schedule.holidayBehavior === "skip" && isUsFederalHoliday(dateStr)) {
    return false;
  }

  switch (schedule.recurrenceType) {
    case "daily":
      return true;
    case "weekly": {
      const dow = dayOfWeekInTimezone(dateStr, schedule.timezone);
      const days = schedule.daysOfWeek?.length ? schedule.daysOfWeek : [1]; // default Mon
      return days.includes(dow);
    }
    case "monthly": {
      const dom = dayOfMonthInTimezone(dateStr, schedule.timezone);
      const target = schedule.dayOfMonth ?? 1;
      if (dom === target) return true;
      // Monthly edge: if target day doesn't exist (e.g. Feb 30), use last day of month when target > last day
      if (target > 28) {
        const next = addDays(dateStr, 1);
        const nextMonth = next.slice(5, 7);
        const thisMonth = dateStr.slice(5, 7);
        if (nextMonth !== thisMonth && dom < target) return true;
      }
      return false;
    }
    case "custom": {
      const interval = Math.max(1, schedule.intervalDays ?? 1);
      const start = parseDateOnly(startStr).getTime();
      const cur = parseDateOnly(dateStr).getTime();
      const diffDays = Math.round((cur - start) / 86_400_000);
      if (diffDays < 0) return false;
      if (diffDays % interval !== 0) return false;
      const days = schedule.daysOfWeek ?? [];
      if (days.length === 0) return true;
      return days.includes(dayOfWeekInTimezone(dateStr, schedule.timezone));
    }
    default:
      return false;
  }
}

function applyHolidayBehavior(schedule: RecurringSchedule, dateStr: string): string | null {
  if (!isUsFederalHoliday(dateStr)) return dateStr;
  if (schedule.holidayBehavior === "include") return dateStr;
  if (schedule.holidayBehavior === "skip") return null;
  // next_business_day
  let cursor = dateStr;
  for (let i = 0; i < 7; i++) {
    cursor = addDays(cursor, 1);
    const dow = dayOfWeekInTimezone(cursor, schedule.timezone);
    if (dow !== 0 && dow !== 6 && !isUsFederalHoliday(cursor)) return cursor;
  }
  return null;
}

function locationsValid(pickup: string, delivery: string): boolean {
  const p = pickup?.trim() ?? "";
  const d = delivery?.trim() ?? "";
  return p.length >= 5 && d.length >= 5;
}

export type GenerationResult = {
  scheduleId: number;
  occurrenceDate: string;
  status: "created" | "skipped" | "review_required" | "failed" | "duplicate";
  requestId?: number;
  errorMessage?: string;
};

export async function generateOccurrence(
  schedule: RecurringSchedule,
  occurrenceDate: string,
): Promise<GenerationResult> {
  const idempotencyKey = buildIdempotencyKey(schedule.id, occurrenceDate);

  const [existing] = await db
    .select()
    .from(recurringGenerationRunsTable)
    .where(eq(recurringGenerationRunsTable.idempotencyKey, idempotencyKey));
  if (existing) {
    return {
      scheduleId: schedule.id,
      occurrenceDate,
      status: "duplicate",
      requestId: existing.requestId ?? undefined,
    };
  }

  if (schedule.status === "paused" || schedule.status === "cancelled" || schedule.status === "expired") {
    await db.insert(recurringGenerationRunsTable).values({
      scheduleId: schedule.id,
      occurrenceDate,
      status: "skipped",
      idempotencyKey,
      errorMessage: `schedule_${schedule.status}`,
    });
    return { scheduleId: schedule.id, occurrenceDate, status: "skipped", errorMessage: `schedule_${schedule.status}` };
  }

  if (!shouldGenerateOnDate(schedule, occurrenceDate)) {
    return { scheduleId: schedule.id, occurrenceDate, status: "skipped", errorMessage: "not_due" };
  }

  let effectiveDate = occurrenceDate;
  if (schedule.holidayBehavior === "next_business_day" && isUsFederalHoliday(occurrenceDate)) {
    const moved = applyHolidayBehavior(schedule, occurrenceDate);
    if (!moved) {
      await db.insert(recurringGenerationRunsTable).values({
        scheduleId: schedule.id,
        occurrenceDate,
        status: "skipped",
        idempotencyKey,
        errorMessage: "holiday_unresolvable",
      });
      return { scheduleId: schedule.id, occurrenceDate, status: "skipped", errorMessage: "holiday_unresolvable" };
    }
    effectiveDate = moved;
  }

  const reviewRequired = !locationsValid(schedule.pickupAddress, schedule.deliveryAddress);
  const scheduledDate = parseDateOnly(effectiveDate);

  try {
    const [request] = await db
      .insert(requestsTable)
      .values({
        customerId: schedule.customerId,
        materialType: schedule.materialType,
        truckType: schedule.truckType,
        quantityTons: schedule.quantityTons,
        pickupAddress: schedule.pickupAddress,
        deliveryAddress: schedule.deliveryAddress,
        scheduledDate,
        startTime: schedule.startTime,
        estimatedHours: schedule.estimatedHours,
        trucksNeeded: schedule.trucksNeeded,
        budgetPerHour: schedule.budgetPerHour,
        projectId: schedule.projectId,
        notes: schedule.notes,
        recurringScheduleId: schedule.id,
        status: reviewRequired ? "review_required" : "open",
      })
      .returning();

    await db.insert(recurringGenerationRunsTable).values({
      scheduleId: schedule.id,
      occurrenceDate,
      status: reviewRequired ? "review_required" : "created",
      requestId: request.id,
      idempotencyKey,
      errorMessage: reviewRequired ? "invalid_or_missing_locations" : null,
    });

    await db
      .update(recurringSchedulesTable)
      .set({
        lastGeneratedForDate: occurrenceDate,
        lastRunAt: new Date(),
        lastError: reviewRequired ? "invalid_or_missing_locations" : null,
        consecutiveFailures: 0,
      })
      .where(eq(recurringSchedulesTable.id, schedule.id));

    return {
      scheduleId: schedule.id,
      occurrenceDate,
      status: reviewRequired ? "review_required" : "created",
      requestId: request.id,
      errorMessage: reviewRequired ? "invalid_or_missing_locations" : undefined,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "generation_failed";
    // Unique violation on idempotency → duplicate
    if (/unique|duplicate/i.test(message)) {
      return { scheduleId: schedule.id, occurrenceDate, status: "duplicate" };
    }

    try {
      await db.insert(recurringGenerationRunsTable).values({
        scheduleId: schedule.id,
        occurrenceDate,
        status: "failed",
        idempotencyKey,
        errorMessage: message.slice(0, 500),
      });
    } catch {
      // ignore secondary insert failure
    }

    const failures = (schedule.consecutiveFailures ?? 0) + 1;
    await db
      .update(recurringSchedulesTable)
      .set({
        lastRunAt: new Date(),
        lastError: message.slice(0, 500),
        consecutiveFailures: failures,
        status: failures >= 5 ? "error" : schedule.status,
      })
      .where(eq(recurringSchedulesTable.id, schedule.id));

    logger.error({ err, scheduleId: schedule.id, occurrenceDate }, "Recurring haul generation failed");
    return { scheduleId: schedule.id, occurrenceDate, status: "failed", errorMessage: message };
  }
}

export function listOccurrenceDates(schedule: RecurringSchedule, from: Date, horizonDays: number): string[] {
  const dates: string[] = [];
  const start = formatDateInTimezone(from, schedule.timezone);
  for (let i = 0; i <= horizonDays; i++) {
    const dateStr = addDays(start, i);
    if (shouldGenerateOnDate(schedule, dateStr)) {
      dates.push(dateStr);
    }
  }
  return dates;
}

export type WorkerRunSummary = {
  schedulesProcessed: number;
  created: number;
  skipped: number;
  reviewRequired: number;
  failed: number;
  duplicates: number;
  results: GenerationResult[];
};

export async function runRecurringHaulWorker(options: { now?: Date; scheduleIds?: number[] } = {}): Promise<WorkerRunSummary> {
  const now = options.now ?? new Date();
  const summary: WorkerRunSummary = {
    schedulesProcessed: 0,
    created: 0,
    skipped: 0,
    reviewRequired: 0,
    failed: 0,
    duplicates: 0,
    results: [],
  };

  // Expire schedules past end date
  await db
    .update(recurringSchedulesTable)
    .set({ status: "expired" })
    .where(
      and(
        inArray(recurringSchedulesTable.status, ["active", "paused"]),
        sql`${recurringSchedulesTable.endDate} is not null and ${recurringSchedulesTable.endDate} < ${now}`,
      ),
    );

  let schedules: RecurringSchedule[];
  if (options.scheduleIds?.length) {
    schedules = await db
      .select()
      .from(recurringSchedulesTable)
      .where(inArray(recurringSchedulesTable.id, options.scheduleIds));
  } else {
    schedules = await db
      .select()
      .from(recurringSchedulesTable)
      .where(eq(recurringSchedulesTable.status, "active"));
  }

  for (const schedule of schedules) {
    summary.schedulesProcessed += 1;
    if (schedule.status !== "active") {
      continue;
    }
    const dates = listOccurrenceDates(schedule, now, schedule.generateHorizonDays ?? 14);
    for (const dateStr of dates) {
      const result = await generateOccurrence(schedule, dateStr);
      summary.results.push(result);
      if (result.status === "created") summary.created += 1;
      else if (result.status === "skipped") summary.skipped += 1;
      else if (result.status === "review_required") summary.reviewRequired += 1;
      else if (result.status === "failed") summary.failed += 1;
      else if (result.status === "duplicate") summary.duplicates += 1;
    }
  }

  logger.info(
    {
      schedulesProcessed: summary.schedulesProcessed,
      created: summary.created,
      skipped: summary.skipped,
      reviewRequired: summary.reviewRequired,
      failed: summary.failed,
      duplicates: summary.duplicates,
    },
    "Recurring haul worker run complete",
  );

  return summary;
}

/** Retry failed generation runs that are still under the attempt budget. */
export async function retryFailedRecurringGenerations(maxAttempts = 3): Promise<number> {
  const failed = await db
    .select()
    .from(recurringGenerationRunsTable)
    .where(and(eq(recurringGenerationRunsTable.status, "failed"), sql`${recurringGenerationRunsTable.attempt} < ${maxAttempts}`));

  let retried = 0;
  for (const run of failed) {
    const [schedule] = await db
      .select()
      .from(recurringSchedulesTable)
      .where(eq(recurringSchedulesTable.id, run.scheduleId));
    if (!schedule || schedule.status !== "active") continue;

    // Clear failed row so idempotency allows retry with incremented attempt
    await db.delete(recurringGenerationRunsTable).where(eq(recurringGenerationRunsTable.id, run.id));
    const result = await generateOccurrence(schedule, run.occurrenceDate);
    if (result.status === "failed") {
      await db
        .update(recurringGenerationRunsTable)
        .set({ attempt: run.attempt + 1 })
        .where(eq(recurringGenerationRunsTable.idempotencyKey, buildIdempotencyKey(schedule.id, run.occurrenceDate)));
    }
    retried += 1;
  }
  return retried;
}
