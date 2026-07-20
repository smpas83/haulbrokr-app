import { describe, it, expect, beforeEach, vi } from "vitest";
import express, { type Express } from "express";
import request from "supertest";

const h = vi.hoisted(() => ({
  config: {
    settings: [
      {
        id: 1,
        key: "marketplace_fee_rate",
        value: "0.15",
        description: "Marketplace fee",
        updatedAt: new Date("2026-07-01T00:00:00Z"),
      },
    ],
    fuelWeeks: [
      {
        id: 10,
        weekStartDate: "2026-07-07",
        nationalDieselPrice: "3.850",
        surchargeRate: "0.05",
        notes: "Week of Jul 7",
        isActive: true,
        updatedAt: new Date("2026-07-01T00:00:00Z"),
      },
    ],
    rates: {
      marketplaceFeeRate: 0.15,
      fuelSurchargeRate: 0.05,
      emergencyDispatchRate: 0.1,
      holidaySurchargeRate: 0.15,
      waitTimeRatePerHour: 75,
      taxRate: 0,
      taxesEnabled: false,
    },
    upsertedSetting: null as any,
    upsertedFuel: null as any,
    deletedId: null as number | null,
  },
}));

vi.mock("../lib/pricing", () => ({
  ensurePricingSettingsSeeded: vi.fn(async () => undefined),
  listPricingSettings: vi.fn(async () => h.config.settings),
  listFuelSurchargeWeeks: vi.fn(async () => h.config.fuelWeeks),
  loadPricingRates: vi.fn(async () => h.config.rates),
  upsertPricingSetting: vi.fn(async (key: string, value: number) => {
    h.config.upsertedSetting = { key, value };
    const row = h.config.settings.find((s) => s.key === key);
    if (row) row.value = String(value);
    return row;
  }),
  upsertFuelSurchargeWeek: vi.fn(async (input: any) => {
    h.config.upsertedFuel = input;
    return {
      id: 11,
      weekStartDate: input.weekStartDate,
      surchargeRate: String(input.surchargeRate),
      nationalDieselPrice:
        input.nationalDieselPrice != null ? String(input.nationalDieselPrice) : null,
      notes: input.notes ?? null,
      isActive: input.isActive ?? true,
      updatedAt: new Date("2026-07-01T00:00:00Z"),
    };
  }),
  deleteFuelSurchargeWeek: vi.fn(async (id: number) => {
    h.config.deletedId = id;
    return h.config.fuelWeeks[0] ?? null;
  }),
}));

vi.mock("../middlewares/staffAuth", () => ({
  attachStaffSession: (_req: any, _res: any, next: any) => next(),
  requireStaffOrProfile: (_req: any, _res: any, next: any) => next(),
}));

vi.mock("../middlewares/requireAuth", () => ({
  attachClerkProfileIfPresent: (_req: any, _res: any, next: any) => next(),
}));

vi.mock("../middlewares/requireAdmin", () => ({
  requirePermission: () => (_req: any, _res: any, next: any) => next(),
  requireAdmin: (_req: any, _res: any, next: any) => next(),
  getStaffRole: async () => "cto",
  getPermissions: async () => ["overview"],
  ASSIGNABLE_ROLES: ["cto"],
}));

// Admin router pulls many DB deps — stub the whole @workspace/db surface lightly.
vi.mock("@workspace/db", () => {
  const makeTable = (name: string) =>
    new Proxy({}, { get: (_t, p) => `${name}.${String(p)}` });
  const chain: any = Promise.resolve([]);
  chain.where = () => chain;
  chain.orderBy = () => chain;
  chain.limit = () => chain;
  chain.leftJoin = () => chain;
  chain.innerJoin = () => chain;
  chain.groupBy = () => chain;
  return {
    db: {
      select: () => ({ from: () => chain }),
      insert: () => ({ values: () => Promise.resolve(undefined) }),
      update: () => ({ set: () => ({ where: () => ({ returning: () => Promise.resolve([]) }) }) }),
      delete: () => ({ where: () => ({ returning: () => Promise.resolve([]) }) }),
    },
    pricingSettingsTable: makeTable("pricingSettings"),
    fuelSurchargeWeeksTable: makeTable("fuelSurchargeWeeks"),
    profilesTable: makeTable("profiles"),
    jobsTable: makeTable("jobs"),
    requestsTable: makeTable("requests"),
    activityTable: makeTable("activity"),
    binOrders: makeTable("binOrders"),
    w9SubmissionsTable: makeTable("w9"),
    insuranceSubmissionsTable: makeTable("insurance"),
    driverDocumentsTable: makeTable("docs"),
    factoringRequestsTable: makeTable("factoring"),
    pageViewsTable: makeTable("pageViews"),
    creditApplicationsTable: makeTable("credit"),
    dotCdlTable: makeTable("dot"),
  };
});

