import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  profiles: [] as Record<string, unknown>[],
  trucks: [] as Record<string, unknown>[],
  inserts: [] as Record<string, unknown>[],
}));

vi.mock("@workspace/db", () => {
  const makeTable = (name: string) =>
    new Proxy({}, { get: (_target, prop) => `${name}.${String(prop)}` });
  const profilesTable = makeTable("profiles");
  const trucksTable = makeTable("trucks");
  const dispatchDecisionsTable = makeTable("dispatchDecisions");
  return {
    profilesTable,
    trucksTable,
    dispatchDecisionsTable,
    db: {
      select: () => ({
        from: (table: unknown) => ({
          where: () => {
            if (table === profilesTable) return Promise.resolve(h.profiles);
            if (table === trucksTable) return Promise.resolve(h.trucks);
            return Promise.resolve([]);
          },
        }),
      }),
      insert: () => ({
        values: (row: Record<string, unknown>) => {
          h.inserts.push(row);
          return { returning: () => Promise.resolve([{ id: 1, ...row }]) };
        },
      }),
    },
  };
});

import {
  recommendDispatchForJob,
  recordDispatchDecision,
} from "./dispatchEngine";

beforeEach(() => {
  h.profiles = [
    { id: 10, role: "provider", organizationId: 99 },
    { id: 20, role: "driver", organizationId: 99 },
    { id: 21, role: "driver", organizationId: 99 },
  ];
  h.trucks = [
    {
      id: 7,
      ownerId: 10,
      assignedDriverId: 20,
      truckType: "dump_truck",
      isAvailable: true,
    },
    {
      id: 8,
      ownerId: 10,
      assignedDriverId: null,
      truckType: "lowboy",
      isAvailable: true,
    },
  ];
  h.inserts = [];
});

describe("dispatchEngine", () => {
  const job: any = {
    id: 5,
    requestId: 4,
    providerId: 10,
    truckType: "dump_truck",
  };

  it("ranks matching assigned trucks highest", async () => {
    const recommendations = await recommendDispatchForJob(job);

    expect(recommendations[0]).toMatchObject({
      driverProfileId: 20,
      truckId: 7,
    });
    expect(recommendations[0].score).toBeGreaterThan(recommendations[1].score);
  });

  it("records selected dispatch decisions with full recommendation context", async () => {
    const decision = await recordDispatchDecision({
      job,
      selectedByProfileId: 10,
      driverProfileId: 20,
      truckId: 7,
    });

    expect(decision).toMatchObject({
      id: 1,
      status: "assigned",
      driverProfileId: 20,
      truckId: 7,
    });
    expect(h.inserts[0]).toMatchObject({
      jobId: 5,
      recommendation: expect.objectContaining({
        recommendations: expect.any(Array),
      }),
    });
  });
});
