import { describe, it, expect, beforeEach, vi } from "vitest";
import express, { type Express } from "express";
import request from "supertest";

const h = vi.hoisted(() => ({
  profile: { id: 1, role: "customer", companyName: "Test Builders" } as Record<
    string,
    unknown
  >,
  requests: [] as Record<string, unknown>[],
  nextRequestId: 1,
  inserts: [] as Record<string, unknown>[],
}));

vi.mock("@workspace/db", () => {
  const makeTable = (name: string) =>
    new Proxy({}, { get: (_t, p) => `${name}.${String(p)}` });

  const requestsTable = makeTable("requests");
  const profilesTable = makeTable("profiles");
  const bidsTable = makeTable("bids");
  const activityTable = makeTable("activity");

  const db = {
    select: () => ({
      from: (table: unknown) => ({
        where: (..._args: unknown[]) => {
          if (table === requestsTable) return Promise.resolve(h.requests);
          if (table === profilesTable)
            return Promise.resolve([{ companyName: "Test Builders" }]);
          if (table === bidsTable) return Promise.resolve([{ count: 0 }]);
          return Promise.resolve([]);
        },
        orderBy: () => Promise.resolve(h.requests),
      }),
    }),
    insert: (table: unknown) => ({
      values: (row: Record<string, unknown>) => {
        h.inserts.push(row);
        if (table === requestsTable) {
          const rec = {
            id: h.nextRequestId++,
            customerId: h.profile.id,
            status: "open",
            ...row,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          h.requests.push(rec);
          return { returning: () => Promise.resolve([rec]) };
        }
        if (table === activityTable) {
          return { returning: () => Promise.resolve([{ id: 1 }]) };
        }
        return { returning: () => Promise.resolve([]) };
      },
    }),
  };

  return { db, requestsTable, profilesTable, bidsTable, activityTable };
});

vi.mock("../middlewares/requireAuth", () => ({
  requireAuth: (_req: any, _res: any, next: any) => next(),
  requireProfile: (req: any, _res: any, next: any) => {
    req.profile = h.profile;
    next();
  },
  getRequestProfile: (req: any) => req.profile,
}));

import requestsRouter from "./requests";

function makeApp(): Express {
  const app = express();
  app.use(express.json());
  app.use(requestsRouter);
  return app;
}

const validBody = {
  materialType: "gravel",
  truckType: "dump_truck",
  quantityTons: 40,
  pickupAddress: "123 Quarry Rd, Houston, TX",
  deliveryAddress: "4250 Losee Rd, North Las Vegas, NV",
  scheduledDate: "2026-08-15T00:00:00.000Z",
  startTime: "07:30",
  estimatedHours: 6,
  trucksNeeded: 2,
  notes: "Gate code 4455",
};

beforeEach(() => {
  h.requests = [];
  h.inserts = [];
  h.nextRequestId = 1;
  h.profile = { id: 1, role: "customer", companyName: "Test Builders" };
});

describe("POST /requests job posting fields", () => {
  it("stores truck type, schedule, hours, trucks, and notes", async () => {
    const res = await request(makeApp()).post("/requests").send(validBody);

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      materialType: "gravel",
      truckType: "dump_truck",
      pickupAddress: validBody.pickupAddress,
      deliveryAddress: validBody.deliveryAddress,
      startTime: "07:30",
      estimatedHours: 6,
      trucksNeeded: 2,
      notes: "Gate code 4455",
      customerCompany: "Test Builders",
    });
    expect(h.inserts[0]).toMatchObject({
      truckType: "dump_truck",
      startTime: "07:30",
      estimatedHours: "6",
      trucksNeeded: 2,
      notes: "Gate code 4455",
    });
  });

  it("rejects invalid start time format", async () => {
    const res = await request(makeApp())
      .post("/requests")
      .send({ ...validBody, startTime: "7:30 AM" });

    expect(res.status).toBe(400);
    expect(h.requests).toHaveLength(0);
  });

  it("rejects missing truck type", async () => {
    const { truckType: _removed, ...body } = validBody;
    const res = await request(makeApp()).post("/requests").send(body);
    expect(res.status).toBe(400);
  });

  it("rejects providers posting requests", async () => {
    h.profile = { id: 2, role: "provider", companyName: "Haul Co" };
    const res = await request(makeApp()).post("/requests").send(validBody);
    expect(res.status).toBe(403);
  });
});

describe("GET /requests/:id", () => {
  it("returns posting details for the customer", async () => {
    h.requests.push({
      id: 9,
      customerId: 1,
      materialType: "dirt",
      truckType: "end_dump",
      quantityTons: "25",
      pickupAddress: "Site A",
      deliveryAddress: "Landfill B",
      scheduledDate: new Date("2026-09-01T00:00:00.000Z"),
      startTime: "06:00",
      estimatedHours: "8",
      status: "open",
      trucksNeeded: 3,
      notes: "Hard hat required",
      budgetPerHour: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const res = await request(makeApp()).get("/requests/9");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      truckType: "end_dump",
      startTime: "06:00",
      estimatedHours: 8,
      trucksNeeded: 3,
      notes: "Hard hat required",
    });
  });
});
