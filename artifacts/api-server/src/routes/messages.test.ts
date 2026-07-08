import { describe, it, expect, beforeEach, vi } from "vitest";
import express, { type Express } from "express";
import request from "supertest";

/**
 * Shared, mutable test state for the (hoisted) `vi.mock` factories.
 */
const h = vi.hoisted(() => ({
  /** The profile injected by the mocked requireProfile middleware. */
  profile: { id: 1, role: "customer", organizationId: null } as Record<
    string,
    unknown
  >,
  /** Rows returned by the joined `db.select(...)...orderBy()` for the list query. */
  messageRows: [] as Record<string, unknown>[],
  /** Every payload passed to `db.insert(jobMessagesTable).values(...)`, in call order. */
  inserts: [] as Record<string, unknown>[],
}));

vi.mock("@workspace/db", () => {
  const makeTable = (name: string) =>
    new Proxy({}, { get: (_t, p) => `${name}.${String(p)}` });
  const jobMessagesTable = makeTable("job_messages");
  const profilesTable = makeTable("profiles");
  const db = {
    select: () => ({
      from: () => ({
        leftJoin: () => ({
          where: () => ({
            orderBy: () => Promise.resolve(h.messageRows),
          }),
        }),
      }),
    }),
    insert: () => ({
      values: (vals: Record<string, unknown>) => {
        h.inserts.push(vals);
        return {
          returning: () =>
            Promise.resolve([
              { id: 99, createdAt: new Date("2026-06-01T00:00:00Z"), ...vals },
            ]),
        };
      },
    }),
  };
  return { db, jobMessagesTable, profilesTable };
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
}));

import messagesRouter from "./messages";

const CUSTOMER_ID = 1;
const PROVIDER_ID = 2;
const JOB_ID = 10;

function makeApp(): Express {
  const app = express();
  app.use(express.json());
  app.use(messagesRouter);
  return app;
}

function baseJob(overrides: Record<string, unknown> = {}) {
  return {
    id: JOB_ID,
    customerId: CUSTOMER_ID,
    providerId: PROVIDER_ID,
    status: "active",
    ...overrides,
  };
}

beforeEach(() => {
  h.profile = {
    id: CUSTOMER_ID,
    role: "customer",
    companyName: "Acme Co",
    contactName: "Alice",
    organizationId: null,
  };
  h.messageRows = [];
  h.inserts = [];
  loadJobIfMember.mockReset();
  loadJobIfMember.mockResolvedValue(baseJob());
});

describe("POST /jobs/:id/messages", () => {
  it("creates a message for a job member and returns it with senderName", async () => {
    const res = await request(makeApp())
      .post(`/jobs/${JOB_ID}/messages`)
      .send({ body: "On my way" });

    expect(res.status).toBe(201);
    expect(h.inserts).toHaveLength(1);
    expect(h.inserts[0]).toMatchObject({
      jobId: JOB_ID,
      senderProfileId: CUSTOMER_ID,
      body: "On my way",
    });
    expect(res.body.body).toBe("On my way");
    expect(res.body.senderName).toBe("Alice");
    expect(res.body.senderProfileId).toBe(CUSTOMER_ID);
  });

  it("trims whitespace from the body before saving", async () => {
    const res = await request(makeApp())
      .post(`/jobs/${JOB_ID}/messages`)
      .send({ body: "   hello   " });

    expect(res.status).toBe(201);
    expect(h.inserts[0].body).toBe("hello");
  });

  it("rejects an empty body (400)", async () => {
    const res = await request(makeApp())
      .post(`/jobs/${JOB_ID}/messages`)
      .send({ body: "   " });

    expect(res.status).toBe(400);
    expect(h.inserts).toHaveLength(0);
  });

  it("rejects a missing body (400)", async () => {
    const res = await request(makeApp())
      .post(`/jobs/${JOB_ID}/messages`)
      .send({});

    expect(res.status).toBe(400);
    expect(h.inserts).toHaveLength(0);
  });

  it("rejects a non-member (404)", async () => {
    loadJobIfMember.mockResolvedValue(null);

    const res = await request(makeApp())
      .post(`/jobs/${JOB_ID}/messages`)
      .send({ body: "hi" });

    expect(res.status).toBe(404);
    expect(h.inserts).toHaveLength(0);
  });
});

describe("GET /jobs/:id/messages", () => {
  it("returns messages ordered oldest first with resolved senderName", async () => {
    h.messageRows = [
      {
        id: 1,
        jobId: JOB_ID,
        senderProfileId: CUSTOMER_ID,
        body: "first",
        createdAt: new Date("2026-06-01T00:00:00Z"),
        companyName: "Acme Co",
        contactName: "Alice",
      },
      {
        id: 2,
        jobId: JOB_ID,
        senderProfileId: PROVIDER_ID,
        body: "second",
        createdAt: new Date("2026-06-02T00:00:00Z"),
        companyName: "Haul LLC",
        contactName: null,
      },
    ];

    const res = await request(makeApp()).get(`/jobs/${JOB_ID}/messages`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].id).toBe(1);
    expect(res.body[0].body).toBe("first");
    expect(res.body[0].senderName).toBe("Alice");
    // Falls back to companyName when contactName is null.
    expect(res.body[1].senderName).toBe("Haul LLC");
  });

  it("returns an empty array when there are no messages", async () => {
    h.messageRows = [];

    const res = await request(makeApp()).get(`/jobs/${JOB_ID}/messages`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("404s for a non-member", async () => {
    loadJobIfMember.mockResolvedValue(null);

    const res = await request(makeApp()).get(`/jobs/${JOB_ID}/messages`);

    expect(res.status).toBe(404);
  });
});
