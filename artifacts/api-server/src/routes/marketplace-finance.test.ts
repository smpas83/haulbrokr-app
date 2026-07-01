import { describe, it, expect, beforeEach, vi } from "vitest";
import express, { type Express } from "express";
import request from "supertest";

const h = vi.hoisted(() => ({
  profile: { id: 1, role: "customer", companyName: "Customer Co" } as Record<string, unknown>,
  rows: new Map<unknown, Record<string, unknown>[]>(),
  inserts: [] as Record<string, unknown>[],
}));

vi.mock("@workspace/db", () => {
  const makeTable = (name: string) =>
    new Proxy({}, { get: (_t, p) => `${name}.${String(p)}` });
  const invoiceDocumentsTable = makeTable("invoiceDocuments");
  const paymentHistoryTable = makeTable("paymentHistory");
  const refundHistoryTable = makeTable("refundHistory");
  const jobsTable = makeTable("jobs");
  const vendorPayoutsTable = makeTable("vendorPayouts");
  const profilesTable = makeTable("profiles");
  const stripeConnectedAccountsTable = makeTable("stripeConnectedAccounts");
  const db = {
    select: () => ({
      from: (table: unknown) => ({
        where: () => ({
          orderBy: () => Promise.resolve(h.rows.get(table) ?? []),
          then(onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) {
            return Promise.resolve(h.rows.get(table) ?? []).then(onFulfilled, onRejected);
          },
        }),
        orderBy: () => Promise.resolve(h.rows.get(table) ?? []),
        then(onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) {
          return Promise.resolve(h.rows.get(table) ?? []).then(onFulfilled, onRejected);
        },
      }),
    }),
    insert: (table: unknown) => ({
      values: (vals: Record<string, unknown>) => {
        h.inserts.push({ table, ...vals });
        const row = { id: h.inserts.length, createdAt: new Date("2026-07-01T00:00:00Z"), updatedAt: new Date("2026-07-01T00:00:00Z"), ...vals };
        return { returning: () => Promise.resolve([row]) };
      },
    }),
  };
  return {
    db,
    invoiceDocumentsTable,
    paymentHistoryTable,
    refundHistoryTable,
    jobsTable,
    vendorPayoutsTable,
    profilesTable,
    stripeConnectedAccountsTable,
  };
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

vi.mock("../lib/stripeClient", () => ({
  getUncachableStripeClient: vi.fn(async () => ({
    refunds: {
      create: vi.fn(async () => ({ id: "re_test_1", status: "succeeded" })),
    },
  })),
}));

import financeRouter from "./marketplace-finance";
import {
  invoiceDocumentsTable,
  jobsTable,
  paymentHistoryTable,
  profilesTable,
  refundHistoryTable,
  vendorPayoutsTable,
} from "@workspace/db";

function makeApp(): Express {
  const app = express();
  app.use(express.json());
  app.use(financeRouter);
  return app;
}

beforeEach(() => {
  h.profile = { id: 1, role: "customer", companyName: "Customer Co" };
  h.rows.clear();
  h.inserts = [];
});

describe("marketplace finance routes", () => {
  it("returns billing history with outstanding balance and refunds", async () => {
    h.rows.set(invoiceDocumentsTable, [{
      id: 10,
      customerProfileId: 1,
      invoiceNumber: "HB-000010",
      status: "issued",
      totalAmount: "115.00",
      amountPaid: "25.00",
      amountRefunded: "5.00",
      issuedAt: new Date("2026-07-01T00:00:00Z"),
    }]);
    h.rows.set(paymentHistoryTable, [{ id: 1, customerProfileId: 1, amount: "25.00", platformFeeAmount: "3.75", createdAt: new Date() }]);
    h.rows.set(refundHistoryTable, [{ id: 2, customerProfileId: 1, amount: "5.00", createdAt: new Date() }]);

    const res = await request(makeApp()).get("/billing/history");

    expect(res.status).toBe(200);
    expect(res.body.outstandingBalance).toBe(85);
    expect(res.body.invoices[0].totalAmount).toBe(115);
    expect(res.body.refunds[0].amount).toBe(5);
  });

  it("creates a Stripe refund and records refund history", async () => {
    h.rows.set(jobsTable, [{
      id: 10,
      customerId: 1,
      providerId: 2,
      customerTotalAmount: "115.00",
      totalAmount: "100.00",
      platformFeeAmount: "15.00",
      stripePaymentIntentId: "pi_1",
      stripeTransferId: "tr_1",
    }]);

    const res = await request(makeApp())
      .post("/admin/jobs/10/refunds")
      .send({ amount: 25, reason: "short_load" });

    expect(res.status).toBe(201);
    expect(res.body.amount).toBe(25);
    expect(h.inserts.some((insert) => insert.stripeRefundId === "re_test_1")).toBe(true);
  });

  it("returns admin financial metrics and grouped revenue", async () => {
    h.rows.set(jobsTable, [
      {
        id: 10,
        customerId: 1,
        providerId: 2,
        status: "completed",
        customerTotalAmount: "115.00",
        totalAmount: "100.00",
        platformFeeAmount: "15.00",
        materialType: "gravel",
        truckType: "dump_truck",
        createdAt: new Date("2026-07-01T00:00:00Z"),
      },
    ]);
    h.rows.set(vendorPayoutsTable, [{ netAmount: "100.00", paidAmount: "100.00", status: "paid" }]);
    h.rows.set(refundHistoryTable, [{ amount: "10.00" }]);
    h.rows.set(paymentHistoryTable, [{ type: "chargeback", amount: "4.00" }]);
    h.rows.set(profilesTable, [{ id: 1, companyName: "Customer Co" }, { id: 2, companyName: "Vendor Co" }]);

    const res = await request(makeApp()).get("/admin/financials?groupBy=material");

    expect(res.status).toBe(200);
    expect(res.body.gmv).toBe(115);
    expect(res.body.netRevenue).toBe(15);
    expect(res.body.completedPayouts).toBe(100);
    expect(res.body.groups[0]).toMatchObject({ label: "gravel", gmv: 115 });
  });
});
