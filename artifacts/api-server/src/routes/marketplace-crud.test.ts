import { describe, it, expect, beforeEach, vi } from "vitest";
import express, { type Express } from "express";
import request from "supertest";

const h = vi.hoisted(() => ({
  profile: { id: 1, role: "customer", companyName: "Test Co" } as Record<string, unknown>,
  trucks: [] as Record<string, unknown>[],
  requests: [] as Record<string, unknown>[],
  bids: [] as Record<string, unknown>[],
  nextTruckId: 1,
  nextRequestId: 1,
  nextBidId: 1,
}));

vi.mock("@workspace/db", () => {
  const makeTable = (name: string) =>
    new Proxy({}, { get: (_t, p) => `${name}.${String(p)}` });

  const trucksTable = makeTable("trucks");
  const requestsTable = makeTable("requests");
  const bidsTable = makeTable("bids");
  const profilesTable = makeTable("profiles");
  const activityTable = makeTable("activity");

  const db = {
    select: () => ({
      from: (table: unknown) => ({
        where: (..._args: unknown[]) => {
          if (table === trucksTable) return Promise.resolve(h.trucks);
          if (table === requestsTable) return Promise.resolve(h.requests);
          if (table === bidsTable) return Promise.resolve(h.bids);
          if (table === profilesTable) return Promise.resolve([{ companyName: "Test Co" }]);
          return Promise.resolve([]);
        },
        orderBy: (..._args: unknown[]) => {
          if (table === requestsTable) return Promise.resolve(h.requests);
          return Promise.resolve([]);
        },
      }),
    }),
    insert: (table: unknown) => ({
      values: (row: Record<string, unknown>) => ({
        returning: () => {
          if (table === trucksTable) {
            const truck = {
              id: h.nextTruckId++,
              ownerId: h.profile.id,
              capacityTons: String(row.capacityTons),
              ratePerHour: String(row.ratePerHour),
              truckType: row.truckType,
              isAvailable: true,
              coiStatus: "none",
              createdAt: new Date(),
              updatedAt: new Date(),
            };
            h.trucks.push(truck);
            return Promise.resolve([truck]);
          }
          if (table === requestsTable) {
            const req = {
              id: h.nextRequestId++,
              customerId: h.profile.id,
              status: "open",
              materialType: row.materialType,
              quantityTons: String(row.quantityTons),
              pickupAddress: row.pickupAddress,
              deliveryAddress: row.deliveryAddress,
              scheduledDate: row.scheduledDate,
              trucksNeeded: row.trucksNeeded ?? 1,
              createdAt: new Date(),
              updatedAt: new Date(),
            };
            h.requests.push(req);
            return Promise.resolve([req]);
          }
          if (table === bidsTable) {
            const bid = {
              id: h.nextBidId++,
              requestId: row.requestId,
              providerId: h.profile.id,
              ratePerHour: String(row.ratePerHour),
              trucksOffered: row.trucksOffered,
              status: "pending",
              createdAt: new Date(),
              updatedAt: new Date(),
            };
            h.bids.push(bid);
            return Promise.resolve([bid]);
          }
          if (table === activityTable) {
            return Promise.resolve([{ id: 1 }]);
          }
          return Promise.resolve([]);
        },
      }),
    }),
    update: (table: unknown) => ({
      set: (vals: Record<string, unknown>) => ({
        where: (..._args: unknown[]) => {
          if (table === requestsTable) {
            for (const r of h.requests) Object.assign(r, vals);
          }
          return Promise.resolve([]);
        },
      }),
    }),
    selectDistinct: () => ({ from: () => ({ where: () => Promise.resolve([]) }) }),
  };

  return {
    db,
    trucksTable,
    requestsTable,
    bidsTable,
    profilesTable,
    activityTable,
  };
});

vi.mock("../middlewares/requireAuth", () => ({
  requireAuth: (_req: any, _res: any, next: any) => next(),
  requireProfile: (req: any, _res: any, next: any) => {
    req.profile = h.profile;
    next();
  },
  getRequestProfile: (req: any) => req.profile,
}));

vi.mock("../lib/adminComplianceBundle", () => ({
  getCarrierComplianceSnapshot: async () => ({
    w9Status: "verified",
    insuranceStatus: "verified",
    dotCdlStatus: "verified",
    payoutStatus: "verified",
    canBid: true,
    w9ReviewNote: null,
    insuranceReviewNote: null,
    dotCdlReviewNote: null,
  }),
}));

