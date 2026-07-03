import { describe, it, expect, beforeEach, vi } from "vitest";
import express, { type Express } from "express";
import request from "supertest";

const h = vi.hoisted(() => ({
  profile: { id: 30, role: "driver", companyName: "Haul Co", contactName: "Dave" } as Record<string, unknown>,
  jobs: [] as Record<string, unknown>[],
  tickets: [] as Record<string, unknown>[],
  locations: [] as Record<string, unknown>[],
  geofences: [] as Record<string, unknown>[],
  availability: [] as Record<string, unknown>[],
  timeline: [] as Record<string, unknown>[],
  trucks: [] as Record<string, unknown>[],
  profiles: [] as Record<string, unknown>[],
  nextLocationId: 1,
  nextGeofenceId: 1,
  nextAvailabilityId: 1,
  nextTimelineId: 1,
}));

vi.mock("@workspace/db", () => {
  const makeTable = (name: string) =>
    new Proxy({}, { get: (_t, p) => `${name}.${String(p)}` });

  const jobsTable = makeTable("jobs");
  const ticketsTable = makeTable("tickets");
  const trucksTable = makeTable("trucks");
  const vehicleLocationsTable = makeTable("vehicle_locations");
  const jobGeofencesTable = makeTable("job_geofences");
  const driverAvailabilityTable = makeTable("driver_availability");
  const jobStatusUpdatesTable = makeTable("job_status_updates");
  const profilesTable = makeTable("profiles");

  const rowsFor = (table: unknown) => {
    if (table === jobsTable) return h.jobs;
    if (table === ticketsTable) return h.tickets;
    if (table === trucksTable) return h.trucks;
    if (table === vehicleLocationsTable) {
      return [...h.locations].sort((a, b) =>
        new Date(String(b.recordedAt)).getTime() - new Date(String(a.recordedAt)).getTime(),
      );
    }
    if (table === jobGeofencesTable) return h.geofences;
    if (table === driverAvailabilityTable) return h.availability;
    if (table === jobStatusUpdatesTable) return h.timeline;
    if (table === profilesTable) return h.profiles;
    return [];
  };

  const chain = (rows: Record<string, unknown>[]) => ({
    where: () => chain(rows),
    orderBy: () => chain(rows),
    limit: (count: number) => Promise.resolve(rows.slice(0, count)),
    then(onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) {
      return Promise.resolve(rows).then(onFulfilled, onRejected);
    },
  });

  const db = {
    select: () => ({
      from: (table: unknown) => chain(rowsFor(table)),
    }),
    insert: (table: unknown) => ({
      values: (vals: Record<string, unknown> | Record<string, unknown>[]) => {
        const many = Array.isArray(vals) ? vals : [vals];
        if (table === vehicleLocationsTable) {
          const rows = many.map((value) => ({ id: h.nextLocationId++, createdAt: new Date(), ...value }));
          h.locations.push(...rows);
          return { returning: () => Promise.resolve(rows) };
        }
        if (table === jobGeofencesTable) {
          const [row] = many.map((value) => ({
            id: h.nextGeofenceId++,
            createdAt: new Date(),
            updatedAt: new Date(),
            ...value,
          }));
          h.geofences.push(row);
          return { returning: () => Promise.resolve([row]) };
        }
        if (table === driverAvailabilityTable) {
          const [row] = many.map((value) => ({
            id: h.nextAvailabilityId++,
            updatedAt: new Date(),
            ...value,
          }));
          h.availability.push(row);
          return { returning: () => Promise.resolve([row]) };
        }
        if (table === jobStatusUpdatesTable) {
          const [row] = many.map((value) => ({ id: h.nextTimelineId++, createdAt: new Date(), ...value }));
          h.timeline.push(row);
          return Promise.resolve(undefined);
        }
        return { returning: () => Promise.resolve(many) };
      },
    }),
    update: (table: unknown) => ({
      set: (vals: Record<string, unknown>) => ({
        where: () => ({
          returning: () => {
            if (table === driverAvailabilityTable) {
              const row = h.availability[0];
              if (row) Object.assign(row, vals, { updatedAt: new Date() });
              return Promise.resolve(row ? [row] : []);
            }
            return Promise.resolve([]);
          },
        }),
      }),
    }),
  };

  return {
    db,
    jobsTable,
    ticketsTable,
    trucksTable,
    vehicleLocationsTable,
    jobGeofencesTable,
    driverAvailabilityTable,
    jobStatusUpdatesTable,
    profilesTable,
  };
});

vi.mock("../middlewares/requireAuth", () => ({
  requireProfile: (req: any, _res: any, next: any) => {
    req.profile = { ...h.profile };
    next();
  },
  getRequestProfile: (req: any) => req.profile,
}));

vi.mock("../lib/access", () => ({
  loadJobIfMember: async (jobId: number) => h.jobs.find((j) => j.id === jobId) ?? null,
  orgScopedActorIds: async () => [h.profile.id],
  isOrgManager: () => true,
  DRIVER_SIDE: new Set(["provider", "driver"]),
  CUSTOMER_SIDE: new Set(["customer", "supervisor"]),
}));

import liveOpsRouter from "./live-ops";

function makeApp(): Express {
  const app = express();
  app.use(express.json());
  app.use(liveOpsRouter);
  return app;
}

function sampleJob(overrides: Record<string, unknown> = {}) {
  return {
    id: 9,
    customerId: 10,
    providerId: 20,
    status: "in_progress",
    pickupAddress: "Quarry A",
    deliveryAddress: "Site B",
    ...overrides,
  };
}

