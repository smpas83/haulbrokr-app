import { describe, it, expect, beforeEach, vi } from "vitest";
import express from "express";
import request from "supertest";

const h = vi.hoisted(() => ({
  openCount: 0,
  activeJobCount: 0,
  truckCount: 0,
}));

vi.mock("@workspace/db", () => {
  const requestsTable = { __table: "requests" as const };
  const jobsTable = { __table: "jobs" as const };
  const trucksTable = { __table: "trucks" as const };
  const profilesTable = { __table: "profiles" as const };
  const bidsTable = { __table: "bids" as const };

  const countFor = (table: { __table?: string }) => {
    if (table.__table === "requests") return [{ count: h.openCount }];
    if (table.__table === "jobs") return [{ count: h.activeJobCount }];
    if (table.__table === "trucks") return [{ count: h.truckCount }];
    if (table.__table === "profiles") return [{ count: 0 }];
    return [{ count: 0 }];
  };

  const db = {
    select: () => ({
      from: (table: { __table?: string }) => {
        const countPromise = Promise.resolve(countFor(table));
        return {
          then: (...args: Parameters<Promise<{ count: number }[]>[typeof Promise.prototype.then]>) =>
            countPromise.then(...args),
          where: () => countPromise,
          leftJoin: () => ({ limit: () => Promise.resolve([]) }),
          limit: () => Promise.resolve([]),
          orderBy: () => ({ limit: () => Promise.resolve([]) }),
        };
      },
    }),
  };

  return {
    db,
    requestsTable,
    jobsTable,
    trucksTable,
    profilesTable,
    bidsTable,
  };
});

vi.mock("../middlewares/requireAuth", () => ({
  requireProfile: (req: any, _res: any, next: any) => {
    req.profile = { id: 1, role: "provider" };
    next();
  },
  getRequestProfile: (req: any) => req.profile,
}));

vi.mock("../lib/geocodeCache", () => ({
  geocodeAddressCached: vi.fn(async (address: string) => {
    if (address.includes("Unknown")) return null;
    return { latitude: 32.7767, longitude: -96.797 };
  }),
  resetGeocodeCacheForTests: vi.fn(),
}));

import mapRouter from "./map";

function app() {
  const a = express();
  a.use(express.json());
  a.use("/api", mapRouter);
  return a;
}

describe("GET /api/map/marketplace", () => {
  beforeEach(() => {
    h.openCount = 0;
    h.activeJobCount = 0;
    h.truckCount = 0;
  });

  it("returns empty marketplace when DB is empty", async () => {
    const res = await request(app()).get("/api/map/marketplace");
    expect(res.status).toBe(200);
    expect(res.body.demoMode).toBe(false);
    expect(res.body.loads).toEqual([]);
    expect(res.body.trucks).toEqual([]);
    expect(res.body.heatZones).toEqual([]);
    expect(res.body.stats.openLoads).toBe(0);
  });

  it("aliases /api/maps to the same payload", async () => {
    const res = await request(app()).get("/api/maps");
    expect(res.status).toBe(200);
    expect(res.body.demoMode).toBe(false);
    expect(res.body.loads).toEqual([]);
  });
});

describe("POST /api/maps/geocode", () => {
  it("returns coordinates for a valid address", async () => {
    const res = await request(app())
      .post("/api/maps/geocode")
      .send({ address: "123 Main St, Dallas, TX" });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ latitude: 32.7767, longitude: -96.797 });
  });

  it("returns 404 when geocoding fails", async () => {
    const res = await request(app())
      .post("/api/maps/geocode")
      .send({ address: "Unknown place xyz" });
    expect(res.status).toBe(404);
  });

  it("returns 400 for invalid body", async () => {
    const res = await request(app()).post("/api/maps/geocode").send({ address: "ab" });
    expect(res.status).toBe(400);
  });
});
