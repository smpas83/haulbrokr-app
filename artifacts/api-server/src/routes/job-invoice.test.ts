import { describe, it, expect, beforeEach, vi } from "vitest";
import express, { type Express } from "express";
import request from "supertest";

const h = vi.hoisted(() => ({
  rows: new Map<unknown, unknown[]>(),
  profileSelectQueue: [] as unknown[][],
  profileSelectIndex: 0,
  profile: {} as Record<string, unknown>,
  isAdminResult: false,
}));

vi.mock("@workspace/db", () => {
  const makeTable = (name: string) =>
    new Proxy({}, { get: (_t, p) => `${name}.${String(p)}` });
  const db = {
    select: () => ({
      from: (table: unknown) => ({
        where: () => {
          if (table === profilesTable && h.profileSelectQueue.length > 0) {
            const row = h.profileSelectQueue[h.profileSelectIndex] ?? [];
            h.profileSelectIndex += 1;
            return Promise.resolve(row);
          }
          return Promise.resolve(h.rows.get(table) ?? []);
        },
      }),
    }),
  };
  return {
    db,
    jobsTable: makeTable("jobs"),
    profilesTable: makeTable("profiles"),
    requestsTable: makeTable("requests"),
  };
});

vi.mock("../middlewares/requireAuth", () => ({
  requireAuth: (_req: any, _res: any, next: any) => next(),
  requireProfile: (req: any, _res: any, next: any) => {
    req.profile = { ...h.profile };
    next();
  },
  getRequestProfile: (req: any) => req.profile,
}));

vi.mock("../middlewares/requireAdmin", () => ({
  isAdmin: vi.fn(async () => h.isAdminResult),
}));

import jobsRouter from "./jobs";
import {
  formatInvoiceNumber,
  formatTruckTypeLabel,
  generateJobInvoicePdf,
  loadJobInvoiceData,
  canDownloadJobInvoice,
} from "../lib/jobInvoice";
import { jobsTable, profilesTable, requestsTable } from "@workspace/db";
import { isAdmin } from "../middlewares/requireAdmin";

const CUSTOMER_ID = 1;
const PROVIDER_ID = 2;
const JOB_ID = 10;

function completedJob(overrides: Record<string, unknown> = {}) {
  return {
    id: JOB_ID,
    requestId: 5,
    customerId: CUSTOMER_ID,
    providerId: PROVIDER_ID,
    status: "completed",
    materialType: "gravel",
    truckType: "dump_truck",
    pickupAddress: "100 Main St, Dallas, TX",
    deliveryAddress: "200 Oak Ave, Dallas, TX",
    scheduledDate: new Date("2026-06-15T12:00:00Z"),
    ratePerHour: "125.00",
    trucksAssigned: 2,
    estimatedHours: "8",
    totalHours: "9.5",
    totalAmount: "1187.50",
    platformFeeRate: "0.15",
    platformFeeAmount: "178.13",
    customerTotalAmount: "1365.63",
    providerNetAmount: "1187.50",
    paymentDueDate: new Date("2026-07-15T12:00:00Z"),
    invoicedAt: new Date("2026-06-20T12:00:00Z"),
    completedAt: new Date("2026-06-18T12:00:00Z"),
    ...overrides,
  };
}

function makeApp(): Express {
  const app = express();
  app.use(express.json());
  app.use(jobsRouter);
  return app;
}

function seedInvoiceFixtures() {
  h.rows.set(jobsTable, [completedJob()]);
  h.profileSelectQueue = [
    [{ id: CUSTOMER_ID, companyName: "Acme Construction", contactName: "Pat Customer", address: "1 Site Rd", city: "Dallas", state: "TX", zip: "75201" }],
    [{ id: PROVIDER_ID, companyName: "Big Haul LLC", contactName: "Sam Hauler" }],
  ];
  h.profileSelectIndex = 0;
  h.rows.set(requestsTable, [{ id: 5, quantityTons: "24.5" }]);
}

beforeEach(() => {
  h.rows.clear();
  h.profileSelectQueue = [];
  h.profileSelectIndex = 0;
  h.isAdminResult = false;
  h.profile = { id: CUSTOMER_ID, role: "customer", companyName: "Acme Construction" };
  vi.mocked(isAdmin).mockClear();
});

