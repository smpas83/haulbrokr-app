import { describe, it, expect, beforeEach, vi } from "vitest";
import express, { type Express } from "express";
import request from "supertest";

/**
 * Shared, mutable test state for the (hoisted) `vi.mock` factories.
 */
const h = vi.hoisted(() => ({
  /** The profile injected by the mocked requireProfile middleware. */
  profile: { id: 1, role: "customer", organizationId: null } as Record<string, unknown>,
  /** Rows returned by `db.select().from(ratingsTable).where()`. */
  ratingRows: [] as Record<string, unknown>[],
  reviewRows: [] as Record<string, unknown>[],
  statsRows: [] as Record<string, unknown>[],
  /** Every payload passed to `db.insert(ratingsTable).values(...)`, in call order. */
  inserts: [] as Record<string, unknown>[],
  /** Every conflict-update payload passed to `.onConflictDoUpdate(...)`. */
  conflicts: [] as Record<string, unknown>[],
}));

vi.mock("@workspace/db", () => {
  const makeTable = (name: string) =>
    new Proxy({}, { get: (_t, p) => `${name}.${String(p)}` });
  const ratingsTable = makeTable("ratings");
  const reviewHistoryTable = makeTable("reviewHistory");
  const reviewFlagsTable = makeTable("reviewFlags");
  const reviewStatsTable = makeTable("reviewStats");
  const db = {
    select: () => ({
      from: (table: unknown) => ({
        where: () => {
          if (table === ratingsTable) return Promise.resolve(h.ratingRows);
          if (table === reviewHistoryTable) return Promise.resolve(h.reviewRows);
          if (table === reviewStatsTable) return Promise.resolve(h.statsRows);
          return Promise.resolve([]);
        },
      }),
    }),
    insert: (table: unknown) => ({
      values: (vals: Record<string, unknown>) => {
        h.inserts.push({ table, ...vals });
        if (table !== ratingsTable) {
          return {
            returning: () => Promise.resolve([{ id: h.inserts.length, createdAt: new Date("2026-06-01T00:00:00Z"), ...vals }]),
          };
        }
        return {
          onConflictDoUpdate: (cfg: { set: Record<string, unknown> }) => {
            h.conflicts.push(cfg.set);
            return {
              returning: () =>
                Promise.resolve([
                  { id: 99, createdAt: new Date("2026-06-01T00:00:00Z"), ...vals, ...cfg.set },
                ]),
            };
          },
        };
      },
    }),
    update: () => ({
      set: (vals: Record<string, unknown>) => ({
        where: () => ({
          returning: () => Promise.resolve([{ id: 1, ...vals }]),
        }),
      }),
    }),
  };
  return { db, ratingsTable, reviewHistoryTable, reviewFlagsTable, reviewStatsTable };
});

// Controllable job + membership stand-in. The route calls loadJobIfMember.
const loadJobIfMember = vi.fn();
vi.mock("../lib/access", () => ({
  loadJobIfMember: (...args: unknown[]) => loadJobIfMember(...args),
  CUSTOMER_SIDE: new Set(["customer", "supervisor"]),
  DRIVER_SIDE: new Set(["provider", "driver"]),
}));

vi.mock("../middlewares/requireAuth", () => ({
  requireAuth: (_req: any, _res: any, next: any) => next(),
  requireProfile: (req: any, _res: any, next: any) => {
    req.profile = h.profile;
    next();
  },
  getRequestProfile: (req: any) => req.profile,
  attachClerkProfileIfPresent: (_req: any, _res: any, next: any) => next(),
}));

vi.mock("../middlewares/staffAuth", () => ({
  attachStaffSession: (_req: any, _res: any, next: any) => next(),
  requireStaffOrProfile: (_req: any, _res: any, next: any) => next(),
}));

vi.mock("../middlewares/requireAdmin", () => ({
  requirePermission: () => (_req: any, _res: any, next: any) => next(),
}));

import ratingsRouter from "./ratings";

const CUSTOMER_ID = 1;
const PROVIDER_ID = 2;
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

beforeEach(() => {
  h.profile = { id: CUSTOMER_ID, role: "customer", organizationId: null };
  h.ratingRows = [];
  h.reviewRows = [];
  h.statsRows = [];
  h.inserts = [];
  h.conflicts = [];
  loadJobIfMember.mockReset();
  loadJobIfMember.mockResolvedValue(baseJob());
});

