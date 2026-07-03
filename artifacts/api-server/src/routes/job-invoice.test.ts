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
  const profilesTableToken = makeTable("profiles");
  const db = {
    select: () => ({
      from: (table: unknown) => ({
        where: () => {
          if (table === profilesTableToken && h.profileSelectQueue.length > 0) {
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
    profilesTable: profilesTableToken,
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
  formatPaymentStatusLabel,
  formatTruckTypeLabel,
  generateJobInvoicePdf,
  loadJobInvoiceData,
  canDownloadJobInvoice,
  jobIsInvoiceEligible,
} from "../lib/jobInvoice";
import { jobsTable, requestsTable } from "@workspace/db";
import { isAdmin } from "../middlewares/requireAdmin";

const CUSTOMER_ID = 1;
const PROVIDER_ID = 2;
const JOB_ID = 10;
const OUTSIDER_ID = 99;

function baseJob(overrides: Record<string, unknown> = {}) {
  return {
    id: JOB_ID,
    requestId: 5,
    customerId: CUSTOMER_ID,
    providerId: PROVIDER_ID,
    status: "completed",
    paymentStatus: "unpaid",
    completionApproval: "approved",
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

function seedInvoiceFixtures(jobOverrides: Record<string, unknown> = {}) {
  h.rows.set(jobsTable, [baseJob(jobOverrides)]);
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

describe("jobIsInvoiceEligible", () => {
  it("allows completed jobs", () => {
    expect(jobIsInvoiceEligible({ status: "completed", paymentStatus: "unpaid" } as any)).toBe(true);
  });

  it("allows invoiced payment status", () => {
    expect(jobIsInvoiceEligible({ status: "in_progress", paymentStatus: "invoiced" } as any)).toBe(true);
  });

  it("rejects in-progress unpaid jobs", () => {
    expect(jobIsInvoiceEligible({ status: "in_progress", paymentStatus: "unpaid" } as any)).toBe(false);
  });
});

describe("formatPaymentStatusLabel", () => {
  it("humanizes payment status values", () => {
    expect(formatPaymentStatusLabel("invoiced")).toBe("Invoiced");
    expect(formatPaymentStatusLabel("released")).toBe("Released");
  });
});

describe("loadJobInvoiceData", () => {
  beforeEach(() => {
    seedInvoiceFixtures({ paymentStatus: "invoiced" });
  });

  it("loads required invoice fields including payment status and tons", async () => {
    const data = await loadJobInvoiceData(JOB_ID);
    expect(data).toMatchObject({
      invoiceNumber: "INV-2026-0010",
      invoiceDate: "Jun 20, 2026",
      dueDate: "Jul 15, 2026",
      paymentStatus: "Invoiced",
      customerName: "Acme Construction",
      haulingCompanyName: "Big Haul LLC",
      job: {
        id: JOB_ID,
        materialType: "Gravel",
        truckType: "Dump Truck",
        quantityTons: "24.5 tons",
        pickupAddress: "100 Main St, Dallas, TX",
        deliveryAddress: "200 Oak Ave, Dallas, TX",
      },
      platformFeeAmount: 178.13,
      providerNetAmount: 1187.5,
      customerTotalAmount: 1365.63,
    });
  });
});

describe("generateJobInvoicePdf", () => {
  it("returns a valid PDF buffer", async () => {
    seedInvoiceFixtures();
    const data = await loadJobInvoiceData(JOB_ID);
    const pdf = await generateJobInvoicePdf(data!);
    expect(Buffer.from(pdf.slice(0, 5)).toString("utf8")).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(500);
  });
});

describe("canDownloadJobInvoice", () => {
  it("allows the direct customer", async () => {
    expect(await canDownloadJobInvoice(baseJob() as any, { id: CUSTOMER_ID, role: "customer" } as any)).toBe(true);
  });

  it("allows the assigned hauling company", async () => {
    expect(await canDownloadJobInvoice(baseJob() as any, { id: PROVIDER_ID, role: "provider" } as any)).toBe(true);
  });

  it("allows staff admins", async () => {
    expect(await canDownloadJobInvoice(baseJob() as any, { id: OUTSIDER_ID, role: "provider", staffRole: "ceo" } as any)).toBe(true);
  });

  it("denies unrelated users", async () => {
    expect(await canDownloadJobInvoice(baseJob() as any, { id: OUTSIDER_ID, role: "customer" } as any)).toBe(false);
  });
});

describe("GET /jobs/:id/invoice", () => {
  it("returns PDF for the job customer on a completed job", async () => {
    seedInvoiceFixtures();
    const res = await request(makeApp()).get(`/jobs/${JOB_ID}/invoice`);
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/application\/pdf/);
    expect(res.headers["content-disposition"]).toContain("INV-2026-0010.pdf");
    expect(res.body.slice(0, 5).toString("utf8")).toBe("%PDF-");
  });

  it("returns PDF for an invoiced net-terms job", async () => {
    seedInvoiceFixtures({ paymentStatus: "invoiced" });
    const res = await request(makeApp()).get(`/jobs/${JOB_ID}/invoice`);
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/application\/pdf/);
  });

  it("returns PDF for the assigned hauling company", async () => {
    seedInvoiceFixtures();
    h.profile = { id: PROVIDER_ID, role: "provider" };
    const res = await request(makeApp()).get(`/jobs/${JOB_ID}/invoice`);
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/application\/pdf/);
  });

  it("returns PDF for staff admins", async () => {
    seedInvoiceFixtures();
    h.profile = { id: OUTSIDER_ID, role: "provider" };
    h.isAdminResult = true;
    const res = await request(makeApp()).get(`/jobs/${JOB_ID}/invoice`);
    expect(res.status).toBe(200);
  });

  it("returns 403 for unauthorized users", async () => {
    seedInvoiceFixtures();
    h.profile = { id: OUTSIDER_ID, role: "customer" };
    const res = await request(makeApp()).get(`/jobs/${JOB_ID}/invoice`);
    expect(res.status).toBe(403);
  });

  it("returns 409 before completion approval", async () => {
    seedInvoiceFixtures({ completionApproval: "pending" });
    const res = await request(makeApp()).get(`/jobs/${JOB_ID}/invoice`);
    expect(res.status).toBe(409);
  });

  it("returns 400 when the job is not completed or invoiced", async () => {
    seedInvoiceFixtures({ status: "in_progress", paymentStatus: "unpaid" });
    const res = await request(makeApp()).get(`/jobs/${JOB_ID}/invoice`);
    expect(res.status).toBe(400);
  });

  it("returns 404 for a missing job", async () => {
    h.rows.set(jobsTable, []);
    const res = await request(makeApp()).get(`/jobs/${JOB_ID}/invoice`);
    expect(res.status).toBe(404);
  });
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
