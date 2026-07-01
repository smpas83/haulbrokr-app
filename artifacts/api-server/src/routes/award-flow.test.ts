import { describe, it, expect, beforeEach, vi } from "vitest";
import express, { type Express } from "express";
import request from "supertest";

const h = vi.hoisted(() => ({
  profile: { id: 10, role: "customer", companyName: "Customer Co" } as Record<
    string,
    unknown
  >,
  requests: [] as Record<string, unknown>[],
  bids: [] as Record<string, unknown>[],
  jobs: [] as Record<string, unknown>[],
  inserts: [] as Record<string, unknown>[],
  updates: [] as Record<string, unknown>[],
  nextRequestId: 1,
  nextBidId: 1,
  nextJobId: 1,
}));

vi.mock("@workspace/db", () => {
  const makeTable = (name: string) =>
    new Proxy({}, { get: (_t, p) => `${name}.${String(p)}` });

  const requestsTable = makeTable("requests");
  const bidsTable = makeTable("bids");
  const jobsTable = makeTable("jobs");
  const profilesTable = makeTable("profiles");
  const activityTable = makeTable("activity");
  const jobStatusUpdatesTable = makeTable("job_status_updates");
  const commissionRulesTable = makeTable("commission_rules");
  const pricingRulesTable = makeTable("pricing_rules");
  const marketplaceAuditLogsTable = makeTable("marketplace_audit_logs");
  const marketplaceQuotesTable = makeTable("marketplace_quotes");
  const pricingEventsTable = makeTable("pricing_events");

  const db = {
    select: () => ({
      from: (table: unknown) => ({
        where: (..._args: unknown[]) => {
          if (table === bidsTable) return Promise.resolve(h.bids);
          if (table === requestsTable) return Promise.resolve(h.requests);
          if (table === jobsTable) return Promise.resolve(h.jobs);
          if (table === profilesTable)
            return Promise.resolve([{ companyName: "Hauler Co" }]);
          if (table === commissionRulesTable) return Promise.resolve([]);
          if (table === pricingRulesTable) return Promise.resolve([]);
          return Promise.resolve([]);
        },
      }),
    }),
    insert: (table: unknown) => ({
      values: (vals: Record<string, unknown>) => {
        h.inserts.push(vals);
        if (table === jobsTable) {
          const job = { id: h.nextJobId++, ...vals };
          h.jobs.push(job);
          return { returning: () => Promise.resolve([job]) };
        }
        if (table === marketplaceQuotesTable) {
          return {
            returning: () =>
              Promise.resolve([{ id: 100 + h.nextJobId, ...vals }]),
          };
        }
        if (
          table === activityTable ||
          table === jobStatusUpdatesTable ||
          table === marketplaceAuditLogsTable ||
          table === pricingEventsTable
        ) {
          return Promise.resolve(undefined);
        }
        return Promise.resolve(undefined);
      },
    }),
    update: (table: unknown) => ({
      set: (vals: Record<string, unknown>) => {
        h.updates.push(vals);
        const apply = () => {
          if (table === requestsTable) {
            for (const r of h.requests) Object.assign(r, vals);
          }
          if (table === bidsTable) {
            for (const b of h.bids) {
              if (vals.status === "rejected" && b.status === "pending")
                Object.assign(b, vals);
              else if (b.id === h.bids[0]?.id) Object.assign(b, vals);
            }
          }
          if (table === jobsTable) {
            for (const j of h.jobs) Object.assign(j, vals);
          }
        };
        return {
          where: (..._args: unknown[]) => {
            apply();
            return {
              returning: () => {
                if (table === bidsTable) {
                  const bid = h.bids.find((b) => b.id === 5) ?? h.bids[0];
                  return Promise.resolve(bid ? [bid] : []);
                }
                if (table === jobsTable) {
                  const job = h.jobs[0];
                  return Promise.resolve(job ? [job] : []);
                }
                return Promise.resolve([]);
              },
            };
          },
        };
      },
    }),
  };

  return {
    db,
    requestsTable,
    bidsTable,
    jobsTable,
    profilesTable,
    activityTable,
    jobStatusUpdatesTable,
    commissionRulesTable,
    pricingRulesTable,
    marketplaceAuditLogsTable,
    marketplaceQuotesTable,
    pricingEventsTable,
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
  loadJobIfMember: async (jobId: number) =>
    h.jobs.find((j) => j.id === jobId) ?? null,
  orgScopedActorIds: async () => [h.profile.id],
  isOrgManager: () => false,
  canReviewCompletion: () => false,
  isDriverAssignedToJob: async () => false,
  DRIVER_SIDE: new Set(["provider", "driver"]),
  CUSTOMER_SIDE: new Set(["customer", "supervisor"]),
}));

