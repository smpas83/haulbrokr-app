import { beforeEach, describe, expect, it, vi } from "vitest";
import express, { type Express } from "express";
import request from "supertest";

const h = vi.hoisted(() => ({
  profile: { id: 1, role: "driver" } as any,
  admin: false,
  rows: new Map<unknown, unknown[]>(),
  inserts: [] as Record<string, unknown>[],
  updates: [] as Record<string, unknown>[],
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
    insert: () => ({
      values: (vals: Record<string, unknown> | Record<string, unknown>[]) => {
        const list = Array.isArray(vals) ? vals : [vals];
        h.inserts.push(...list);
        return {
          returning: () => Promise.resolve(list.map((row, index) => ({ id: index + 1, createdAt: new Date(), updatedAt: new Date(), queuedAt: new Date(), ...row }))),
        };
      },
    }),
    update: () => ({
      set: (vals: Record<string, unknown>) => {
        h.updates.push(vals);
        return {
          where: () => ({
            returning: () => Promise.resolve([{ id: 1, createdAt: new Date(), updatedAt: new Date(), queuedAt: new Date(), ...vals }]),
          }),
        };
      },
    }),
  };
  return { db, notificationEventsTable: makeTable("notificationEvents"), profilesTable: makeTable("profiles") };
});

vi.mock("../middlewares/requireAuth", () => ({
  requireProfile: (req: any, _res: any, next: any) => {
    req.profile = h.profile;
    next();
  },
  getRequestProfile: (req: any) => req.profile,
}));

vi.mock("../middlewares/requireAdmin", () => ({
  isAdmin: vi.fn(async () => h.admin),
}));

vi.mock("../lib/resendClient", () => ({
  getUncachableResendClient: vi.fn(async () => ({
    fromEmail: "noreply@haulbrokr.com",
    client: { emails: { send: vi.fn(async () => ({ data: { id: "email_1" } })) } },
  })),
}));

import notificationsRouter from "./notifications-backend";
import { notificationEventsTable } from "@workspace/db";

function makeApp(): Express {
  const app = express();
  app.use(express.json());
  app.use(notificationsRouter);
  return app;
}

beforeEach(() => {
  h.profile = { id: 1, role: "driver" };
  h.admin = false;
  h.rows.clear();
  h.inserts = [];
  h.updates = [];
});

describe("notification backend routes", () => {
  it("returns the caller notification feed", async () => {
    h.rows.set(notificationEventsTable, [{ id: 1, profileId: 1, channel: "realtime", status: "pending" }]);

    const res = await request(makeApp()).get("/notifications");

    expect(res.status).toBe(200);
    expect(res.body.notifications).toHaveLength(1);
  });

  it("enqueues notifications for self", async () => {
    const res = await request(makeApp()).post("/notifications/events").send({
      channels: ["email", "realtime"],
      eventType: "test",
      title: "Hello",
      body: "World",
    });

    expect(res.status).toBe(201);
    expect(h.inserts.map((row) => row.channel)).toEqual(["email", "realtime"]);
  });

  it("blocks non-admin enqueueing for another profile", async () => {
    const res = await request(makeApp()).post("/notifications/events").send({
      profileId: 2,
      channels: ["email"],
      eventType: "test",
      title: "Hello",
      body: "World",
    });

    expect(res.status).toBe(403);
  });

  it("allows admins to view and deliver pending notifications", async () => {
    h.admin = true;
    h.rows.set(notificationEventsTable, [{ id: 1, profileId: 1, channel: "sms", eventType: "test", title: "Hi", body: "Body", status: "pending", destination: null, providerMessageId: null, error: null, metadataJson: null, queuedAt: new Date(), sentAt: null, createdAt: new Date(), updatedAt: new Date() }]);

    const pending = await request(makeApp()).get("/admin/notifications/pending");
    expect(pending.status).toBe(200);
    expect(pending.body.notifications).toHaveLength(1);

    const delivered = await request(makeApp()).post("/admin/notifications/deliver").send({ limit: 1 });
    expect(delivered.status).toBe(200);
    expect(h.updates.at(-1)).toMatchObject({ status: "skipped" });
  });
});
