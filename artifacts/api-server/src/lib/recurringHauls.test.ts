import { describe, it, expect, beforeEach, vi } from "vitest";

const h = vi.hoisted(() => ({
  series: [] as any[],
  occurrences: [] as any[],
  requests: [] as any[],
  updates: [] as any[],
  notifies: [] as any[],
  nextRequestId: 100,
  nextOccurrenceId: 1,
}));

vi.mock("@workspace/db", () => {
  const recurringHaulsTable = { _: "series" };
  const recurringHaulOccurrencesTable = { _: "occ" };
  const requestsTable = { _: "requests" };
  const activityTable = { _: "activity" };

  const db = {
    select: () => ({
      from: (table: unknown) => {
        if (table === recurringHaulsTable) {
          return {
            where: () =>
              Promise.resolve(h.series.filter((s) => s.status === "active")),
            orderBy: () => Promise.resolve(h.series),
          };
        }
        if (table === recurringHaulOccurrencesTable) {
          return {
            innerJoin: () => ({
              where: () =>
                Promise.resolve(
                  h.occurrences
                    .map((o) => ({
                      occurrence: o,
                      series: h.series.find((s) => s.id === o.recurringHaulId),
                    }))
                    .filter((r) => r.series),
                ),
            }),
            where: () => ({
              orderBy: () => ({
                limit: () => Promise.resolve(h.occurrences),
              }),
            }),
            orderBy: () => Promise.resolve(h.occurrences),
          };
        }
        return { where: () => Promise.resolve([]) };
      },
    }),
    insert: () => ({
      values: (vals: any) => {
        if (
          vals.customerId != null &&
          vals.materialType != null &&
          vals.pickupAddress != null &&
          vals.status === "open"
        ) {
          const row = { id: h.nextRequestId++, ...vals };
          h.requests.push(row);
          return { returning: async () => [row] };
        }
        if (vals.recurringHaulId != null) {
          const row = {
            id: h.nextOccurrenceId++,
            reminderSentAt: null,
            ...vals,
          };
          h.occurrences.push(row);
          return Promise.resolve(undefined);
        }
        return { returning: async () => [vals] };
      },
    }),
    update: () => ({
      set: (vals: any) => ({
        where: () => {
          h.updates.push(vals);
          if (h.series[0]) Object.assign(h.series[0], vals);
          return { returning: async () => [h.series[0]] };
        },
      }),
    }),
  };

  return {
    db,
    recurringHaulsTable,
    recurringHaulOccurrencesTable,
    requestsTable,
    activityTable,
  };
});

vi.mock("./notificationPlatform", () => ({
  notifyUser: vi.fn(async (payload: any) => {
    h.notifies.push(payload);
  }),
  notifyOrgRoles: vi.fn(async () => 0),
}));

import {
  computeNextRunAt,
  parseDaysOfWeek,
  isoWeekday,
  processDueRecurringHauls,
  processRecurringReminders,
} from "./recurringHauls";

beforeEach(() => {
  h.series = [];
  h.occurrences = [];
  h.requests = [];
  h.updates = [];
  h.notifies = [];
  h.nextRequestId = 100;
  h.nextOccurrenceId = 1;
});

describe("recurringHauls schedule math", () => {
  it("parses days of week", () => {
    expect(parseDaysOfWeek("1,3,5")).toEqual([1, 3, 5]);
    expect(parseDaysOfWeek(null)).toBeNull();
  });

  it("computes next daily run", () => {
    const next = computeNextRunAt(
      {
        frequency: "daily",
        daysOfWeek: null,
        dayOfMonth: null,
        startDate: new Date("2026-07-01T12:00:00Z"),
        endDate: null,
      },
      new Date("2026-07-01T12:00:00Z"),
    );
    expect(next?.toISOString()).toBe("2026-07-02T12:00:00.000Z");
  });

  it("computes next weekly run on configured weekdays", () => {
    // 2026-07-01 is Wednesday (ISO 3)
    const after = new Date("2026-07-01T12:00:00Z");
    expect(isoWeekday(after)).toBe(3);
    const next = computeNextRunAt(
      {
        frequency: "weekly",
        daysOfWeek: "1,5",
        dayOfMonth: null,
        startDate: after,
        endDate: null,
      },
      after,
    );
    // Next Friday Jul 3
    expect(next?.toISOString().slice(0, 10)).toBe("2026-07-03");
  });

  it("returns null when past endDate", () => {
    const next = computeNextRunAt(
      {
        frequency: "daily",
        daysOfWeek: null,
        dayOfMonth: null,
        startDate: new Date("2026-07-01T12:00:00Z"),
        endDate: new Date("2026-07-01T12:00:00Z"),
      },
      new Date("2026-07-01T12:00:00Z"),
    );
    expect(next).toBeNull();
  });
});

describe("processDueRecurringHauls", () => {
  it("creates a marketplace request for due series", async () => {
    h.series.push({
      id: 1,
      customerId: 9,
      organizationId: 3,
      projectId: null,
      materialType: "gravel",
      truckType: "dump_truck",
      quantityTons: "20",
      pickupAddress: "A",
      deliveryAddress: "B",
      startTime: "08:00",
      estimatedHours: "8",
      trucksNeeded: 1,
      budgetPerHour: null,
      notes: null,
      frequency: "daily",
      daysOfWeek: null,
      dayOfMonth: null,
      startDate: new Date("2026-07-01T12:00:00Z"),
      endDate: null,
      nextRunAt: new Date("2026-07-01T12:00:00Z"),
      reminderHoursBefore: 24,
      status: "active",
      occurrenceCount: 0,
      maxOccurrences: null,
    });

    const result = await processDueRecurringHauls(
      new Date("2026-07-01T13:00:00Z"),
    );
    expect(result.created).toBe(1);
    expect(h.requests).toHaveLength(1);
    expect(h.occurrences).toHaveLength(1);
    expect(h.notifies.some((n) => n.type === "recurring_created")).toBe(true);
    expect(h.updates.some((u) => u.occurrenceCount === 1)).toBe(true);
  });
});

describe("processRecurringReminders", () => {
  it("sends reminders inside the reminder window", async () => {
    const scheduled = new Date(Date.now() + 2 * 60 * 60 * 1000);
    h.series.push({
      id: 1,
      customerId: 9,
      organizationId: 3,
      materialType: "dirt",
      pickupAddress: "Yard",
      status: "active",
      reminderHoursBefore: 24,
    });
    h.occurrences.push({
      id: 1,
      recurringHaulId: 1,
      requestId: 55,
      scheduledDate: scheduled,
      reminderSentAt: null,
    });

    const result = await processRecurringReminders(new Date());
    expect(result.reminded).toBe(1);
    expect(h.notifies.some((n) => n.type === "job_reminder")).toBe(true);
  });
});
