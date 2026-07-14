import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  schedules: [] as any[],
  runs: [] as any[],
  requests: [] as any[],
  nextRequestId: 1,
}));

vi.mock("@workspace/db", () => {
  const makeTable = (name: string) =>
    new Proxy({}, { get: (_t, p) => `${name}.${String(p)}` });
  return {
    db: {
      select: () => ({
        from: (table: any) => ({
          where: async () => {
            const key = String(table?.id ?? table);
            if (
              key.includes("recurringGeneration") ||
              key.includes("generation")
            )
              return h.runs;
            if (key.includes("recurringSchedules") || key.includes("schedules"))
              return h.schedules;
            return [];
          },
        }),
      }),
      insert: (table: any) => ({
        values: (vals: any) => {
          const key = String(table?.id ?? "");
          const isRequest =
            key.includes("requests") ||
            (vals.customerId != null && vals.materialType != null);
          if (isRequest) {
            const row = { id: h.nextRequestId++, ...vals };
            h.requests.push(row);
            const ret = Promise.resolve([row]);
            return Object.assign(ret, { returning: () => ret });
          }
          h.runs.push(vals);
          const ret = Promise.resolve([{ id: h.runs.length, ...vals }]);
          return Object.assign(ret, { returning: () => ret });
        },
      }),
      update: () => ({
        set: (vals: any) => ({
          where: async () => {
            if (h.schedules[0]) Object.assign(h.schedules[0], vals);
            return [];
          },
        }),
      }),
      delete: () => ({
        where: async () => {
          h.runs = [];
        },
      }),
    },
    recurringGenerationRunsTable: makeTable("recurringGenerationRuns"),
    recurringSchedulesTable: makeTable("recurringSchedules"),
    requestsTable: makeTable("requests"),
  };
});

