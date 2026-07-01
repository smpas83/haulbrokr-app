import { describe, it, expect, beforeEach, vi } from "vitest";
import express, { type Express } from "express";
import request from "supertest";

const h = vi.hoisted(() => ({
  profile: { id: 1, role: "customer" } as Record<string, unknown>,
  notifications: [] as Record<string, unknown>[],
  deliveries: [] as Record<string, unknown>[],
}));

vi.mock("@workspace/db", () => {
  const makeTable = (name: string) =>
    new Proxy({}, { get: (_t, p) => `${name}.${String(p)}` });
  const notificationQueueTable = makeTable("notificationQueue");
  const notificationDeliveryTable = makeTable("notificationDelivery");
  const profilesTable = makeTable("profiles");
  const db = {
    select: () => ({
      from: (table: unknown) => ({
        where: () => ({
          orderBy: () => Promise.resolve(table === notificationQueueTable ? h.notifications : []),
          then(onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) {
            return Promise.resolve(table === notificationQueueTable ? h.notifications : []).then(onFulfilled, onRejected);
          },
        }),
        orderBy: () => Promise.resolve(table === notificationQueueTable ? h.notifications : []),
      }),
    }),
    insert: (table: unknown) => ({
      values: (vals: Record<string, unknown>) => {
        const row = { id: table === notificationQueueTable ? h.notifications.length + 1 : h.deliveries.length + 1, createdAt: new Date(), updatedAt: new Date(), ...vals };
        if (table === notificationQueueTable) h.notifications.push(row);
        if (table === notificationDeliveryTable) h.deliveries.push(row);
        return { returning: () => Promise.resolve([row]) };
      },
    }),
    update: (table: unknown) => ({
      set: (vals: Record<string, unknown>) => ({
        where: () => ({
          returning: () => {
            const row = table === notificationQueueTable ? h.notifications[0] : {};
            Object.assign(row, vals);
            return Promise.resolve([row]);
          },
        }),
      }),
    }),
  };
  return { db, notificationQueueTable, notificationDeliveryTable, profilesTable };
});

vi.mock("../middlewares/requireAuth", () => ({
  requireProfile: (req: any, _res: any, next: any) => {
    req.profile = h.profile;
    next();
  },
  getRequestProfile: (req: any) => req.profile,
  attachClerkProfileIfPresent: (req: any, _res: any, next: any) => {
    req.profile = h.profile;
    next();
  },
}));

vi.mock("../middlewares/staffAuth", () => ({
  attachStaffSession: (_req: any, _res: any, next: any) => next(),
  requireStaffOrProfile: (_req: any, _res: any, next: any) => next(),
}));

vi.mock("../middlewares/requireAdmin", () => ({
  requirePermission: () => (_req: any, _res: any, next: any) => next(),
}));

vi.mock("../lib/resendClient", () => ({
  getUncachableResendClient: vi.fn(async () => ({
    fromEmail: "ops@example.com",
    client: { emails: { send: vi.fn(async () => ({ id: "email_1" })) } },
  })),
}));

import notificationsRouter from "./notifications";

function makeApp(): Express {
  const app = express();
  app.use(express.json());
  app.use(notificationsRouter);
  return app;
}

beforeEach(() => {
  h.profile = { id: 1, role: "customer" };
  h.notifications = [];
  h.deliveries = [];
  delete process.env.SMS_PROVIDER_API_KEY;
});

describe("notification engine routes", () => {
  it("queues supported notification events", async () => {
    const res = await request(makeApp()).post("/notifications/queue").send({
      profileId: 1,
      eventType: "payment_received",
      channel: "in_app",
      body: "Payment received",
    });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe("queued");
    expect(h.notifications).toHaveLength(1);
  });

  it("processes due in-app notifications as sent", async () => {
    h.notifications = [{
      id: 1,
      profileId: 1,
      eventType: "driver_assigned",
      channel: "in_app",
      body: "Driver assigned",
      status: "queued",
      attempts: 0,
      maxAttempts: 3,
      scheduledFor: new Date(),
    }];

    const res = await request(makeApp()).post("/admin/notifications/process");

    expect(res.status).toBe(200);
    expect(res.body.processed[0].status).toBe("sent");
    expect(h.deliveries[0]).toMatchObject({ status: "sent", channel: "in_app" });
  });

  it("records failed retry attempts when SMS credentials are missing", async () => {
    h.notifications = [{
      id: 1,
      profileId: 1,
      eventType: "payout_sent",
      channel: "sms",
      body: "Payout sent",
      status: "queued",
      attempts: 2,
      maxAttempts: 3,
      scheduledFor: new Date(),
    }];

    const res = await request(makeApp()).post("/notifications/1/retry");

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("failed");
    expect(res.body.lastError).toContain("SMS provider");
    expect(h.deliveries[0].status).toBe("failed");
  });
});