vi.mock("../lib/commissionEngine", () => ({
  calculateCommissionFromHours: (ratePerHour: number, hours: number, commissionRate: number) => {
    const workAmount = Math.round(ratePerHour * hours * 100) / 100;
    const platformCommission = Math.round(workAmount * commissionRate * 100) / 100;
    const customerTotal = Math.round((workAmount + platformCommission) * 100) / 100;
    return {
      workAmount,
      platformCommission,
      customerTotal,
      vendorPayout: workAmount,
      driverPayout: null,
      internalProfit: platformCommission,
      marketplaceGmv: customerTotal,
      commissionRate,
    };
  },
  resolveCommission: async () => ({ rate: 0.2, scopeType: "global", scopeId: null, configId: null }),
  recordCommissionCalculation: vi.fn(async () => undefined),
}));

vi.mock("../lib/dynamicPricingEngine", () => ({
  calculateDynamicPricingFromHours: (ratePerHour: number, hours: number) => {
    const baseAmount = Math.round(ratePerHour * hours * 100) / 100;
    return { baseAmount, surchargeTotal: 0, pricedAmount: baseAmount, appliedSurcharges: [] };
  },
  listActiveSurchargeConfigs: async () => [],
  recordPricingCalculation: vi.fn(async () => undefined),
}));

import trucksRouter from "./trucks";
import requestsRouter from "./requests";
import bidsRouter from "./bids";

function makeApp(router: express.Router): Express {
  const app = express();
  app.use(express.json());
  app.use(router);
  return app;
}

beforeEach(() => {
  h.trucks = [];
  h.requests = [];
  h.bids = [];
  h.nextTruckId = 1;
  h.nextRequestId = 1;
  h.nextBidId = 1;
  h.profile = { id: 1, role: "customer", companyName: "Test Co" };
});

describe("POST /trucks", () => {
  it("rejects non-providers", async () => {
    h.profile = { id: 1, role: "customer", companyName: "Test Co" };
    const res = await request(makeApp(trucksRouter))
      .post("/trucks")
      .send({ truckType: "dump_truck", capacityTons: 20, ratePerHour: 150 });
    expect(res.status).toBe(403);
  });

  it("creates a truck for providers", async () => {
    h.profile = { id: 2, role: "provider", companyName: "Haul Co" };
    const res = await request(makeApp(trucksRouter))
      .post("/trucks")
      .send({ truckType: "dump_truck", capacityTons: 22, ratePerHour: 175, licensePlate: "TX-123" });
    expect(res.status).toBe(201);
    expect(res.body.capacityTons).toBe(22);
    expect(res.body.ratePerHour).toBe(175);
  });
});

describe("POST /requests", () => {
  it("creates a load request for customers", async () => {
    const res = await request(makeApp(requestsRouter))
      .post("/requests")
      .send({
        materialType: "gravel",
        truckType: "dump_truck",
        quantityTons: 40,
        pickupAddress: "123 Quarry Rd",
        deliveryAddress: "456 Site Ln",
        scheduledDate: "2026-07-01T12:00:00.000Z",
        startTime: "07:00",
        estimatedHours: 6,
        trucksNeeded: 2,
      });
    expect(res.status).toBe(201);
    expect(res.body.materialType).toBe("gravel");
    expect(h.requests.length).toBe(1);
  });

  it("rejects providers posting requests", async () => {
    h.profile = { id: 2, role: "provider", companyName: "Haul Co" };
    const res = await request(makeApp(requestsRouter))
      .post("/requests")
      .send({
        materialType: "gravel",
        quantityTons: 10,
        pickupAddress: "A",
        deliveryAddress: "B",
        scheduledDate: "2026-07-01",
      });
    expect(res.status).toBe(403);
  });
});

describe("POST /requests/:requestId/bids", () => {
  it("allows providers to bid on requests", async () => {
    h.requests.push({
      id: 5,
      customerId: 99,
      status: "open",
      materialType: "dirt",
      truckType: "dump_truck",
      quantityTons: "30",
      pickupAddress: "A",
      deliveryAddress: "B",
      scheduledDate: new Date(),
      startTime: "08:00",
      estimatedHours: "8",
      trucksNeeded: 1,
      notes: "Call foreman on arrival.",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    h.profile = { id: 2, role: "provider", companyName: "Haul Co" };

    const res = await request(makeApp(bidsRouter))
      .post("/requests/5/bids")
      .send({ ratePerHour: 140, trucksOffered: 1, estimatedHours: 8 });

    expect(res.status).toBe(201);
    expect(res.body.ratePerHour).toBe(140);
  });
});
