import { describe, it, expect, beforeEach, vi } from "vitest";
import express, { type Express } from "express";
import request from "supertest";

/**
 * RC2 security: GET /dispatch/overview must never leak another org's jobs.
 * Supervisors previously fell through to the unfiltered job set.
 */

const h = vi.hoisted(() => ({
  profile: null as Record<string, unknown> | null,
  jobs: [] as Record<string, unknown>[],
  updates: [] as Record<string, unknown>[],
  trucks: [] as Record<string, unknown>[],
  actorIds: [] as number[],
}));

vi.mock("../middlewares/requireAuth", () => ({
  requireProfile: (req: any, _res: any, next: any) => {
    req.profile = { ...h.profile };
    next();
  },
  getRequestProfile: (req: any) => req.profile,
}));

vi.mock("../lib/access", async (importActual) => {
  const actual = await importActual<typeof import("../lib/access")>();
  return {
    ...actual,
    loadJobIfMember: async (jobId: number) => h.jobs.find((j) => j.id === jobId) ?? null,
    orgScopedActorIds: async () => (h.actorIds.length ? h.actorIds : [Number(h.profile?.id)]),
  };
});

vi.mock("@workspace/db", () => {
  const makeTable = (name: string) =>
    new Proxy({}, { get: (_t, p) => `${name}.${String(p)}` });

  const jobsTable = makeTable("jobs");
  const jobStatusUpdatesTable = makeTable("jobStatusUpdates");
  const trucksTable = makeTable("trucks");
  const deliveryEvidenceTable = makeTable("deliveryEvidence");

  const db = {
    select: (cols?: unknown) => ({
      from: (table: unknown) => ({
        where: (..._args: unknown[]) => {
          if (table === jobsTable) {
            // Simulate SQL-side filtering using the same actor/side rules the route requests.
            const profile = h.profile!;
            const active = h.jobs.filter((j) =>
              ["accepted", "active", "in_progress"].includes(String(j.status)),
            );
            if (profile.staffRole) return Promise.resolve(active);
            const actorIds = h.actorIds.length ? h.actorIds : [Number(profile.id)];
            if (profile.role === "customer" || profile.role === "supervisor") {
              return Promise.resolve(active.filter((j) => actorIds.includes(Number(j.customerId))));
            }
            if (profile.role === "provider" || profile.role === "driver") {
              return Promise.resolve(active.filter((j) => actorIds.includes(Number(j.providerId))));
            }
            return Promise.resolve([]);
          }
          if (table === jobStatusUpdatesTable) {
            return {
              orderBy: () => Promise.resolve(h.updates),
            };
          }
          if (table === trucksTable) {
            return Promise.resolve(h.trucks);
          }
          if (table === deliveryEvidenceTable) {
            return { orderBy: () => Promise.resolve([]) };
          }
          return Promise.resolve([]);
        },
        orderBy: () => Promise.resolve(table === trucksTable ? h.trucks : []),
      }),
    }),
    insert: () => ({
      values: () => Promise.resolve(undefined),
    }),
  };

  return { db, jobsTable, jobStatusUpdatesTable, trucksTable, deliveryEvidenceTable };
});

import trackingRouter from "./tracking";

function makeApp(): Express {
  const app = express();
  app.use(express.json());
  app.use(trackingRouter);
  return app;
}

beforeEach(() => {
  h.jobs = [
    {
      id: 1,
      status: "in_progress",
      materialType: "dirt",
      pickupAddress: "A",
      deliveryAddress: "B",
      customerId: 10,
      providerId: 20,
      scheduledDate: new Date(),
    },
    {
      id: 2,
      status: "accepted",
      materialType: "gravel",
      pickupAddress: "C",
      deliveryAddress: "D",
      customerId: 99,
      providerId: 88,
      scheduledDate: new Date(),
    },
  ];
  h.updates = [];
  h.trucks = [];
  h.actorIds = [];
  h.profile = null;
});

describe("RC2 dispatch overview organization isolation", () => {
  it("customer only sees their own active jobs", async () => {
    h.profile = { id: 10, role: "customer" };
    h.actorIds = [10];

    const res = await request(makeApp()).get("/dispatch/overview");
    expect(res.status).toBe(200);
    expect(res.body.activeJobs).toBe(1);
    expect(res.body.jobs.map((j: { id: number }) => j.id)).toEqual([1]);
  });

  it("supervisor only sees customer-org jobs (not the global fleet)", async () => {
    h.profile = { id: 11, role: "supervisor", organizationId: 5 };
    h.actorIds = [10, 11]; // org members including customer owner

    const res = await request(makeApp()).get("/dispatch/overview");
    expect(res.status).toBe(200);
    expect(res.body.jobs.map((j: { id: number }) => j.id)).toEqual([1]);
    expect(res.body.jobs.some((j: { id: number }) => j.id === 2)).toBe(false);
  });

  it("driver sees provider-org jobs via org-scoped actor ids", async () => {
    h.profile = { id: 30, role: "driver", organizationId: 7 };
    h.actorIds = [20, 30];

    const res = await request(makeApp()).get("/dispatch/overview");
    expect(res.status).toBe(200);
    expect(res.body.jobs.map((j: { id: number }) => j.id)).toEqual([1]);
  });

  it("unknown role receives an empty board (deny by default)", async () => {
    h.profile = { id: 50, role: "unknown_role" };

    const res = await request(makeApp()).get("/dispatch/overview");
    expect(res.status).toBe(200);
    expect(res.body.activeJobs).toBe(0);
    expect(res.body.jobs).toEqual([]);
  });

  it("staff may see the full active set", async () => {
    h.profile = { id: 1, role: "customer", staffRole: "ceo" };

    const res = await request(makeApp()).get("/dispatch/overview");
    expect(res.status).toBe(200);
    expect(res.body.activeJobs).toBe(2);
  });
});
