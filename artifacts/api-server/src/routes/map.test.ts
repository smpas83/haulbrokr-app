import { describe, it, expect, beforeEach, vi } from "vitest";
import express from "express";
import request from "supertest";

const h = vi.hoisted(() => ({
  openCount: 0,
  activeJobCount: 0,
  truckCount: 0,
}));

vi.mock("@workspace/db", () => {
  const makeTable = (name: string) =>
    new Proxy({}, { get: (_t, p) => `${name}.${String(p)}` });
  const countFor = (table: unknown) => {
    const token = String(table);
    if (token.includes("requests")) return [{ count: h.openCount }];
    if (token.includes("jobs")) return [{ count: h.activeJobCount }];
    if (token.includes("trucks")) return [{ count: h.truckCount }];
    if (token.includes("profiles")) return [{ count: 0 }];
    return [{ count: 0 }];
  };
  const db = {
    select: () => ({
      from: (table: unknown) => ({
        where: () => ({
          orderBy: () => ({
            limit: () => Promise.resolve([]),
          }),
          limit: () => Promise.resolve([]),
        }),
        leftJoin: () => ({
          limit: () => Promise.resolve([]),
        }),
        limit: () => Promise.resolve([]),
      }),
    }),
  };
  // Patch count queries used by countLiveMarketplaceRows
  const origSelect = db.select;
  db.select = () => ({
    from: (table: unknown) => ({
      where: () => Promise.resolve(countFor(table)),
      leftJoin: () => ({ limit: () => Promise.resolve([]) }),
      limit: () => Promise.resolve([]),
      orderBy: () => ({ limit: () => Promise.resolve([]) }),
    }),
  });
  return {
    db,
    requestsTable: makeTable("requests"),
    jobsTable: makeTable("jobs"),
    trucksTable: makeTable("trucks"),
    profilesTable: makeTable("profiles"),
    bidsTable: makeTable("bids"),
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

  it("returns demo marketplace when DB is empty", async () => {
    const res = await request(app()).get("/api/map/marketplace");
    expect(res.status).toBe(200);
    expect(res.body.demoMode).toBe(true);
    expect(res.body.loads.length).toBe(250);
    expect(res.body.trucks.length).toBe(150);
    expect(res.body.heatZones.length).toBeGreaterThan(0);
  });

  it("aliases /api/maps to the same payload", async () => {
    const res = await request(app()).get("/api/maps");
    expect(res.status).toBe(200);
    expect(res.body.demoMode).toBe(true);
    expect(res.body.loads.length).toBe(250);
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