describe("formatInvoiceNumber", () => {
  it("uses INV-YYYY-#### pattern", () => {
    expect(formatInvoiceNumber(10, new Date("2026-06-20T12:00:00Z"))).toBe("INV-2026-0010");
  });
});

describe("formatTruckTypeLabel", () => {
  it("humanizes snake_case truck types", () => {
    expect(formatTruckTypeLabel("super_10")).toBe("Super 10");
  });
});

describe("loadJobInvoiceData", () => {
  beforeEach(() => {
    seedInvoiceFixtures();
  });

  it("loads invoice fields from job, profiles, and request", async () => {
    const data = await loadJobInvoiceData(JOB_ID);
    expect(data).toMatchObject({
      invoiceNumber: "INV-2026-0010",
      customer: { companyName: "Acme Construction", contactName: "Pat Customer" },
      hauler: { companyName: "Big Haul LLC", contactName: "Sam Hauler" },
      job: {
        materialType: "Gravel",
        truckType: "Dump Truck",
        trucksAssigned: 2,
      },
      platformFeeAmount: 178.13,
      providerNetAmount: 1187.5,
      customerTotalAmount: 1365.63,
    });
    expect(data!.job.quantityLabel).toContain("24.5 tons");
    expect(data!.job.quantityLabel).toContain("9.5 hours");
  });
});

describe("generateJobInvoicePdf", () => {
  it("returns a valid PDF buffer", async () => {
    seedInvoiceFixtures();
    const data = await loadJobInvoiceData(JOB_ID);
    expect(data).not.toBeNull();
    const pdf = await generateJobInvoicePdf(data!);
    expect(Buffer.from(pdf.slice(0, 5)).toString("utf8")).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(500);
  });
});

describe("canDownloadJobInvoice", () => {
  it("allows the direct customer", async () => {
    const ok = await canDownloadJobInvoice(completedJob() as any, {
      id: CUSTOMER_ID,
      role: "customer",
    } as any);
    expect(ok).toBe(true);
  });

  it("allows staff admins", async () => {
    const ok = await canDownloadJobInvoice(completedJob() as any, {
      id: 99,
      role: "provider",
      staffRole: "ceo",
    } as any);
    expect(ok).toBe(true);
  });

  it("denies the provider on the job", async () => {
    const ok = await canDownloadJobInvoice(completedJob() as any, {
      id: PROVIDER_ID,
      role: "provider",
    } as any);
    expect(ok).toBe(false);
  });
});

describe("GET /jobs/:id/invoice", () => {
  beforeEach(() => {
    seedInvoiceFixtures();
  });

  it("returns PDF for the job customer", async () => {
    const res = await request(makeApp()).get(`/jobs/${JOB_ID}/invoice`);
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/application\/pdf/);
    expect(res.headers["content-disposition"]).toContain("INV-2026-0010.pdf");
    expect(res.body.slice(0, 5).toString("utf8")).toBe("%PDF-");
  });

  it("returns PDF for staff admins", async () => {
    h.profile = { id: PROVIDER_ID, role: "provider" };
    h.isAdminResult = true;
    const res = await request(makeApp()).get(`/jobs/${JOB_ID}/invoice`);
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/application\/pdf/);
  });

  it("returns 403 for the provider who is not staff", async () => {
    h.profile = { id: PROVIDER_ID, role: "provider" };
    const res = await request(makeApp()).get(`/jobs/${JOB_ID}/invoice`);
    expect(res.status).toBe(403);
  });

  it("returns 400 when the job is not completed", async () => {
    h.rows.set(jobsTable, [completedJob({ status: "in_progress" })]);
    const res = await request(makeApp()).get(`/jobs/${JOB_ID}/invoice`);
    expect(res.status).toBe(400);
  });

  it("returns 404 for a missing job", async () => {
    h.rows.set(jobsTable, []);
    const res = await request(makeApp()).get(`/jobs/${JOB_ID}/invoice`);
    expect(res.status).toBe(404);
  });
});
