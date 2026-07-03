import { describe, it, expect, beforeEach, vi } from "vitest";
import express, { type Express } from "express";
import request from "supertest";

const h = vi.hoisted(() => ({
  profile: { id: 1 } as any,
  rows: [] as any[],
  updates: [] as Record<string, unknown>[],
}));

vi.mock("@workspace/db", () => {
  const makeTable = (name: string) =>
    new Proxy({}, { get: (_t, p) => `${name}.${String(p)}` });
  const notificationsTable = makeTable("notifications");
  const db = {
    select: () => ({
      from: () => ({
        where: () => {
          const p: any = Promise.resolve(h.rows);
          p.orderBy = () => Promise.resolve(h.rows);
          return p;
        },
      }),
    }),
    update: () => ({
      set: (vals: Record<string, unknown>) => {
        h.updates.push(vals);
        const where = () => {
          const p: any = Promise.resolve(undefined);
          p.returning = () => Promise.resolve([{ id: 1, ...vals }]);
          return p;
        };
        return { where };
      },
    }),
  };
  return { db, notificationsTable };
});

vi.mock("../middlewares/requireAuth", () => ({
  requireProfile: (req: any, _res: any, next: any) => {
    req.profile = h.profile;
    next();
  },
  getRequestProfile: (req: any) => req.profile,
}));

import notificationsRouter from "./notifications";

function makeApp(): Express {
  const app = express();
  app.use(express.json());
  app.use(notificationsRouter);
  return app;
}

beforeEach(() => {
  h.profile = { id: 1 };
  h.rows = [];
  h.updates = [];
});

describe("GET /notifications", () => {
  it("returns the inbox with an unread count", async () => {
    h.rows = [
      { id: 1, recipientProfileId: 1, type: "generic", title: "A", readAt: null },
      { id: 2, recipientProfileId: 1, type: "generic", title: "B", readAt: new Date() },
    ];
    const res = await request(makeApp()).get("/notifications");
    expect(res.status).toBe(200);
    expect(res.body.notifications.length).toBe(2);
    expect(res.body.unreadCount).toBe(1);
  });
});

describe("GET /notifications/unread-count", () => {
  it("returns the number of unread rows", async () => {
    h.rows = [
      { id: 1, recipientProfileId: 1, readAt: null },
      { id: 3, recipientProfileId: 1, readAt: null },
    ];
    const res = await request(makeApp()).get("/notifications/unread-count");
    expect(res.status).toBe(200);
    expect(res.body.unreadCount).toBe(2);
  });
});

describe("POST /notifications/:id/read", () => {
  it("marks an owned notification read", async () => {
    h.rows = [{ id: 5, recipientProfileId: 1, readAt: null }];
    const res = await request(makeApp()).post("/notifications/5/read");
    expect(res.status).toBe(200);
    expect(h.updates.length).toBe(1);
    expect(h.updates[0].readAt).toBeInstanceOf(Date);
  });

  it("forbids marking another user's notification", async () => {
    h.rows = [{ id: 5, recipientProfileId: 999, readAt: null }];
    const res = await request(makeApp()).post("/notifications/5/read");
    expect(res.status).toBe(403);
  });

  it("404s for a missing notification", async () => {
    h.rows = [];
    const res = await request(makeApp()).post("/notifications/123/read");
    expect(res.status).toBe(404);
  });

  it("400s for an invalid id", async () => {
    const res = await request(makeApp()).post("/notifications/abc/read");
    expect(res.status).toBe(400);
  });
});

describe("POST /notifications/read-all", () => {
  it("marks all the user's notifications read", async () => {
    const res = await request(makeApp()).post("/notifications/read-all");
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(h.updates[0].readAt).toBeInstanceOf(Date);
  });
});