import bidsRouter from "./bids";
import jobsRouter from "./jobs";

function makeApp(): Express {
  const app = express();
  app.use(express.json());
  app.use(bidsRouter);
  app.use(jobsRouter);
  return app;
}

function sampleJob(overrides: Record<string, unknown> = {}) {
  return {
    id: 9,
    requestId: 1,
    bidId: 5,
    customerId: 10,
    providerId: 20,
    ratePerHour: "120.00",
    trucksAssigned: 2,
    status: "awarded",
    materialType: "dirt",
    truckType: "dump_truck",
    pickupAddress: "A",
    deliveryAddress: "B",
    scheduledDate: new Date(),
    startTime: "08:00",
    estimatedHours: "8",
    notes: "End-dump only; no belly dumps.",
    paymentStatus: "unpaid",
    createdAt: new Date(),
    ...overrides,
  };
}

beforeEach(() => {
  h.profile = { id: 10, role: "customer", companyName: "Customer Co" };
  h.requests = [
    {
      id: 1,
      customerId: 10,
      status: "bid_received",
      materialType: "dirt",
      truckType: "dump_truck",
      quantityTons: "100",
      pickupAddress: "A",
      deliveryAddress: "B",
      scheduledDate: new Date(),
      startTime: "08:00",
      estimatedHours: "8",
      trucksNeeded: 2,
      notes: "End-dump only; no belly dumps.",
    },
  ];
  h.bids = [
    {
      id: 5,
      requestId: 1,
      providerId: 20,
      ratePerHour: "120.00",
      trucksOffered: 2,
      status: "pending",
      createdAt: new Date(),
    },
  ];
  h.jobs = [];
  h.inserts = [];
  h.updates = [];
  h.nextJobId = 1;
});

describe("Job award / hauler acceptance flow", () => {
  it("customer awarding a bid creates an awarded job and updates request status", async () => {
    const res = await request(makeApp())
      .patch("/bids/5")
      .send({ status: "accepted" });

    expect(res.status).toBe(200);
    expect(h.jobs).toHaveLength(1);
    expect(h.jobs[0]).toMatchObject({
      status: "awarded",
      providerId: 20,
      bidId: 5,
      platformFeeRate: "0.2",
      platformFeeAmount: "384",
      customerTotalAmount: "2304",
      providerNetAmount: "1920",
      marketplaceQuoteId: 101,
    });
    expect(h.requests[0].status).toBe("awarded");
    expect(h.bids[0].status).toBe("awarded");
  });

  it("provider accepts an awarded job", async () => {
    h.jobs = [sampleJob({ status: "awarded" })];
    h.profile = { id: 20, role: "provider", companyName: "Hauler Co" };

    const res = await request(makeApp()).post("/jobs/9/accept");

    expect(res.status).toBe(200);
    expect(h.jobs[0].status).toBe("accepted");
    expect(h.requests[0].status).toBe("accepted");
    expect(h.updates.some((u) => u.status === "accepted")).toBe(true);
  });

  it("provider declining an awarded job reopens the request when other bids remain", async () => {
    h.bids.push({
      id: 6,
      requestId: 1,
      providerId: 21,
      ratePerHour: "110.00",
      trucksOffered: 1,
      status: "pending",
    });
    h.requests[0].status = "awarded";
    h.bids[0].status = "awarded";
    h.jobs = [sampleJob({ status: "awarded" })];
    h.profile = { id: 20, role: "provider", companyName: "Hauler Co" };

    const res = await request(makeApp()).post("/jobs/9/decline");

    expect(res.status).toBe(200);
    expect(h.jobs[0].status).toBe("declined");
    expect(h.requests[0].status).toBe("bid_received");
  });

  it("provider can start an accepted job", async () => {
    h.jobs = [sampleJob({ status: "accepted", platformFeeRate: "0.15" })];
    h.profile = { id: 20, role: "provider", companyName: "Hauler Co" };

    const res = await request(makeApp())
      .patch("/jobs/9")
      .send({ status: "in_progress" });

    expect(res.status).toBe(200);
    expect(h.jobs[0].status).toBe("in_progress");
    expect(h.requests[0].status).toBe("in_progress");
  });
});
