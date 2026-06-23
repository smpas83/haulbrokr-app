import { describe, it, expect, beforeEach, vi } from "vitest";
import express, { type Express } from "express";
import request from "supertest";

const h = vi.hoisted(() => ({
  profile: { id: 2, role: "provider", companyName: "Haul Co" } as Record<string, unknown>,
  requests: [] as Record<string, unknown>[],
  bids: [] as Record<string, unknown>[],
  nextBidId: 1,
  compliance: null as any,
}));

vi.mock("@workspace/db", () => {
  const makeTable = (name: string) =>
    new Proxy({}, { get: (_t, p) => `${name}.${String(p)}` });

  const requestsTable = makeTable("requests");
  const bidsTable = makeTable("bids");
  const activityTable = makeTable("activity");

  const db = {
    select: () => ({
      from: (table: unknown) => ({
        where: (..._args: unknown[]) => {
          if (table === requestsTable) return Promise.resolve(h.requests);
          return Promise.resolve([]);
        },
      }),
    }),
    insert: (table: unknown) => ({
      values: (row: Record<string, unknown>) => ({
        returning: () => {
          if (table === bidsTable) {
            const bid = {
              id: h.nextBidId++,
              requestId: row.requestId,
              providerId: h.profile.id,
              ratePerHour: String(row.ratePerHour),
              trucksOffered: row.trucksOffered,
              estimatedHours: row.estimatedHours ?? null,
              status: "pending",
              createdAt: new Date(),
              updatedAt: new Date(),
            };
            h.bids.push(bid);
            return Promise.resolve([bid]);
          }
          if (table === activityTable) return Promise.resolve([{ id: 1 }]);
          return Promise.resolve([]);
        },
      }),
    }),
    update: () => ({
      set: () => ({
        where: () => Promise.resolve([]),
      }),
    }),
  };

  return { db, requestsTable, bidsTable, activityTable, profilesTable: makeTable("profiles"), jobsTable: makeTable("jobs") };
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
  getCarrierComplianceSnapshot: async () => h.compliance,
}));

import bidsRouter from "./bids";

function makeApp(): Express {
  const app = express();
  app.use(express.json());
  app.use(bidsRouter);
  return app;
}

beforeEach(() => {
  h.bids = [];
  h.nextBidId = 1;
  h.profile = { id: 2, role: "provider", companyName: "Haul Co" };
  h.requests = [{
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
    notes: "Scale ticket required on exit.",
    createdAt: new Date(),
    updatedAt: new Date(),
  }];
  h.compliance = {
    w9Status: "verified",
    insuranceStatus: "verified",
    dotCdlStatus: "verified",
    payoutStatus: "verified",
    canBid: true,
    w9ReviewNote: null,
    insuranceReviewNote: null,
    dotCdlReviewNote: null,
  };
});

describe("POST /requests/:requestId/bids canBid gate", () => {
  it("allows bidding when compliance and payout are verified", async () => {
    const res = await request(makeApp())
      .post("/requests/5/bids")
      .send({ ratePerHour: 140, trucksOffered: 1, estimatedHours: 8 });

    expect(res.status).toBe(201);
    expect(h.bids).toHaveLength(1);
  });

  it("rejects bidding when canBid is false with a clear compliance message", async () => {
    h.compliance = {
      w9Status: "pending",
      insuranceStatus: "verified",
      dotCdlStatus: "verified",
      payoutStatus: "pending",
      canBid: false,
      w9ReviewNote: null,
      insuranceReviewNote: null,
      dotCdlReviewNote: null,
    };

    const res = await request(makeApp())
      .post("/requests/5/bids")
      .send({ ratePerHour: 140, trucksOffered: 1 });

    expect(res.status).toBe(403);
    expect(res.body.error).toContain("Cannot place a bid until compliance and payout requirements are met");
    expect(res.body.error).toContain("W-9 approval (currently pending)");
    expect(res.body.error).toContain("verified payout account (currently pending)");
    expect(h.bids).toHaveLength(0);
  });
});