vi.mock("./logger", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

import {
  buildIdempotencyKey,
  formatDateInTimezone,
  generateOccurrence,
  shouldGenerateOnDate,
} from "./recurringHauls";

function baseSchedule(overrides: Partial<any> = {}): any {
  return {
    id: 1,
    customerId: 9,
    organizationId: 1,
    projectId: null,
    name: "Test",
    status: "active",
    recurrenceType: "daily",
    timezone: "America/Chicago",
    daysOfWeek: [],
    dayOfMonth: null,
    intervalDays: null,
    startDate: new Date("2026-07-01T12:00:00Z"),
    endDate: null,
    skipDates: [],
    holidayBehavior: "skip",
    materialType: "dirt",
    truckType: "dump_truck",
    quantityTons: "20",
    pickupAddress: "100 Pit Rd, Dallas, TX",
    deliveryAddress: "200 Fill Rd, Dallas, TX",
    startTime: "08:00",
    estimatedHours: "8",
    trucksNeeded: 1,
    budgetPerHour: null,
    notes: null,
    generateHorizonDays: 7,
    lastGeneratedForDate: null,
    lastRunAt: null,
    lastError: null,
    consecutiveFailures: 0,
    createdAt: new Date("2026-07-01T12:00:00Z"),
    updatedAt: new Date("2026-07-01T12:00:00Z"),
    ...overrides,
  };
}

describe("recurring haul scheduling", () => {
  beforeEach(() => {
    h.schedules = [];
    h.runs = [];
    h.requests = [];
    h.nextRequestId = 1;
  });

  it("formats dates in timezone (DST-safe calendar day)", () => {
    // 2026-03-08 06:30 UTC is still Mar 7 evening in Chicago (CST)
    const winter = formatDateInTimezone(
      new Date("2026-03-08T06:30:00Z"),
      "America/Chicago",
    );
    expect(winter).toBe("2026-03-08");
    // After spring-forward (CDT): 2026-03-08 07:30 UTC is Mar 8 02:30 CDT
    const spring = formatDateInTimezone(
      new Date("2026-03-08T12:00:00Z"),
      "America/Chicago",
    );
    expect(spring).toBe("2026-03-08");
  });

  it("daily generation matches dates on/after start", () => {
    const s = baseSchedule({ recurrenceType: "daily" });
    expect(shouldGenerateOnDate(s, "2026-07-01")).toBe(true);
    expect(shouldGenerateOnDate(s, "2026-06-30")).toBe(false);
  });

  it("weekly generation respects daysOfWeek", () => {
    const s = baseSchedule({ recurrenceType: "weekly", daysOfWeek: [1] }); // Mondays
    expect(shouldGenerateOnDate(s, "2026-07-06")).toBe(true); // Monday
    expect(shouldGenerateOnDate(s, "2026-07-07")).toBe(false); // Tuesday
  });

  it("monthly edge case uses last day when target exceeds month length", () => {
    const s = baseSchedule({
      recurrenceType: "monthly",
      dayOfMonth: 31,
      startDate: new Date("2026-01-01T12:00:00Z"),
    });
    expect(shouldGenerateOnDate(s, "2026-01-31")).toBe(true);
    expect(shouldGenerateOnDate(s, "2026-02-28")).toBe(true);
    expect(shouldGenerateOnDate(s, "2026-02-27")).toBe(false);
  });

  it("skips paused / cancelled / expired schedules", async () => {
    for (const status of ["paused", "cancelled", "expired"] as const) {
      h.runs = [];
      const result = await generateOccurrence(
        baseSchedule({ status }),
        "2026-07-10",
      );
      expect(result.status).toBe("skipped");
    }
  });

  it("prevents duplicate creation via idempotency key", async () => {
    const key = buildIdempotencyKey(1, "2026-07-10");
    h.runs = [{ idempotencyKey: key, requestId: 55, status: "created" }];
    const result = await generateOccurrence(baseSchedule(), "2026-07-10");
    expect(result.status).toBe("duplicate");
    expect(result.requestId).toBe(55);
  });

  it("places invalid locations into review_required", async () => {
    h.runs = [];
    const result = await generateOccurrence(
      baseSchedule({ pickupAddress: "x", deliveryAddress: "" }),
      "2026-07-10",
    );
    expect(result.status).toBe("review_required");
    expect(h.requests[0].status).toBe("review_required");
    expect(h.requests[0].recurringScheduleId).toBe(1);
  });

  it("creates open request carrying approved template fields only", async () => {
    h.runs = [];
    const result = await generateOccurrence(baseSchedule(), "2026-07-10");
    expect(result.status).toBe("created");
    expect(h.requests[0]).toMatchObject({
      materialType: "dirt",
      truckType: "dump_truck",
      recurringScheduleId: 1,
      status: "open",
    });
    expect(h.requests[0].driverId).toBeUndefined();
    expect(h.requests[0].paymentStatus).toBeUndefined();
  });

  it("respects skip dates and end date expiry", () => {
    const s = baseSchedule({
      skipDates: ["2026-07-04"],
      endDate: new Date("2026-07-15T12:00:00Z"),
    });
    expect(shouldGenerateOnDate(s, "2026-07-04")).toBe(false);
    expect(shouldGenerateOnDate(s, "2026-07-16")).toBe(false);
  });

  it("skips US federal holidays when holidayBehavior=skip", () => {
    const s = baseSchedule({
      holidayBehavior: "skip",
      startDate: new Date("2026-01-01T12:00:00Z"),
    });
    expect(shouldGenerateOnDate(s, "2026-07-04")).toBe(false);
    expect(shouldGenerateOnDate(s, "2026-07-05")).toBe(true);
  });

  it("retry clears failed run then regenerates", async () => {
    const { retryFailedRecurringGenerations } =
      await import("./recurringHauls");
    h.schedules = [baseSchedule()];
    h.runs = [
      {
        id: 9,
        scheduleId: 1,
        occurrenceDate: "2026-07-10",
        status: "failed",
        attempt: 1,
        idempotencyKey: buildIdempotencyKey(1, "2026-07-10"),
      },
    ];
    // After delete, generateOccurrence should create
    const retried = await retryFailedRecurringGenerations(3);
    expect(retried).toBe(1);
    expect(h.requests.length).toBeGreaterThan(0);
  });
});
