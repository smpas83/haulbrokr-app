import { beforeEach, describe, expect, it, vi } from "vitest";
import express, { type Express } from "express";
import request from "supertest";

const h = vi.hoisted(() => ({
  profile: { id: 42, role: "customer" } as Record<string, unknown>,
  activityRows: [] as Record<string, unknown>[],
}));

vi.mock("../middlewares/requireAuth", () => ({
  requireProfile: (req: any, _res: any, next: any) => {
    req.profile = { ...h.profile };
    next();
  },
  getRequestProfile: (req: any) => req.profile,
}));

vi.mock("@workspace/db", () => {
  const makeTable = (name: string) =>
    new Proxy({}, { get: (_t, p) => `${name}.${String(p)}` });
  const activityTable = makeTable("activity");
  const chain = {
    where: () => ({
      orderBy: () => ({
        limit: () => Promise.resolve(h.activityRows),
      }),
    }),
  };
  return {
    db: {
      select: () => ({
        from: (table: unknown) => (table === activityTable ? chain : chain),
      }),
    },
    requestsTable: makeTable("requests"),
    jobsTable: makeTable("jobs"),
    bidsTable: makeTable("bids"),
    activityTable,
  };
});

import dashboardRouter from "./dashboard";

function makeApp(): Express {
  const app = express();
  app.use(dashboardRouter);
  return app;
}

beforeEach(() => {
  h.profile = { id: 42, role: "customer" };
  h.activityRows = [];
});

describe("GET /dashboard/activity", () => {
  it("returns the caller's notification activity feed", async () => {
    h.activityRows = [
      {
        id: 1,
        profileId: 42,
        type: "job_completed",
        description: "Job completed",
        relatedId: 9,
        createdAt: new Date("2026-06-01T00:00:00Z"),
      },
      {
        id: 2,
        profileId: 42,
        type: "payout_stuck_alert",
        description: "Payout needs review",
        relatedId: 10,
        createdAt: new Date("2026-06-02T00:00:00Z"),
      },
    ];

    const res = await request(makeApp()).get("/dashboard/activity");

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0]).toMatchObject({
      id: 1,
      type: "job_completed",
      description: "Job completed",
      relatedId: 9,
    });
  });
});
