import { describe, it, expect, beforeEach, vi } from "vitest";
import express, { type Express } from "express";
import request from "supertest";

const h = vi.hoisted(() => ({
  profile: { id: 1, role: "customer", organizationId: null, staffRole: null } as any,
  rows: new Map<unknown, unknown[]>(),
  inserts: [] as Record<string, unknown>[],
  updates: [] as Record<string, unknown>[],
  job: null as any,
  admin: false,
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
    insert: (table: unknown) => ({
      values: (vals: Record<string, unknown>) => {
        h.inserts.push({ __table: table, ...vals });
        return {
          returning: () =>
            Promise.resolve([{ id: h.inserts.length, createdAt: new Date("2026-06-01T00:00:00Z"), updatedAt: new Date("2026-06-01T00:00:00Z"), ...vals }]),
        };
      },
    }),
    update: () => ({
      set: (vals: Record<string, unknown>) => {
        h.updates.push(vals);
        return {
          where: () => ({
            returning: () =>
              Promise.resolve([{ id: 99, createdAt: new Date("2026-06-01T00:00:00Z"), updatedAt: new Date("2026-06-02T00:00:00Z"), ...vals }]),
          }),
        };
      },
    }),
  };
  return {
    db,
    ratingsTable: makeTable("ratings"),
    reviewModerationHistoryTable: makeTable("reviewModerationHistory"),
    reviewAggregatesTable: makeTable("reviewAggregates"),
    ticketsTable: makeTable("tickets"),
  };
});

vi.mock("../lib/access", () => ({
  loadJobIfMember: vi.fn(async () => h.job),
  CUSTOMER_SIDE: new Set(["customer", "supervisor"]),
  isDriverAssignedToJob: vi.fn(async () => h.assigned),
}));

vi.mock("../middlewares/requireAuth", () => ({
  requireAuth: (_req: any, _res: any, next: any) => next(),
  requireProfile: (req: any, _res: any, next: any) => {
    req.profile = h.profile;
    next();
  },
  getRequestProfile: (req: any) => req.profile,
}));

vi.mock("../middlewares/requireAdmin", () => ({
  isAdmin: vi.fn(async () => h.admin),
}));

import ratingsRouter from "./ratings";
import { ratingsTable, reviewModerationHistoryTable, reviewAggregatesTable, ticketsTable } from "@workspace/db";

const CUSTOMER_ID = 1;
const PROVIDER_ID = 2;
const DRIVER_ID = 3;
const JOB_ID = 10;

function makeApp(): Express {
  const app = express();
  app.use(express.json());
  app.use(ratingsRouter);
  return app;
}

function baseJob(overrides: Record<string, unknown> = {}) {
  return {
    id: JOB_ID,
    customerId: CUSTOMER_ID,
    providerId: PROVIDER_ID,
    status: "completed",
    ...overrides,
  };
}

function review(overrides: Record<string, unknown> = {}) {
  return {
    id: 55,
    jobId: JOB_ID,
    raterProfileId: CUSTOMER_ID,
    rateeProfileId: DRIVER_ID,
    reviewType: "customer_to_driver",
    stars: 5,
    comment: "great",
    moderationStatus: "approved",
    moderationReason: null,
    moderatedByProfileId: null,
    moderatedAt: null,
    createdAt: new Date("2026-06-01T00:00:00Z"),
    updatedAt: new Date("2026-06-01T00:00:00Z"),
    ...overrides,
  };
}

beforeEach(() => {
  h.profile = { id: CUSTOMER_ID, role: "customer", organizationId: null, staffRole: null };
  h.rows.clear();
  h.inserts = [];
  h.updates = [];
  h.job = baseJob();
  h.admin = false;
  h.assigned = true;
  h.rows.set(ratingsTable, []);
  h.rows.set(ticketsTable, [{ id: 1, jobId: JOB_ID, driverProfileId: DRIVER_ID, truckId: 99 }]);
  h.rows.set(reviewAggregatesTable, []);
});

