import { beforeEach, describe, expect, it, vi } from "vitest";
import express, { type Express } from "express";
import request from "supertest";

const h = vi.hoisted(() => ({
  profile: { id: 1, role: "driver" } as Record<string, unknown>,
  jobs: [] as Record<string, unknown>[],
  assigned: true,
  locations: [] as Record<string, unknown>[],
  routeRows: [] as Record<string, unknown>[],
}));

vi.mock("@workspace/db", () => {
  const makeTable = (name: string) =>
    new Proxy({}, { get: (_target, prop) => `${name}.${String(prop)}` });
  const driverLocationsTable = makeTable("driverLocations");
  const routeSnapshotsTable = makeTable("routeSnapshots");
  const jobsTable = makeTable("jobs");
  const ticketsTable = makeTable("tickets");
  const profilesTable = makeTable("profiles");
  const projectAssignmentsTable = makeTable("projectAssignments");
  const db = {
    select: () => ({
      from: (table: unknown) => ({
        where: () => {
          if (table === jobsTable) return Promise.resolve(h.jobs);
          if (table === ticketsTable) return Promise.resolve(h.assigned ? [{ id: 1 }] : []);
          if (table === driverLocationsTable) {
            return { orderBy: () => ({ limit: () => Promise.resolve(h.locations) }) };
          }
          return Promise.resolve([]);
        },
      }),
    }),
    insert: (table: unknown) => ({
      values: (values: Record<string, unknown>) => {
        const row = recordInsert(table, values);
        return { returning: () => Promise.resolve([row]) };
      },
    }),
  };
  function recordInsert(table: unknown, values: Record<string, unknown>) {
    const row = { id: h.locations.length + h.routeRows.length + 1, ...values };
    if (table === driverLocationsTable && !h.locations.includes(row)) h.locations.push(row);
    if (table === routeSnapshotsTable && !h.routeRows.includes(row)) h.routeRows.push(row);
    return row;
  }
  return { db, driverLocationsTable, routeSnapshotsTable, jobsTable, ticketsTable, profilesTable, projectAssignmentsTable };
});

vi.mock("../middlewares/requireAuth", () => ({
  requireProfile: (req: any, _res: any, next: any) => {
    req.profile = h.profile;
    next();
  },
  getRequestProfile: (req: any) => req.profile,
}));

vi.mock("../lib/googleMapsService", () => ({
  geocodeAddress: vi.fn(async () => ({ status: "OK", results: [{ formatted_address: "1 Main St" }] })),
  reverseGeocode: vi.fn(async () => ({ status: "OK", results: [{ formatted_address: "1 Main St" }] })),
  placesAutocomplete: vi.fn(async () => ({ status: "OK", predictions: [{ description: "1 Main St" }] })),
  calculateRoute: vi.fn(async () => ({
    distanceMeters: 1609,
    durationSeconds: 300,
    trafficDurationSeconds: 420,
    eta: "2026-06-30T20:00:00.000Z",
    encodedPolyline: "abc",
    providerPayload: { routes: [] },
  })),
}));

vi.mock("../lib/access", () => ({
  DRIVER_SIDE: new Set(["provider", "driver"]),
  loadJobIfMember: async (_jobId: number, profile: any) => {
    const job = h.jobs[0];
    if (!job) return null;
    if ([1, 20, 30].includes(profile.id) || profile.staffRole) return job;
    return null;
  },
  isDriverAssignedToJob: async () => h.assigned,
}));

import mapsRouter from "./maps";

function makeApp(): Express {
  const app = express();
  app.use(express.json());
  app.use(mapsRouter);
  return app;
}

beforeEach(() => {
  h.profile = { id: 1, role: "driver" };
  h.jobs = [{ id: 9, customerId: 20, providerId: 30 }];
  h.assigned = true;
  h.locations = [];
  h.routeRows = [];
});

describe("maps routes", () => {
  it("records driver location updates for assigned jobs", async () => {
    const res = await request(makeApp()).post("/locations/me").send({
      jobId: 9,
      latitude: 32.7767,
      longitude: -96.797,
      speedMph: 42,
      headingDegrees: 180,
      status: "en_route",
      recordedAt: "2026-06-30T19:00:00.000Z",
    });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      jobId: 9,
      driverProfileId: 1,
      latitude: 32.7767,
      longitude: -96.797,
      speedMph: 42,
      headingDegrees: 180,
      status: "en_route",
    });
  });

  it("rejects an unassigned driver location update", async () => {
    h.assigned = false;
    const res = await request(makeApp()).post("/locations/me").send({
      jobId: 9,
      latitude: 32.7767,
      longitude: -96.797,
    });

    expect(res.status).toBe(403);
  });

  it("returns tracking only for jobs visible to the actor", async () => {
    h.profile = { id: 20, role: "customer" };
    h.locations = [{
      id: 1,
      jobId: 9,
      driverProfileId: 1,
      latitude: "32.7767000",
      longitude: "-96.7970000",
      speedMph: "42.00",
      headingDegrees: "180.00",
      accuracyMeters: null,
      recordedAt: new Date("2026-06-30T19:00:00.000Z"),
    }];

    const res = await request(makeApp()).get("/maps/jobs/9/tracking");

    expect(res.status).toBe(200);
    expect(res.body.locations[0]).toMatchObject({ latitude: 32.7767, longitude: -96.797 });
  });

  it("persists route snapshots for job route calculations", async () => {
    h.profile = { id: 20, role: "customer" };
    const res = await request(makeApp()).post("/maps/routes").send({
      jobId: 9,
      origin: "Dallas, TX",
      destination: "Fort Worth, TX",
    });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ distanceMeters: 1609, trafficDurationSeconds: 420 });
    expect(h.routeRows[0]).toMatchObject({
      jobId: 9,
      requestedByProfileId: 20,
      distanceMeters: 1609,
      durationSeconds: 300,
      trafficDurationSeconds: 420,
      encodedPolyline: "abc",
    });
  });
});
