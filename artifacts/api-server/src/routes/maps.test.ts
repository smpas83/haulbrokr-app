import { beforeEach, describe, expect, it, vi } from "vitest";
import express, { type Express } from "express";
import request from "supertest";

const h = vi.hoisted(() => ({
  rows: new Map<unknown, unknown[]>(),
  inserts: [] as Record<string, unknown>[],
  updates: [] as Record<string, unknown>[],
  profile: { id: 1, role: "customer", staffRole: null, organizationId: null, orgRole: "owner" } as any,
  admin: false,
  job: null as any,
  assigned: true,
}));

vi.mock("@workspace/db", () => {
  const makeTable = (name: string) =>
    new Proxy({}, { get: (_t, p) => `${name}.${String(p)}` });
  const db = {
    select: () => ({
      from: (table: unknown) => ({
        where: () => Promise.resolve(h.rows.get(table) ?? []),
      }),
    }),
    insert: () => ({
      values: (vals: Record<string, unknown>) => {
        h.inserts.push(vals);
        return {
          returning: () => Promise.resolve([{ id: h.inserts.length, createdAt: new Date(), updatedAt: new Date(), ...vals }]),
        };
      },
    }),
    update: () => ({
      set: (vals: Record<string, unknown>) => {
        h.updates.push(vals);
        return {
          where: () => ({
            returning: () => Promise.resolve([{ id: h.updates.length, createdAt: new Date(), updatedAt: new Date(), ...vals }]),
          }),
        };
      },
    }),
  };
  return {
    db,
    jobsTable: makeTable("jobs"),
    jobRoutesTable: makeTable("jobRoutes"),
    ticketsTable: makeTable("tickets"),
    trackingAuditLogsTable: makeTable("trackingAuditLogs"),
    tripLocationHistoryTable: makeTable("tripLocationHistory"),
    truckLocationsTable: makeTable("truckLocations"),
    trucksTable: makeTable("trucks"),
  };
});

vi.mock("../middlewares/requireAuth", () => ({
  requireProfile: (req: any, _res: any, next: any) => {
    req.profile = h.profile;
    next();
  },
  getRequestProfile: (req: any) => req.profile,
}));

vi.mock("../middlewares/requireAdmin", () => ({
  isAdmin: vi.fn(async () => h.admin),
}));

vi.mock("../lib/access", () => ({
  DRIVER_SIDE: new Set(["provider", "driver"]),
  CUSTOMER_SIDE: new Set(["customer", "supervisor"]),
  isOrgManager: vi.fn((profile: any) => profile.orgRole === "owner" || profile.orgRole === "admin" || profile.role === "provider"),
  loadJobIfMember: vi.fn(async () => h.job),
  isDriverAssignedToJob: vi.fn(async () => h.assigned),
}));

vi.mock("../lib/googleMaps", () => ({
  assertValidLatLng: vi.fn((value: any) => {
    if (value.lat < -90 || value.lat > 90) throw Object.assign(new Error("Latitude must be between -90 and 90."), { status: 400 });
    if (value.lng < -180 || value.lng > 180) throw Object.assign(new Error("Longitude must be between -180 and 180."), { status: 400 });
  }),
  geocodeAddress: vi.fn(async (address: string) => ({
    formattedAddress: address,
    placeId: "place_1",
    location: { lat: 33.5, lng: -86.8 },
  })),
  placesAutocomplete: vi.fn(async () => ([{ placeId: "p1", description: "100 Main", mainText: "100 Main", secondaryText: "Birmingham" }])),
  calculateTrafficAwareRoute: vi.fn(async () => ({
    origin: { lat: 33.5, lng: -86.8 },
    destination: { lat: 33.6, lng: -86.7 },
    encodedPolyline: "encoded",
    distanceMeters: 12000,
    durationSeconds: 700,
    trafficDurationSeconds: 900,
    etaAt: new Date("2026-06-30T04:00:00Z"),
    calculatedAt: new Date("2026-06-30T03:45:00Z"),
  })),
  distanceMeters: vi.fn((a: any, b: any) => {
    if (a.lat === b.lat && a.lng === b.lng) return 0;
    return 999999;
  }),
}));

import mapsRouter from "./maps";
import { jobsTable, jobRoutesTable, ticketsTable, truckLocationsTable, trucksTable } from "@workspace/db";

function makeApp(): Express {
  const app = express();
  app.use(express.json());
  app.use(mapsRouter);
  return app;
}

function baseJob(overrides: Record<string, unknown> = {}) {
  return {
    id: 10,
    customerId: 1,
    providerId: 2,
    status: "in_progress",
    pickupAddress: "Pit",
    deliveryAddress: "Site",
    ...overrides,
  };
}

beforeEach(() => {
  h.rows.clear();
  h.inserts = [];
  h.updates = [];
  h.profile = { id: 1, role: "customer", staffRole: null, organizationId: null, orgRole: "owner" };
  h.admin = false;
  h.job = baseJob();
  h.assigned = true;
});

