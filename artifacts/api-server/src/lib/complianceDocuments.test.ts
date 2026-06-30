import { describe, it, expect, vi } from "vitest";

// Keep these tests free of any DB/Pool by providing just the doc-type taxonomy
// that the module imports from @workspace/db.
vi.mock("@workspace/db", () => ({
  COMPLIANCE_VENDOR_DOC_TYPES: [
    "w9",
    "coi",
    "business_registration",
    "dot_authority",
    "mc_number",
    "usdot_number",
    "insurance",
    "additional",
  ],
  COMPLIANCE_DRIVER_DOC_TYPES: [
    "cdl",
    "medical_certificate",
    "driver_license",
    "insurance",
    "dot_document",
    "endorsement",
    "additional",
  ],
  COMPLIANCE_FLEET_DOC_TYPES: [
    "truck_registration",
    "vin",
    "plate",
    "insurance",
    "inspection",
    "equipment_document",
    "additional",
  ],
}));

import {
  effectiveStatus,
  isExpired,
  isExpiringWithin,
  summarizeCompliance,
  driverCanAcceptJobs,
  vendorCanReceiveDispatch,
  truckCanBeAssigned,
  expiredRequiredDocTypes,
  requiredDocTypesForOwner,
  isValidDocTypeForOwner,
  REQUIRED_DRIVER_DOC_TYPES,
} from "./complianceDocuments";
import type { ComplianceDocument } from "@workspace/db";

const NOW = new Date("2026-06-30T00:00:00Z");
const PAST = new Date("2026-01-01T00:00:00Z");
const SOON = new Date("2026-07-10T00:00:00Z"); // 10 days out
const FAR = new Date("2027-06-30T00:00:00Z");

let idSeq = 1;
function doc(overrides: Partial<ComplianceDocument>): ComplianceDocument {
  return {
    id: idSeq++,
    ownerType: "driver",
    profileId: 1,
    truckId: null,
    docType: "cdl",
    status: "approved",
    version: 1,
    isCurrent: true,
    objectPath: null,
    fileName: null,
    mimeType: null,
    docNumber: null,
    issuedAt: null,
    expiresAt: null,
    uploadedByProfileId: null,
    reviewedByProfileId: null,
    reviewedAt: null,
    reviewNote: null,
    rejectionReason: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  } as ComplianceDocument;
}

/** A full set of approved driver documents (all required types). */
function approvedDriverDocs(): ComplianceDocument[] {
  return REQUIRED_DRIVER_DOC_TYPES.map((docType) =>
    doc({ docType, status: "approved", expiresAt: FAR }),
  );
}

describe("effectiveStatus / expiration", () => {
  it("reports an approved-but-past-expiry document as expired", () => {
    expect(effectiveStatus(doc({ status: "approved", expiresAt: PAST }), NOW)).toBe("expired");
  });

  it("keeps an approved document with a future expiry approved", () => {
    expect(effectiveStatus(doc({ status: "approved", expiresAt: FAR }), NOW)).toBe("approved");
  });

  it("keeps an approved document with no expiry approved", () => {
    expect(effectiveStatus(doc({ status: "approved", expiresAt: null }), NOW)).toBe("approved");
  });

  it("does not override non-approved statuses based on expiry", () => {
    expect(effectiveStatus(doc({ status: "pending", expiresAt: PAST }), NOW)).toBe("pending");
    expect(effectiveStatus(doc({ status: "rejected", expiresAt: PAST }), NOW)).toBe("rejected");
  });

  it("isExpired and isExpiringWithin compute correctly", () => {
    expect(isExpired(doc({ expiresAt: PAST }), NOW)).toBe(true);
    expect(isExpired(doc({ expiresAt: FAR }), NOW)).toBe(false);
    expect(isExpired(doc({ expiresAt: null }), NOW)).toBe(false);
    expect(isExpiringWithin(doc({ expiresAt: SOON }), 30, NOW)).toBe(true);
    expect(isExpiringWithin(doc({ expiresAt: FAR }), 30, NOW)).toBe(false);
    expect(isExpiringWithin(doc({ expiresAt: PAST }), 30, NOW)).toBe(false);
  });
});

