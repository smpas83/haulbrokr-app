import { describe, it, expect, beforeEach, vi } from "vitest";
import express, { type Express } from "express";
import request from "supertest";

const h = vi.hoisted(() => ({
  profile: null as any,
  snapshot: null as any,
}));

vi.mock("../middlewares/requireAuth", () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    req.clerkId = "test-clerk";
    next();
  },
}));

vi.mock("@workspace/db", () => {
  const profilesTable = { _: "profiles" };
  const db = {
    select: () => ({
      from: () => ({
        where: () => Promise.resolve(h.profile ? [h.profile] : []),
      }),
    }),
  };
  return { db, profilesTable, organizationsTable: {} };
});

vi.mock("../lib/adminComplianceBundle", () => ({
  getCarrierComplianceSnapshot: async (profileId: number) => {
    if (profileId !== 42) return null;
    return h.snapshot;
  },
}));

import organizationsRouter from "./organizations";

function makeApp(): Express {
  const app = express();
  app.use(express.json());
  app.use(organizationsRouter);
  return app;
}

beforeEach(() => {
  h.profile = { id: 7, role: "driver", organizationId: 42, clerkId: "test-clerk" };
  h.snapshot = {
    w9Status: "verified",
    insuranceStatus: "pending",
    dotCdlStatus: "verified",
    payoutStatus: "pending",
    canBid: false,
    w9ReviewNote: null,
    insuranceReviewNote: null,
    dotCdlReviewNote: null,
  };
});

describe("GET /organizations/compliance-status", () => {
  it("returns carrier compliance snapshot for org members", async () => {
    const res = await request(makeApp()).get("/organizations/compliance-status");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      w9Status: "verified",
      insuranceStatus: "pending",
      dotCdlStatus: "verified",
      canBid: false,
    });
  });

  it("returns 404 when user has no organization", async () => {
    h.profile = { id: 7, role: "driver", organizationId: null, clerkId: "test-clerk" };
    const res = await request(makeApp()).get("/organizations/compliance-status");
    expect(res.status).toBe(404);
  });
});