beforeEach(() => {
  h.profile = { id: 30, role: "driver", companyName: "Haul Co", contactName: "Dave" };
  h.jobs = [sampleJob()];
  h.tickets = [{
    id: 1,
    jobId: 9,
    driverProfileId: 30,
    truckId: 7,
    loadNumber: 1,
    status: "in_progress",
    createdAt: new Date(),
  }];
  h.locations = [];
  h.geofences = [];
  h.availability = [];
  h.timeline = [];
  h.trucks = [{
    id: 7,
    ownerId: 20,
    assignedDriverId: 30,
    truckType: "dump_truck",
    capacityTons: "18.00",
    ratePerHour: "120.00",
    isAvailable: false,
    createdAt: new Date(),
  }];
  h.profiles = [{ id: 30, contactName: "Dave", companyName: "Haul Co" }];
  h.nextLocationId = 1;
  h.nextGeofenceId = 1;
  h.nextAvailabilityId = 1;
  h.nextTimelineId = 1;
});

describe("live operations routes", () => {
  it("ingests driver GPS, updates availability, and triggers a pickup geofence", async () => {
    h.geofences = [{
      id: 1,
      jobId: 9,
      kind: "pickup",
      latitude: "32.7767000",
      longitude: "-96.7970000",
      radiusMeters: 150,
      label: "Pickup",
      createdAt: new Date(),
      updatedAt: new Date(),
    }];

    const res = await request(makeApp()).post("/tickets/1/locations").send({
      latitude: 32.7767,
      longitude: -96.797,
      speedMph: 18,
      recordedAt: "2026-07-01T16:00:00.000Z",
    });

    expect(res.status).toBe(201);
    expect(res.body.latestLocation.latitude).toBe(32.7767);
    expect(res.body.triggeredGeofences).toEqual(["pickup"]);
    expect(h.availability[0]).toMatchObject({ driverProfileId: 30, isOnline: true, currentTicketId: 1 });
    expect(h.timeline[0]).toMatchObject({ jobId: 9, ticketId: 1, status: "arrived" });
  });

  it("blocks location writes from an unassigned driver", async () => {
    h.profile = { id: 31, role: "driver", companyName: "Other Co" };

    const res = await request(makeApp()).post("/tickets/1/locations").send({
      latitude: 32.7767,
      longitude: -96.797,
    });

    expect(res.status).toBe(404);
    expect(h.locations).toHaveLength(0);
  });

  it("returns live tracking and route history for job members", async () => {
    h.profile = { id: 10, role: "customer", companyName: "Customer Co" };
    h.geofences = [
      { id: 1, jobId: 9, kind: "pickup", latitude: "32.7767000", longitude: "-96.7970000", radiusMeters: 150, createdAt: new Date(), updatedAt: new Date() },
      { id: 2, jobId: 9, kind: "delivery", latitude: "32.7867000", longitude: "-96.8070000", radiusMeters: 150, createdAt: new Date(), updatedAt: new Date() },
    ];
    h.locations = [{
      id: 1,
      jobId: 9,
      ticketId: 1,
      driverProfileId: 30,
      truckId: 7,
      latitude: "32.7800000",
      longitude: "-96.8000000",
      speedMph: "20.00",
      recordedAt: new Date("2026-07-01T16:00:00.000Z"),
      createdAt: new Date(),
    }];

    const tracking = await request(makeApp()).get("/jobs/9/tracking");
    expect(tracking.status).toBe(200);
    expect(tracking.body.latestLocation.ticketId).toBe(1);
    expect(tracking.body.eta.minutes).toBeGreaterThan(0);
    expect(tracking.body.routeProgress).toBeGreaterThan(0);

    const history = await request(makeApp()).get("/jobs/9/locations?since=2026-07-01T15:00:00.000Z");
    expect(history.status).toBe(200);
    expect(history.body).toHaveLength(1);
  });

  it("persists driver online/offline state", async () => {
    const online = await request(makeApp()).patch("/drivers/me/availability").send({
      isOnline: true,
      currentTicketId: 1,
    });
    expect(online.status).toBe(200);
    expect(online.body).toMatchObject({ driverProfileId: 30, isOnline: true, currentTicketId: 1 });

    const offline = await request(makeApp()).patch("/drivers/me/availability").send({
      isOnline: false,
      currentTicketId: null,
    });
    expect(offline.status).toBe(200);
    expect(offline.body).toMatchObject({ driverProfileId: 30, isOnline: false, currentTicketId: null });
  });

  it("returns dispatcher live fleet rows with active trip state", async () => {
    h.profile = { id: 20, role: "provider", companyName: "Haul Co" };
    h.availability = [{
      id: 1,
      driverProfileId: 30,
      isOnline: true,
      currentTicketId: 1,
      lastSeenAt: new Date(),
      updatedAt: new Date(),
    }];
    h.locations = [{
      id: 1,
      jobId: 9,
      ticketId: 1,
      driverProfileId: 30,
      truckId: 7,
      latitude: "32.7800000",
      longitude: "-96.8000000",
      recordedAt: new Date(),
      createdAt: new Date(),
    }];

    const res = await request(makeApp()).get("/fleet/live");

    expect(res.status).toBe(200);
    expect(res.body.trucks[0].state).toBe("on_trip");
    expect(res.body.trucks[0].driver.isOnline).toBe(true);
    expect(res.body.trucks[0].activeTrip).toMatchObject({ ticketId: 1, jobId: 9 });
  });
});