describe("summarizeCompliance", () => {
  it("flags all required docs as missing when none uploaded", () => {
    const summary = summarizeCompliance("driver", [], NOW);
    expect(summary.compliant).toBe(false);
    expect(summary.missingRequired.sort()).toEqual([...REQUIRED_DRIVER_DOC_TYPES].sort());
  });

  it("is compliant when every required doc is approved and unexpired", () => {
    const summary = summarizeCompliance("driver", approvedDriverDocs(), NOW);
    expect(summary.compliant).toBe(true);
    expect(summary.expiredRequired).toEqual([]);
    expect(summary.missingRequired).toEqual([]);
  });

  it("separates expired, pending, and rejected required docs", () => {
    const docs = [
      doc({ docType: "cdl", status: "approved", expiresAt: PAST }), // expired
      doc({ docType: "medical_certificate", status: "pending" }), // pending
      doc({ docType: "driver_license", status: "rejected" }), // rejected
      doc({ docType: "insurance", status: "approved", expiresAt: FAR }), // ok
    ];
    const summary = summarizeCompliance("driver", docs, NOW);
    expect(summary.expiredRequired).toEqual(["cdl"]);
    expect(summary.pendingRequired).toEqual(["medical_certificate"]);
    expect(summary.rejectedRequired).toEqual(["driver_license"]);
    expect(summary.compliant).toBe(false);
  });

  it("keeps the highest version when duplicate current rows exist", () => {
    const docs = [
      doc({ docType: "cdl", status: "rejected", version: 1, expiresAt: FAR }),
      doc({ docType: "cdl", status: "approved", version: 2, expiresAt: FAR }),
    ];
    const summary = summarizeCompliance("driver", docs, NOW);
    const cdl = summary.documents.find((d) => d.docType === "cdl");
    expect(cdl?.status).toBe("approved");
    expect(summary.rejectedRequired).not.toContain("cdl");
  });
});

describe("blocking rules", () => {
  it("driverCanAcceptJobs blocks when a required driver doc is expired", () => {
    const docs = approvedDriverDocs();
    docs[0] = doc({ docType: "cdl", status: "approved", expiresAt: PAST });
    const result = driverCanAcceptJobs(docs, NOW);
    expect(result.allowed).toBe(false);
    expect(result.blockers).toContain("cdl expired");
  });

  it("driverCanAcceptJobs allows a fully compliant driver", () => {
    expect(driverCanAcceptJobs(approvedDriverDocs(), NOW).allowed).toBe(true);
  });

  it("vendorCanReceiveDispatch requires all vendor required docs approved", () => {
    const result = vendorCanReceiveDispatch([], NOW);
    expect(result.allowed).toBe(false);
    expect(result.blockers.some((b) => b.includes("missing"))).toBe(true);
  });

  it("truckCanBeAssigned blocks an expired registration or insurance", () => {
    const docs = [
      doc({ ownerType: "fleet", docType: "truck_registration", status: "approved", expiresAt: PAST, truckId: 5 }),
      doc({ ownerType: "fleet", docType: "insurance", status: "approved", expiresAt: FAR, truckId: 5 }),
    ];
    const result = truckCanBeAssigned(docs, NOW);
    expect(result.allowed).toBe(false);
    expect(result.blockers).toContain("truck_registration expired");
  });

  it("truckCanBeAssigned allows when registration and insurance are approved and current", () => {
    const docs = [
      doc({ ownerType: "fleet", docType: "truck_registration", status: "approved", expiresAt: FAR, truckId: 5 }),
      doc({ ownerType: "fleet", docType: "insurance", status: "approved", expiresAt: FAR, truckId: 5 }),
    ];
    expect(truckCanBeAssigned(docs, NOW).allowed).toBe(true);
  });
});

describe("expiredRequiredDocTypes", () => {
  it("returns only required docs that are approved-but-expired", () => {
    const docs = [
      doc({ ownerType: "vendor", docType: "insurance", status: "approved", expiresAt: PAST }),
      doc({ ownerType: "vendor", docType: "w9", status: "pending" }), // pending, not expired
      doc({ ownerType: "vendor", docType: "coi", status: "approved", expiresAt: FAR }),
    ];
    expect(expiredRequiredDocTypes("vendor", docs, NOW)).toEqual(["insurance"]);
  });

  it("returns empty for an empty document set (initial compliance handled elsewhere)", () => {
    expect(expiredRequiredDocTypes("vendor", [], NOW)).toEqual([]);
  });
});

describe("doc-type taxonomy", () => {
  it("validates doc types per owner", () => {
    expect(isValidDocTypeForOwner("vendor", "w9")).toBe(true);
    expect(isValidDocTypeForOwner("vendor", "cdl")).toBe(false);
    expect(isValidDocTypeForOwner("driver", "cdl")).toBe(true);
    expect(isValidDocTypeForOwner("fleet", "truck_registration")).toBe(true);
  });

  it("exposes required doc types per owner", () => {
    expect(requiredDocTypesForOwner("fleet")).toContain("truck_registration");
    expect(requiredDocTypesForOwner("fleet")).toContain("insurance");
  });
});