describe("POST /jobs/:id/reviews", () => {
  it("rejects rating a non-completed job", async () => {
    h.job = baseJob({ status: "in_progress" });

    const res = await request(makeApp()).post(`/jobs/${JOB_ID}/reviews`).send({ stars: 5, revieweeProfileId: DRIVER_ID });

    expect(res.status).toBe(409);
    expect(h.inserts).toHaveLength(0);
  });

  it("prevents duplicate reviews for reviewer/reviewee/job/type", async () => {
    h.rows.set(ratingsTable, [review({ moderationStatus: "pending" })]);

    const res = await request(makeApp()).post(`/jobs/${JOB_ID}/reviews`).send({ stars: 4, revieweeProfileId: DRIVER_ID });

    expect(res.status).toBe(409);
    expect(h.inserts).toHaveLength(0);
  });

  it("creates a customer-to-driver review after a completed job", async () => {
    const res = await request(makeApp())
      .post(`/jobs/${JOB_ID}/reviews`)
      .send({ stars: 5, revieweeProfileId: DRIVER_ID, comment: " <b>Great</b> driver " });

    expect(res.status).toBe(201);
    expect(h.inserts[0]).toMatchObject({
      jobId: JOB_ID,
      raterProfileId: CUSTOMER_ID,
      rateeProfileId: DRIVER_ID,
      reviewType: "customer_to_driver",
      stars: 5,
      comment: "Great driver",
      moderationStatus: "pending",
    });
    expect(h.inserts.find((row) => row.__table === reviewModerationHistoryTable)).toMatchObject({
      action: "created",
      nextStatus: "pending",
    });
  });

  it("creates a driver-to-customer review only when assigned", async () => {
    h.profile = { id: DRIVER_ID, role: "driver", organizationId: 2, staffRole: null };

    const res = await request(makeApp()).post(`/jobs/${JOB_ID}/reviews`).send({ stars: 4, comment: "Ready site" });

    expect(res.status).toBe(201);
    expect(h.inserts[0]).toMatchObject({
      raterProfileId: DRIVER_ID,
      rateeProfileId: CUSTOMER_ID,
      reviewType: "driver_to_customer",
      stars: 4,
    });
  });

  it("blocks unassigned drivers from reviewing customers", async () => {
    h.profile = { id: DRIVER_ID, role: "driver", organizationId: 2, staffRole: null };
    h.assigned = false;

    const res = await request(makeApp()).post(`/jobs/${JOB_ID}/reviews`).send({ stars: 4 });

    expect(res.status).toBe(403);
  });

  it("creates a vendor-to-customer review", async () => {
    h.profile = { id: PROVIDER_ID, role: "provider", organizationId: null, staffRole: null };

    const res = await request(makeApp()).post(`/jobs/${JOB_ID}/reviews`).send({ stars: 3, reviewType: "vendor_to_customer" });

    expect(res.status).toBe(201);
    expect(h.inserts[0]).toMatchObject({
      raterProfileId: PROVIDER_ID,
      rateeProfileId: CUSTOMER_ID,
      reviewType: "vendor_to_customer",
    });
  });

  it("rejects self reviews", async () => {
    h.rows.set(ticketsTable, [{ id: 1, jobId: JOB_ID, driverProfileId: CUSTOMER_ID, truckId: 99 }]);

    const res = await request(makeApp()).post(`/jobs/${JOB_ID}/reviews`).send({ stars: 5, revieweeProfileId: CUSTOMER_ID });

    expect(res.status).toBe(400);
  });
});

describe("review moderation", () => {
  it("lists pending reviews for admins", async () => {
    h.admin = true;
    h.rows.set(ratingsTable, [review({ moderationStatus: "pending" })]);

    const res = await request(makeApp()).get("/admin/reviews/pending");

    expect(res.status).toBe(200);
    expect(res.body.reviews).toHaveLength(1);
  });

  it("blocks non-admins from the review queue", async () => {
    const res = await request(makeApp()).get("/admin/reviews/pending");

    expect(res.status).toBe(403);
  });

  it("moderates a review and records history/audit data", async () => {
    h.admin = true;
    h.profile = { id: 9, role: "provider", staffRole: "cto" };
    h.rows.set(ratingsTable, [review({ id: 77, moderationStatus: "pending" })]);

    const res = await request(makeApp()).patch("/admin/reviews/77/moderate").send({
      action: "approved",
      reason: "Looks valid",
    });

    expect(res.status).toBe(200);
    expect(h.updates[0]).toMatchObject({
      moderationStatus: "approved",
      moderationReason: "Looks valid",
      moderatedByProfileId: 9,
    });
    expect(h.inserts.find((row) => row.__table === reviewModerationHistoryTable)).toMatchObject({
      reviewId: 77,
      action: "approved",
      previousStatus: "pending",
      nextStatus: "approved",
    });
    expect(h.inserts.find((row) => row.__table === reviewAggregatesTable)).toMatchObject({
      profileId: DRIVER_ID,
      reviewType: "customer_to_driver",
      averageStars: "5.00",
      reviewCount: 1,
    });
  });
});

describe("summaries and visibility", () => {
  it("excludes hidden, rejected, and pending reviews from averages", async () => {
    h.rows.set(ratingsTable, [
      review({ stars: 5, moderationStatus: "approved" }),
      review({ id: 2, stars: 1, moderationStatus: "hidden" }),
      review({ id: 3, stars: 1, moderationStatus: "rejected" }),
      review({ id: 4, stars: 1, moderationStatus: "pending" }),
    ]);

    const res = await request(makeApp()).get(`/ratings/drivers/${DRIVER_ID}/summary`);

    expect(res.status).toBe(200);
    expect(res.body.averageStars).toBe(5);
    expect(res.body.reviewCount).toBe(1);
  });

  it("returns only approved reviews as received reviews for a job", async () => {
    h.profile = { id: DRIVER_ID, role: "driver", organizationId: 2, staffRole: null };
    h.rows.set(ratingsTable, [
      review({ moderationStatus: "approved" }),
      review({ id: 2, moderationStatus: "hidden", comment: "hidden" }),
    ]);

    const res = await request(makeApp()).get(`/jobs/${JOB_ID}/reviews`);

    expect(res.status).toBe(200);
    expect(res.body.reviews).toHaveLength(1);
    expect(res.body.theirs.comment).toBe("great");
  });
});
