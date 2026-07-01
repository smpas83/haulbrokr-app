import { beforeEach, describe, expect, it, vi } from "vitest";
import express, { type Express } from "express";
import request from "supertest";

const h = vi.hoisted(() => ({
  profile: {
    id: 1,
    role: "customer",
    companyName: "Customer Co",
    staffRole: "cto",
  } as Record<string, unknown>,
  pricingRules: [] as Record<string, unknown>[],
  commissionRules: [] as Record<string, unknown>[],
  jobs: [] as Record<string, unknown>[],
  transactions: [] as Record<string, unknown>[],
  invoices: [] as Record<string, unknown>[],
  refunds: [] as Record<string, unknown>[],
  trucks: [] as Record<string, unknown>[],
  activity: [] as Record<string, unknown>[],
  statusUpdates: [] as Record<string, unknown>[],
  inserts: [] as { table: unknown; row: Record<string, unknown> }[],
  nextId: 1,
}));

vi.mock("@workspace/db", () => {
  const makeTable = (name: string) =>
    new Proxy({}, { get: (_target, prop) => `${name}.${String(prop)}` });
  const commissionRulesTable = makeTable("commissionRules");
  const pricingRulesTable = makeTable("pricingRules");
  const marketplaceQuotesTable = makeTable("marketplaceQuotes");
  const marketplaceAuditLogsTable = makeTable("marketplaceAuditLogs");
  const paymentTransactionsTable = makeTable("paymentTransactions");
  const invoicesTable = makeTable("invoices");
  const refundsTable = makeTable("refunds");
  const trucksTable = makeTable("trucks");
  const activityTable = makeTable("activity");
  const jobStatusUpdatesTable = makeTable("jobStatusUpdates");
  const jobsTable = makeTable("jobs");
  const payoutTransfersTable = makeTable("payoutTransfers");

  function rowsFor(table: unknown) {
    if (table === pricingRulesTable) return h.pricingRules;
    if (table === commissionRulesTable) return h.commissionRules;
    if (table === paymentTransactionsTable) return h.transactions;
    if (table === invoicesTable) return h.invoices;
    if (table === trucksTable) return h.trucks;
    if (table === activityTable) return h.activity;
    if (table === jobStatusUpdatesTable) return h.statusUpdates;
    if (table === jobsTable) return h.jobs;
    return [];
  }

  function chain(table: unknown) {
    const rows = () => Promise.resolve(rowsFor(table));
    return {
      where: () => ({
        orderBy: () => ({
          limit: rows,
          then: (resolve: any, reject: any) => rows().then(resolve, reject),
        }),
        limit: rows,
        groupBy: rows,
        then: (resolve: any, reject: any) => rows().then(resolve, reject),
      }),
      orderBy: () => ({
        limit: rows,
        then: (resolve: any, reject: any) => rows().then(resolve, reject),
      }),
      groupBy: rows,
      limit: rows,
      then: (resolve: any, reject: any) => rows().then(resolve, reject),
    };
  }

  return {
    commissionRulesTable,
    pricingRulesTable,
    marketplaceQuotesTable,
    marketplaceAuditLogsTable,
    paymentTransactionsTable,
    invoicesTable,
    refundsTable,
    trucksTable,
    activityTable,
    jobStatusUpdatesTable,
    jobsTable,
    payoutTransfersTable,
    db: {
      select: () => ({
        from: chain,
      }),
      insert: (table: unknown) => ({
        values: (row: Record<string, unknown>) => {
          h.inserts.push({ table, row });
          return {
            returning: () =>
              Promise.resolve([
                {
                  id: h.nextId++,
                  status: "quoted",
                  createdAt: new Date("2026-07-01T00:00:00Z"),
                  ...row,
                },
              ]),
          };
        },
      }),
      update: () => ({
        set: (row: Record<string, unknown>) => ({
          where: () => ({
            returning: () =>
              Promise.resolve([
                {
                  id: 1,
                  createdAt: new Date("2026-07-01T00:00:00Z"),
                  updatedAt: new Date("2026-07-01T00:00:00Z"),
                  ...row,
                },
              ]),
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

vi.mock("../lib/access", () => ({
  loadJobIfMember: async (jobId: number) =>
    h.jobs.find((job) => job.id === jobId) ?? null,
}));

vi.mock("../lib/stripeClient", () => ({
  getUncachableStripeClient: vi.fn(async () => ({
    refunds: {
      create: vi.fn(async () => ({ id: "re_test_1", status: "succeeded" })),
    },
  })),
}));

vi.mock("../lib/documentStatus", () => ({
  computeDocumentStatus: vi.fn(async (profile: any) => ({
    profileId: profile.id,
    role: profile.role,
    complete: true,
    gated: false,
    missing: [],
    items: [],
  })),
}));

import marketplaceRouter from "./marketplace";

function makeApp(): Express {
  const app = express();
  app.use(express.json());
  app.use(marketplaceRouter);
  return app;
}

beforeEach(() => {
  h.profile = {
    id: 1,
    role: "customer",
    companyName: "Customer Co",
    staffRole: "cto",
  };
  h.pricingRules = [
    {
      id: 1,
      code: "base_hourly_rate",
      label: "Base",
      valueType: "fixed_amount",
      value: "100",
      priority: 0,
    },
    {
      id: 2,
      code: "distance_mile_rate",
      label: "Distance",
      valueType: "fixed_amount",
      value: "5",
      priority: 0,
    },
  ];
  h.commissionRules = [
    {
      id: 3,
      scope: "global",
      targetId: null,
      rate: "0.20",
      priority: 0,
      reason: "global",
    },
  ];
  h.jobs = [
    {
      id: 10,
      customerId: 1,
      providerId: 2,
      status: "completed",
      customerTotalAmount: "300.00",
      providerNetAmount: "250.00",
      stripePaymentIntentId: "pi_1",
      stripeChargeId: "ch_1",
    },
  ];
  h.transactions = [
    {
      id: 1,
      jobId: 10,
      kind: "charge",
      status: "succeeded",
      amountCents: 30000,
      createdAt: new Date("2026-07-01T00:00:00Z"),
    },
  ];
  h.invoices = [
    {
      id: 1,
      jobId: 10,
      invoiceNumber: "INV-2026-0010",
      status: "open",
      subtotal: "250.00",
      platformFeeAmount: "50.00",
      totalAmount: "300.00",
      createdAt: new Date("2026-07-01T00:00:00Z"),
    },
  ];
  h.refunds = [];
  h.trucks = [{ truckType: "dump_truck", availableTrucks: 3 }];
  h.activity = [
    {
      id: 7,
      profileId: 1,
      type: "payment_failed",
      description: "Payment failed",
    },
  ];
  h.statusUpdates = [{ id: 8, jobId: 10, status: "loaded", note: "Loaded" }];
  h.inserts = [];
  h.nextId = 1;
});

describe("POST /marketplace/quotes", () => {
  it("creates a persisted quote with customer total, vendor payout, commission, and GMV", async () => {
    const res = await request(makeApp()).post("/marketplace/quotes").send({
      distanceMiles: 10,
      estimatedHours: 2,
      trucksNeeded: 1,
      truckType: "dump_truck",
      materialType: "gravel",
    });

    expect(res.status).toBe(201);
    expect(res.body.vendorPayout).toBe(250);
    expect(res.body.platformCommission).toBe(50);
    expect(res.body.customerQuote).toBe(300);
    expect(res.body.gmv).toBe(300);
    expect(h.inserts.some((entry) => entry.row.customerTotal === "300")).toBe(
      true,
    );
  });
});

describe("POST /admin/marketplace/commission-rules", () => {
  it("creates an admin-configurable commission rule and audit record", async () => {
    const res = await request(makeApp())
      .post("/admin/marketplace/commission-rules")
      .send({
        scope: "customer",
        targetId: 42,
        rate: 0.15,
        reason: "Strategic account",
      });

    expect(res.status).toBe(201);
    expect(res.body.scope).toBe("customer");
    expect(res.body.rate).toBe(0.15);
    expect(h.inserts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          row: expect.objectContaining({
            scope: "customer",
            targetId: 42,
            rate: "0.15",
          }),
        }),
        expect.objectContaining({
          row: expect.objectContaining({ action: "commission_rule.create" }),
        }),
      ]),
    );
  });
});

describe("marketplace financial APIs", () => {
  it("lists job payment transactions for a job member", async () => {
    const res = await request(makeApp()).get(
      "/marketplace/jobs/10/transactions",
    );

    expect(res.status).toBe(200);
    expect(res.body[0]).toMatchObject({
      kind: "charge",
      status: "succeeded",
      amount: 300,
    });
  });

  it("returns invoice records with numeric totals", async () => {
    const res = await request(makeApp()).get("/marketplace/invoices/1");

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      invoiceNumber: "INV-2026-0010",
      subtotal: 250,
      platformFeeAmount: 50,
      totalAmount: 300,
    });
  });

  it("creates a Stripe refund and records marketplace refund/ledger rows", async () => {
    const res = await request(makeApp())
      .post("/marketplace/jobs/10/refunds")
      .send({
        amountCents: 10000,
        reason: "Customer adjustment",
      });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      amount: 100,
      stripeRefundId: "re_test_1",
    });
    expect(h.inserts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          row: expect.objectContaining({ kind: "refund", amountCents: 10000 }),
        }),
        expect.objectContaining({
          row: expect.objectContaining({
            stripeRefundId: "re_test_1",
            amountCents: 10000,
          }),
        }),
      ]),
    );
  });
});

describe("marketplace status APIs", () => {
  it("returns fleet availability aggregates", async () => {
    const res = await request(makeApp()).get("/marketplace/fleet-availability");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      totalAvailable: 3,
      byTruckType: [{ truckType: "dump_truck", availableTrucks: 3 }],
    });
  });

  it("returns paginated marketplace notifications", async () => {
    const res = await request(makeApp()).get(
      "/marketplace/notifications?limit=10",
    );

    expect(res.status).toBe(200);
    expect(res.body.items[0]).toMatchObject({ type: "payment_failed" });
  });

  it("returns job trip timeline", async () => {
    const res = await request(makeApp()).get("/marketplace/jobs/10/trips");

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      jobId: 10,
      status: "completed",
      timeline: [expect.objectContaining({ status: "loaded" })],
    });
  });

  it("returns document status for the authenticated profile", async () => {
    const res = await request(makeApp()).get("/marketplace/document-status");

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ profileId: 1, complete: true });
  });
});
