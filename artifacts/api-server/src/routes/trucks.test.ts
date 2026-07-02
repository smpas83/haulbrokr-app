import { describe, it, expect, beforeEach, vi } from "vitest";
import express, { type Express } from "express";
import request from "supertest";

const h = vi.hoisted(() => ({
  profile: { id: 1, role: "provider", companyName: "Haul Co" } as Record<string, unknown>,
  trucks: [] as Record<string, unknown>[],
}));

vi.mock("@workspace/db", () => {
  const makeTable = (name: string) =>
    new Proxy({}, { get: (_t, p) => `${name}.${String(p)}` });
  const trucksTable = makeTable("trucks");
  const db = {
    select: () => ({
      from: (table: unknown) => ({
        where: () => Promise.resolve(table === trucksTable ? h.trucks : []),
      }),
    }),
  };
  return { db, trucksTable, profilesTable: makeTable("profiles") };
});

vi.mock("../middlewares/requireAuth", () => ({
  requireProfile: (req: any, _res: any, next: any) => {
    req.profile = { ...h.profile };
    next();
  },
  getRequestProfile: (req: any) => req.profile,
}));

import trucksRouter from "./trucks";

function makeApp(): Express {
  const app = express();
  app.use(express.json());
  app.use(trucksRouter);
  return app;
}

function truck(overrides: Record<string, unknown> = {}) {
  return {
    id: 11,
    ownerId: 2,
    truckType: "dump_truck",
    capacityTons: "18",
    ratePerHour: "125",
    licensePlate: "HB-123",
    isAvailable: false,
    createdAt: new Date(),
    ...overrides,
  };
}

beforeEach(() => {
  h.profile = { id: 1, role: "provider", companyName: "Haul Co" };
  h.trucks = [truck()];
});

describe("GET /trucks/:id authorization", () => {
  it("returns unavailable trucks to their owner", async () => {
    h.profile = { id: 2, role: "provider", companyName: "Owner Co" };

    const res = await request(makeApp()).get("/trucks/11");

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(11);
  });

  it("returns available trucks to marketplace customers", async () => {
    h.profile = { id: 1, role: "customer", companyName: "Customer Co" };
    h.trucks = [truck({ isAvailable: true })];

    const res = await request(makeApp()).get("/trucks/11");

    expect(res.status).toBe(200);
    expect(res.body.isAvailable).toBe(true);
  });

  it("hides unavailable third-party trucks", async () => {
    h.profile = { id: 1, role: "customer", companyName: "Customer Co" };

    const res = await request(makeApp()).get("/trucks/11");

    expect(res.status).toBe(404);
  });
});