describe("POST /jobs/:id/rating", () => {
  it("posts a rating on a completed job and rates the counterparty", async () => {
    const res = await request(makeApp())
      .post(`/jobs/${JOB_ID}/rating`)
      .send({ stars: 5, comment: "Great work" });

    expect(res.status).toBe(200);
    const ratingInsert = h.inserts.find((insert) => insert.rateeProfileId === PROVIDER_ID);
    expect(ratingInsert).toMatchObject({
      jobId: JOB_ID,
      raterProfileId: CUSTOMER_ID,
      // customer-side caller rates the provider
      rateeProfileId: PROVIDER_ID,
      stars: 5,
      comment: "Great work",
    });
    expect(h.inserts.some((insert) => insert.subjectType === "profile")).toBe(true);
    expect(res.body.stars).toBe(5);
    expect(res.body.rateeProfileId).toBe(PROVIDER_ID);
  });

  it("rates the customer when the caller is on the provider side", async () => {
    h.profile = { id: PROVIDER_ID, role: "provider", organizationId: null };

    const res = await request(makeApp())
      .post(`/jobs/${JOB_ID}/rating`)
      .send({ stars: 4 });

    expect(res.status).toBe(200);
    const ratingInsert = h.inserts.find((insert) => insert.rateeProfileId === CUSTOMER_ID);
    expect(ratingInsert).toMatchObject({
      raterProfileId: PROVIDER_ID,
      rateeProfileId: CUSTOMER_ID,
      stars: 4,
      comment: null,
    });
  });

  it("rejects rating a non-completed job (409)", async () => {
    loadJobIfMember.mockResolvedValue(baseJob({ status: "in_progress" }));

    const res = await request(makeApp())
      .post(`/jobs/${JOB_ID}/rating`)
      .send({ stars: 5 });

    expect(res.status).toBe(409);
    expect(h.inserts).toHaveLength(0);
  });

  it("rejects a non-member (404)", async () => {
    loadJobIfMember.mockResolvedValue(null);

    const res = await request(makeApp())
      .post(`/jobs/${JOB_ID}/rating`)
      .send({ stars: 5 });

    expect(res.status).toBe(404);
    expect(h.inserts).toHaveLength(0);
  });

  it("rejects an out-of-range star value (400)", async () => {
    const res = await request(makeApp())
      .post(`/jobs/${JOB_ID}/rating`)
      .send({ stars: 9 });

    expect(res.status).toBe(400);
    expect(h.inserts).toHaveLength(0);
  });

  it("upserts (a second post updates rather than duplicates)", async () => {
    const res = await request(makeApp())
      .post(`/jobs/${JOB_ID}/rating`)
      .send({ stars: 2, comment: "changed my mind" });

    expect(res.status).toBe(200);
    // The route uses onConflictDoUpdate keyed on (jobId, raterProfileId).
    expect(h.conflicts).toHaveLength(1);
    expect(h.conflicts[0]).toMatchObject({ stars: 2, comment: "changed my mind" });
  });
});

describe("GET /jobs/:id/rating", () => {
  it("returns the caller's given and received ratings", async () => {
    h.ratingRows = [
      {
        id: 1,
        jobId: JOB_ID,
        raterProfileId: CUSTOMER_ID,
        rateeProfileId: PROVIDER_ID,
        stars: 5,
        comment: "mine",
        createdAt: new Date("2026-06-01T00:00:00Z"),
      },
      {
        id: 2,
        jobId: JOB_ID,
        raterProfileId: PROVIDER_ID,
        rateeProfileId: CUSTOMER_ID,
        stars: 4,
        comment: "theirs",
        createdAt: new Date("2026-06-02T00:00:00Z"),
      },
    ];

    const res = await request(makeApp()).get(`/jobs/${JOB_ID}/rating`);

    expect(res.status).toBe(200);
    expect(res.body.mine.id).toBe(1);
    expect(res.body.mine.comment).toBe("mine");
    expect(res.body.theirs.id).toBe(2);
    expect(res.body.theirs.comment).toBe("theirs");
  });

  it("returns nulls when no ratings exist", async () => {
    h.ratingRows = [];

    const res = await request(makeApp()).get(`/jobs/${JOB_ID}/rating`);

    expect(res.status).toBe(200);
    expect(res.body.mine).toBeNull();
    expect(res.body.theirs).toBeNull();
  });

  it("404s for a non-member", async () => {
    loadJobIfMember.mockResolvedValue(null);

    const res = await request(makeApp()).get(`/jobs/${JOB_ID}/rating`);

    expect(res.status).toBe(404);
  });
});

describe("review trust endpoints", () => {
  it("flags a review for moderation", async () => {
    h.reviewRows = [{ id: 7, rateeProfileId: PROVIDER_ID, moderationStatus: "visible", stars: 2, jobId: JOB_ID }];

    const res = await request(makeApp())
      .post("/reviews/7/flags")
      .send({ reason: "Abusive language" });

    expect(res.status).toBe(201);
    expect(h.inserts.some((insert) => insert.reviewHistoryId === 7 && insert.reason === "Abusive language")).toBe(true);
  });

  it("allows admins to remove a flagged review", async () => {
    h.reviewRows = [{ id: 7, rateeProfileId: PROVIDER_ID, moderationStatus: "flagged", stars: 2, jobId: JOB_ID }];

    const res = await request(makeApp())
      .patch("/admin/reviews/7/moderation")
      .send({ status: "removed", reason: "Policy violation" });

    expect(res.status).toBe(200);
    expect(res.body.moderationStatus).toBe("removed");
    expect(res.body.removedReason).toBe("Policy violation");
  });
});