describe("maps/tracking routes", () => {
  it("geocodes addresses and proxies places autocomplete without returning API keys", async () => {
    const geocode = await request(makeApp()).post("/maps/geocode").send({ address: "100 Main" });
    expect(geocode.status).toBe(200);
    expect(geocode.body.location).toEqual({ lat: 33.5, lng: -86.8 });
    expect(JSON.stringify(geocode.body)).not.toContain("google");

    const places = await request(makeApp()).get("/maps/places/autocomplete?input=100");
    expect(places.status).toBe(200);
    expect(places.body.predictions).toHaveLength(1);
  });

  it("calculates and stores a job route for authorized job members", async () => {
    h.rows.set(jobRoutesTable, []);

    const res = await request(makeApp()).post("/maps/route").send({ jobId: 10 });

    expect(res.status).toBe(200);
    expect(res.body.savedRoute.routeDistanceMeters).toBe(12000);
    expect(h.inserts.find((i) => i.jobId === 10 && i.routePolyline === "encoded")).toBeTruthy();
    expect(h.inserts.find((i) => i.eventType === "route_calculated")).toBeTruthy();
  });

  it("accepts assigned driver location updates and records history/audit rows", async () => {
    h.profile = { id: 4, role: "driver", staffRole: null, organizationId: 2, orgRole: "member" };
    h.job = baseJob({ providerId: 2 });
    h.rows.set(truckLocationsTable, []);

    const res = await request(makeApp()).post("/tracking/driver-location").send({
      jobId: 10,
      truckId: 99,
      lat: 33.5,
      lng: -86.8,
      heading: 90,
    });

    expect(res.status).toBe(200);
    expect(res.body.location.truckId).toBe(99);
    expect(h.inserts.find((i) => i.driverProfileId === 4 && i.jobId === 10)).toBeTruthy();
    expect(h.inserts.find((i) => i.eventType === "driver_location_updated")).toBeTruthy();
  });

  it("blocks unassigned driver location updates for another trip", async () => {
    h.profile = { id: 5, role: "driver", staffRole: null, organizationId: 2, orgRole: "member" };
    h.assigned = false;

    const res = await request(makeApp()).post("/tracking/driver-location").send({
      jobId: 10,
      truckId: 100,
      lat: 33.5,
      lng: -86.8,
    });

    expect(res.status).toBe(403);
  });

  it("returns exact live tracking only for authorized booked-trip viewers", async () => {
    h.rows.set(jobsTable, [baseJob()]);
    h.rows.set(ticketsTable, [{ id: 1, jobId: 10, driverProfileId: 4, truckId: 99, status: "in_progress" }]);
    h.rows.set(truckLocationsTable, [{
      id: 1,
      truckId: 99,
      driverProfileId: 4,
      jobId: 10,
      lat: "33.5000000",
      lng: "-86.8000000",
      recordedAt: new Date(),
      isStale: 0,
      offRouteStatus: "unknown",
      etaRecalculationRequestedAt: null,
      heading: null,
      speedMps: null,
      accuracyMeters: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }]);
    h.rows.set(jobRoutesTable, []);

    const res = await request(makeApp()).get("/tracking/trips/10/live");

    expect(res.status).toBe(200);
    expect(res.body.locations).toHaveLength(1);
    expect(res.body.locations[0]).toMatchObject({ truckId: 99, lat: 33.5, lng: -86.8 });
  });

  it("returns approximate nearby truck counts without exact locations", async () => {
    h.rows.set(truckLocationsTable, [
      { id: 1, truckId: 1, driverProfileId: 4, jobId: null, lat: "33.5000000", lng: "-86.8000000", recordedAt: new Date(), isStale: 0, offRouteStatus: "unknown", etaRecalculationRequestedAt: null, heading: null, speedMps: null, accuracyMeters: null, createdAt: new Date(), updatedAt: new Date() },
      { id: 2, truckId: 2, driverProfileId: 5, jobId: null, lat: "34.0000000", lng: "-87.0000000", recordedAt: new Date(), isStale: 0, offRouteStatus: "unknown", etaRecalculationRequestedAt: null, heading: null, speedMps: null, accuracyMeters: null, createdAt: new Date(), updatedAt: new Date() },
    ]);

    const res = await request(makeApp()).get("/maps/nearby-trucks/count?lat=33.5&lng=-86.8&radiusMiles=10");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ count: 1, radiusMiles: 10 });
    expect(res.body.locations).toBeUndefined();
  });

  it("enforces dispatcher and fleet visibility rules", async () => {
    let res = await request(makeApp()).get("/maps/dispatcher/active");
    expect(res.status).toBe(403);

    h.admin = true;
    h.rows.set(jobsTable, [baseJob()]);
    h.rows.set(ticketsTable, [{ id: 1, jobId: 10, driverProfileId: 4, truckId: 99, status: "in_progress" }]);
    h.rows.set(truckLocationsTable, []);
    res = await request(makeApp()).get("/maps/dispatcher/active");
    expect(res.status).toBe(200);
    expect(res.body.jobs).toHaveLength(1);

    h.admin = false;
    h.profile = { id: 2, role: "provider", staffRole: null, organizationId: 2, orgRole: "owner" };
    h.rows.set(trucksTable, [{ id: 99, ownerId: 2 }]);
    res = await request(makeApp()).get("/maps/fleet/active");
    expect(res.status).toBe(200);
  });
});
