import { describe, it, expect, beforeEach, vi } from "vitest";
import express, { type Express } from "express";
import request from "supertest";

const h = vi.hoisted(() => ({
  profile: { id: 1, role: "customer", companyName: "Acme" } as Record<
    string,
    unknown
  >,
  requests: [{ id: 1, status: "open", materialType: "dirt" }] as Record<
    string,
    unknown
  >[],
  jobs: [
    {
      id: 10,
      status: "in_progress",
      materialType: "gravel",
      customerId: 1,
      providerId: 2,
    },
  ] as Record<string, unknown>[],
  activity: [
    {
      description: "Bid received",
      type: "bid_received",
      createdAt: new Date(),
    },
  ] as Record<string, unknown>[],
}));

vi.mock("@workspace/db", () => {
  const makeTable = (name: string) =>
    new Proxy({}, { get: (_t, p) => `${name}.${String(p)}` });
  const requestsTable = makeTable("requests");
  const jobsTable = makeTable("jobs");
  const activityTable = makeTable("activity");
  const trucksTable = makeTable("trucks");

  const chainLimit = (rows: unknown[]) => ({
    limit: () => Promise.resolve(rows),
    orderBy: () => ({ limit: () => Promise.resolve(rows) }),
  });

  const db = {
    select: () => ({
      from: (table: unknown) => ({
        where: (..._args: unknown[]) => {
          if (table === requestsTable) return chainLimit(h.requests);
          if (table === jobsTable) return chainLimit(h.jobs);
          if (table === activityTable) return chainLimit(h.activity);
          if (table === trucksTable) return chainLimit([]);
          return chainLimit([]);
        },
        orderBy: () => ({ limit: () => Promise.resolve(h.activity) }),
      }),
    }),
  };
  return { db, requestsTable, jobsTable, activityTable, trucksTable };
});

vi.mock("../middlewares/requireAuth", () => ({
  requireProfile: (_req: any, _res: any, next: any) => next(),
  getRequestProfile: () => h.profile,
}));

import copilotRouter from "./copilot";

function makeApp(): Express {
  const app = express();
  app.use(express.json());
  app.use(copilotRouter);
  return app;
}

describe("AI Copilot", () => {
  beforeEach(() => {
    h.profile = { id: 1, role: "customer", companyName: "Acme" };
  });

  it("returns insights with suggestions", async () => {
    const res = await request(makeApp()).get("/copilot/insights");
    expect(res.status).toBe(200);
    expect(res.body.suggestions).toBeInstanceOf(Array);
    expect(res.body.summary.openLoads).toBe(1);
  });

  it("answers chat about open loads", async () => {
    const res = await request(makeApp())
      .post("/copilot/chat")
      .send({ message: "Show open requests" });
    expect(res.status).toBe(200);
    expect(res.body.content).toContain("open load");
  });

  it("rejects empty chat message", async () => {
    const res = await request(makeApp())
      .post("/copilot/chat")
      .send({ message: "" });
    expect(res.status).toBe(400);
  });
});
