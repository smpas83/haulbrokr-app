import { describe, expect, it } from "vitest";

import type { Job } from "@workspace/api-client-react";

import {
  applyDriverJobFilters,
  categorizeDriverJob,
  computeDriverPay,
  redactJobForDriver,
} from "@/lib/driverJobView";

const baseJob: Job = {
  id: 1,
  requestId: 1,
  bidId: 1,
  customerId: 10,
  customerCompany: "Acme Construction",
  providerId: 20,
  providerCompany: "Haul Co",
  ratePerHour: 120,
  trucksAssigned: 2,
  status: "accepted",
  materialType: "gravel",
  truckType: "end_dump",
  pickupAddress: "123 Quarry Rd",
  deliveryAddress: "456 Site Ln",
  scheduledDate: new Date("2026-07-05"),
  startTime: "07:00",
  estimatedHours: 8,
  customerTotalAmount: 1104,
  platformFeeAmount: 144,
  platformFeeRate: 0.15,
  providerNetAmount: 960,
  totalAmount: 960,
  notes: "Internal broker note — do not show driver",
  createdAt: new Date("2026-07-01"),
};

describe("driverJobView redaction", () => {
  it("removes customer and broker pricing fields from driver view", () => {
    const safe = redactJobForDriver(baseJob);
    expect(safe.driverPay).toBe(960);
    expect("customerTotalAmount" in safe).toBe(false);
    expect("platformFeeAmount" in safe).toBe(false);
    expect("platformFeeRate" in safe).toBe(false);
    expect("totalAmount" in safe).toBe(false);
    expect("notes" in safe).toBe(false);
  });

  it("computes driver pay from rate and hours when net amount missing", () => {
    const pay = computeDriverPay({ ...baseJob, providerNetAmount: null, estimatedHours: 5 });
    expect(pay).toBe(600);
  });
});

describe("driverJobView categorization", () => {
  const assigned = new Set([1, 2, 3, 4]);

  it("places unassigned active jobs in available", () => {
    expect(categorizeDriverJob({ ...baseJob, id: 99, status: "active" }, assigned)).toBe("available");
  });

  it("places assigned accepted jobs in accepted", () => {
    expect(categorizeDriverJob({ ...baseJob, id: 1, status: "accepted" }, assigned)).toBe("accepted");
  });

  it("places assigned in_progress jobs in in_progress", () => {
    expect(categorizeDriverJob({ ...baseJob, id: 2, status: "in_progress" }, assigned)).toBe("in_progress");
  });

  it("places assigned completed jobs in completed", () => {
    expect(categorizeDriverJob({ ...baseJob, id: 3, status: "completed" }, assigned)).toBe("completed");
  });
});

describe("driverJobView filters", () => {
  it("filters by material and pay range", () => {
    const jobs = [
      redactJobForDriver(baseJob),
      redactJobForDriver({ ...baseJob, id: 2, materialType: "sand", providerNetAmount: 200 }),
    ];
    const filtered = applyDriverJobFilters(jobs, { material: "gravel", minPay: 500 });
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.id).toBe(1);
  });
});
