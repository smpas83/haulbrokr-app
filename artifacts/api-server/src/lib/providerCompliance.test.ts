import { describe, it, expect } from "vitest";
import { computeProviderCanBid, hasPendingComplianceReview } from "./providerCompliance";

describe("computeProviderCanBid", () => {
  const base = {
    role: "provider",
    w9Status: "verified",
    insuranceStatus: "verified",
    dotCdlStatus: "verified",
    payoutStatus: "pending",
  };

  it("is true when all required artifacts are verified and payout is on file", () => {
    expect(computeProviderCanBid(base)).toBe(true);
  });

  it("is false when W-9 is pending", () => {
    expect(computeProviderCanBid({ ...base, w9Status: "pending" })).toBe(false);
  });

  it("is false when insurance is pending", () => {
    expect(computeProviderCanBid({ ...base, insuranceStatus: "pending" })).toBe(false);
  });

  it("is false when DOT/CDL is not verified", () => {
    expect(computeProviderCanBid({ ...base, dotCdlStatus: "pending" })).toBe(false);
  });

  it("is false when payout has not been submitted", () => {
    expect(computeProviderCanBid({ ...base, payoutStatus: "not_submitted" })).toBe(false);
  });

  it("is false for non-provider roles", () => {
    expect(computeProviderCanBid({ ...base, role: "customer" })).toBe(false);
  });
});

describe("hasPendingComplianceReview", () => {
  it("detects pending form submissions and uploaded docs awaiting review", () => {
    expect(hasPendingComplianceReview({
      w9Status: "verified",
      insuranceStatus: "pending",
      dotCdlStatus: "verified",
      uploadedDocs: [{ status: "verified" }],
    })).toBe(true);

    expect(hasPendingComplianceReview({
      w9Status: "verified",
      insuranceStatus: "verified",
      dotCdlStatus: "verified",
      uploadedDocs: [{ status: "uploaded" }],
    })).toBe(true);

    expect(hasPendingComplianceReview({
      w9Status: "verified",
      insuranceStatus: "verified",
      dotCdlStatus: "verified",
      uploadedDocs: [],
    })).toBe(false);
  });
});