vi.mock("../lib/payoutRetry", () => ({
  findStuckPayoutJobs: vi.fn(async () => []),
  retryStuckPayout: vi.fn(),
}));

vi.mock("../lib/refunds", () => ({
  getJobPaymentHistory: vi.fn(),
  issueJobRefund: vi.fn(),
}));

vi.mock("../lib/resendClient", () => ({
  getUncachableResendClient: vi.fn(),
}));

vi.mock("../lib/adminComplianceBundle", () => ({
  listProviderComplianceBundles: vi.fn(async () => []),
  reviewProviderW9: vi.fn(),
  reviewProviderInsurance: vi.fn(),
  reviewProviderUploadedDoc: vi.fn(),
  getProviderCanBid: vi.fn(),
  profileSummary: vi.fn(),
  syncDotCdlUploadedDocs: vi.fn(),
}));

vi.mock("../lib/onboardingTrace", () => ({
  listProviderOnboardingTraces: vi.fn(async () => []),
  buildCarrierOnboardingTrace: vi.fn(),
  countPendingComplianceWork: vi.fn(async () => 0),
  markAdminOnboardingViewed: vi.fn(),
}));

import adminRouter from "./admin";

function makeApp(): Express {
  const app = express();
  app.use(express.json());
  app.use(adminRouter);
  return app;
}

beforeEach(() => {
  h.config.rates.marketplaceFeeRate = 0.15;
  h.config.rates.fuelSurchargeRate = 0.05;
  h.config.upsertedSetting = null;
  h.config.upsertedFuel = null;
  h.config.deletedId = null;
  h.config.settings[0].value = "0.15";
});

describe("GET /admin/pricing", () => {
  it("returns configurable settings and active 15% marketplace fee", async () => {
    const res = await request(makeApp()).get("/admin/pricing");
    expect(res.status).toBe(200);
    expect(res.body.settings[0].key).toBe("marketplace_fee_rate");
    expect(res.body.settings[0].value).toBe(0.15);
    expect(res.body.fuelSurchargeWeeks[0].surchargeRate).toBe(0.05);
    expect(res.body.activeRates.marketplaceFeeRate).toBe(0.15);
    expect(res.body.activeRates.fuelSurchargeRate).toBe(0.05);
  });
});

describe("PATCH /admin/pricing", () => {
  it("persists marketplace fee updates via the pricing settings store", async () => {
    const res = await request(makeApp())
      .patch("/admin/pricing")
      .send({ settings: [{ key: "marketplace_fee_rate", value: 0.15 }] });
    expect(res.status).toBe(200);
    expect(h.config.upsertedSetting).toEqual({ key: "marketplace_fee_rate", value: 0.15 });
  });

  it("rejects empty settings arrays", async () => {
    const res = await request(makeApp()).patch("/admin/pricing").send({ settings: [] });
    expect(res.status).toBe(400);
  });
});

describe("POST /admin/pricing/fuel-surcharge", () => {
  it("upserts a weekly national diesel fuel surcharge value", async () => {
    const res = await request(makeApp())
      .post("/admin/pricing/fuel-surcharge")
      .send({
        weekStartDate: "2026-07-14",
        surchargeRate: 0.06,
        nationalDieselPrice: 3.9,
        notes: "EIA weekly",
      });
    expect(res.status).toBe(200);
    expect(h.config.upsertedFuel.weekStartDate).toBe("2026-07-14");
    expect(h.config.upsertedFuel.surchargeRate).toBe(0.06);
    expect(res.body.surchargeRate).toBe(0.06);
  });
});

describe("DELETE /admin/pricing/fuel-surcharge/:id", () => {
  it("deletes a fuel surcharge week row", async () => {
    const res = await request(makeApp()).delete("/admin/pricing/fuel-surcharge/10");
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(h.config.deletedId).toBe(10);
  });
});
