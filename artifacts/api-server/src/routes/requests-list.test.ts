import { describe, it, expect, beforeEach, vi } from "vitest";
import express, { type Express } from "express";
import request from "supertest";

const h = vi.hoisted(() => ({
  profile: { id: 2, role: "provider", companyName: "Haul Co" } as Record<string, unknown>,
  requests: [] as Record<string, unknown>[],
  jobs: [] as Record<string, unknown>[],
  orgProfiles: [] as { id: number; companyName?: string }[],
}));

vi.mock("@workspace/db", () => {
  const makeTable = (name: string) =>
    new Proxy({}, { get: (_t, p) => `${name}.${String(p)}` });

  const requestsTable = makeTable("requests");
  const jobsTable = makeTable("jobs");
  const profilesTable = makeTable("profiles");
  const bidsTable = makeTable("bids");

  const thenable = (rows: unknown[]) => ({
    orderBy: () => Promise.resolve(rows),
    then(onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) {
      return Promise.resolve(rows).then(onFulfilled, onRejected);
    },
  });

  const db = {
    select: () => ({
      from: (table: unknown) => ({
        where: (..._args: unknown[]) => {
          if (table === requestsTable) return thenable(h.requests);
          if (table === jobsTable) return thenable(h.jobs);
          if (table === bidsTable) return Promise.resolve([{ count: 0 }]);
          if (table === profilesTable) {
            if (h.orgProfiles.length) return Promise.resolve(h.orgProfiles);
            return Promise.resolve([{ companyName: "Customer Co" }]);
          }
          return Promise.resolve([]);
        },
        orderBy: (..._args: unknown[]) => {
          if (table === requestsTable) return Promise.resolve(h.requests);
          if (table === jobsTable) return Promise.resolve(h.jobs);
          return Promise.resolve([]);
        },
      }),
    }),
  };

  return { db, requestsTable, jobsTable, profilesTable, bidsTable };
});

vi.mock("../middlewares/requireAuth", () => ({
  requireProfile: (req: any, _res: any, next: any) => {
    req.profile = { ...h.profile };
    next();
  },
  getRequestProfile: (req: any) => req.profile,
}));

import requestsRouter from "./requests";
import jobsRouter from "./jobs";

function makeApp(router: express.Router): Express {
  const app = express();
  app.use(express.json());
  app.use(router);
  return app;
}

const openRequest = {
  id: 1,
  customerId: 99,
  status: "open",
  materialType: "gravel",
  truckType: "dump_truck",
  quantityTons: "40",
  pickupAddress: "123 Quarry Rd, Dallas, TX",
  deliveryAddress: "456 Landfill Ln, Dallas, TX",
  scheduledDate: new Date("2026-07-15"),
  startTime: "07:00",
  estimatedHours: "8",
  trucksNeeded: 2,
  budgetPerHour: "125",
  notes: null,
  projectId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const activeJob = {
  id: 10,
  requestId: 1,
  bidId: 5,
  customerId: 99,
  providerId: 20,
  ratePerHour: "120",
  trucksAssigned: 2,
  status: "accepted",
  materialType: "gravel",
  truckType: "dump_truck",
  pickupAddress: "123 Quarry Rd, Dallas, TX",
  deliveryAddress: "456 Landfill Ln, Dallas, TX",
  scheduledDate: new Date("2026-07-15"),
  startTime: "07:00",
  estimatedHours: "8",
  projectId: null,
  paymentStatus: "unpaid",
  createdAt: new Date(),
  updatedAt: new Date(),
};

beforeEach(() => {
  h.requests = [openRequest];
  h.jobs = [activeJob];
  h.orgProfiles = [];
  h.profile = { id: 2, role: "provider", companyName: "Haul Co" };
});

describe("GET /requests load board", () => {
  it("returns open loads for providers", async () => {
    const res = await request(makeApp(requestsRouter)).get("/requests");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].status).toBe("open");
    expect(res.body[0].pickupAddress).toContain("Dallas");
  });

  it("returns open loads for drivers (fleet visibility)", async () => {
    h.profile = { id: 30, role: "driver", companyName: "Haul Co", organizationId: 7 };
    const res = await request(makeApp(requestsRouter)).get("/requests");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });

  it("returns only own requests for customers", async () => {
    h.profile = { id: 99, role: "customer", companyName: "Build Co" };
    const res = await request(makeApp(requestsRouter)).get("/requests");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].customerId).toBe(99);
  });
});

describe("GET /jobs active loads", () => {
  it("returns org-scoped jobs for drivers", async () => {
    h.profile = { id: 30, role: "driver", companyName: "Haul Co", organizationId: 7 };
    h.orgProfiles = [
      { id: 20, companyName: "Haul Co" },
      { id: 30, companyName: "Haul Co" },
    ];
    h.jobs = [{ ...activeJob, providerId: 20 }];

    const res = await request(makeApp(jobsRouter)).get("/jobs");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].status).toBe("accepted");
  });
});
