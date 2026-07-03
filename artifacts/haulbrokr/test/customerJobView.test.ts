import { describe, it, expect } from "vitest";
import {
  isActiveJob,
  isToday,
  redactJobForCustomer,
  countOpenInvoices,
  countTrucksEnRoute,
  computeOnTimePercent,
} from "@/lib/customerJobView";
import type { Job } from "@workspace/api-client-react";

const baseJob: Job = {
  id: 1,
  requestId: 10,
  bidId: 5,
  customerId: 100,
  customerCompany: "Acme Corp",
  providerId: 200,
  providerCompany: "Fast Haul LLC",
  ratePerHour: 150,
  trucksAssigned: 3,
  status: "in_progress",
  materialType: "gravel",
  truckType: "end_dump",
  pickupAddress: "123 Quarry Rd",
  deliveryAddress: "456 Site Ln",
  scheduledDate: new Date().toISOString(),
  startTime: "08:00",
  estimatedHours: 8,
  customerTotalAmount: 2400,
  providerNetAmount: 2000,
  platformFeeAmount: 400,
  paymentStatus: "invoiced",
  invoicedAt: new Date().toISOString(),
  createdAt: new Date().toISOString(),
};

describe("customerJobView", () => {
  it("identifies active job statuses", () => {
    expect(isActiveJob({ ...baseJob, status: "in_progress" })).toBe(true);
    expect(isActiveJob({ ...baseJob, status: "completed" })).toBe(false);
  });

  it("redacts pricing fields from customer job cards", () => {
    const view = redactJobForCustomer(baseJob);
    expect(view.id).toBe(1);
    expect(view.driverLabel).toBe("Fast Haul LLC");
    expect(view).not.toHaveProperty("ratePerHour");
    expect(view).not.toHaveProperty("customerTotalAmount");
    expect(view).not.toHaveProperty("providerNetAmount");
  });

  it("counts open invoices from job payment state", () => {
    const jobs = [
      { ...baseJob, id: 1, invoicedAt: new Date().toISOString(), paymentStatus: "invoiced" as const },
      { ...baseJob, id: 2, invoicedAt: new Date().toISOString(), paymentStatus: "paid" as const },
      { ...baseJob, id: 3, invoicedAt: null, paymentStatus: "pending" as const },
    ];
    expect(countOpenInvoices(jobs)).toBe(1);
  });

  it("sums trucks en route from active jobs", () => {
    const jobs = [
      { ...baseJob, id: 1, status: "in_progress" as const, trucksAssigned: 2 },
      { ...baseJob, id: 2, status: "completed" as const, trucksAssigned: 5 },
      { ...baseJob, id: 3, status: "active" as const, trucksAssigned: 1 },
    ];
    expect(countTrucksEnRoute(jobs)).toBe(3);
  });

  it("returns dash for on-time percent when no completed jobs", () => {
    expect(computeOnTimePercent([{ ...baseJob, status: "in_progress" }])).toBe("—");
  });

  it("detects today from ISO date strings", () => {
    expect(isToday(new Date().toISOString())).toBe(true);
    expect(isToday("2020-01-01T00:00:00.000Z")).toBe(false);
  });
});
