import { beforeEach, describe, expect, it, vi } from "vitest";
import express, { type Express } from "express";
import request from "supertest";

const h = vi.hoisted(() => ({
  profile: { id: 1 } as Record<string, unknown>,
  rows: [] as Record<string, unknown>[],
}));

vi.mock("@workspace/db", () => {
  const marketplacePaymentsTable = new Proxy({}, { get: (_target, prop) => `marketplacePayments.${String(prop)}` });
  return {
    marketplacePaymentsTable,
    db: {
      select: () => ({
        from: () => ({
          where: () => ({
            orderBy: () => Promise.resolve(h.rows),
          }),
        }),
      }),
    },
  };
});

vi.mock("../middlewares/requireAuth", () => ({
  requireProfile: (req: any, _res: any, next: any) => {
    req.profile = h.profile;
    next();
  },
  getRequestProfile: (req: any) => req.profile,
}));

import paymentsRouter from "./payments";

function makeApp(): Express {
  const app = express();
  app.use(express.json());
  app.use(paymentsRouter);
  return app;
}

beforeEach(() => {
  h.profile = { id: 1 };
  h.rows = [{
    id: 7,
    jobId: 99,
    customerId: 1,
    vendorId: 2,
    type: "transfer",
    status: "released",
    amountCents: 12000,
    platformFeeCents: 2000,
    vendorPayoutCents: 10000,
    driverPayoutCents: null,
    currency: "usd",
    createdAt: new Date("2026-06-30T00:00:00Z"),
  }];
});

describe("GET /payments/history", () => {
  it("returns serialized marketplace payment history for the authenticated actor", async () => {
    const res = await request(makeApp()).get("/payments/history");

    expect(res.status).toBe(200);
    expect(res.body.payments).toHaveLength(1);
    expect(res.body.payments[0]).toMatchObject({
      jobId: 99,
      amount: 120,
      platformFee: 20,
      vendorPayout: 100,
    });
  });
});
