import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  rows: new Map<unknown, unknown[]>(),
  inserts: [] as Record<string, unknown>[],
  updates: [] as Record<string, unknown>[],
}));

vi.mock("@workspace/db", () => {
  const makeTable = (name: string) =>
    new Proxy({}, { get: (_t, p) => `${name}.${String(p)}` });
  const db = {
    select: () => ({
      from: (table: unknown) => ({
        where: () => Promise.resolve(h.rows.get(table) ?? []),
        then: (resolve: (rows: unknown[]) => unknown, reject?: (err: unknown) => unknown) =>
          Promise.resolve(h.rows.get(table) ?? []).then(resolve, reject),
      }),
    }),
    insert: (table: unknown) => ({
      values: (vals: Record<string, unknown>) => {
        h.inserts.push({ __table: table, ...vals });
        return Promise.resolve(undefined);
      },
    }),
    update: () => ({
      set: (vals: Record<string, unknown>) => {
        h.updates.push(vals);
        return { where: () => Promise.resolve(undefined) };
      },
    }),
  };
  return {
    db,
    complianceDocumentsTable: makeTable("complianceDocuments"),
    complianceDocumentVersionsTable: makeTable("complianceDocumentVersions"),
    complianceAuditLogsTable: makeTable("complianceAuditLogs"),
    complianceEventsTable: makeTable("complianceEvents"),
    profilesTable: makeTable("profiles"),
    trucksTable: makeTable("trucks"),
  };
});

vi.mock("../middlewares/requireAdmin", () => ({
  isAdmin: vi.fn(async () => false),
}));

import {
  buildComplianceSummary,
  driverCanAcceptJobs,
  expirationBucket,
  REQUIRED_DRIVER_DOCUMENTS,
} from "./complianceDocuments";
import { complianceDocumentsTable } from "@workspace/db";

function doc(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    entityType: "profile",
    profileId: 7,
    truckId: null,
    documentType: "cdl",
    status: "approved",
    expiresAt: new Date("2026-08-01T00:00:00Z"),
    objectPath: null,
    fileName: null,
    mimeType: null,
    documentNumber: null,
    issuingAuthority: null,
    rejectionReason: null,
    adminNotes: null,
    uploadedByProfileId: 7,
    reviewedByProfileId: null,
    uploadedAt: new Date("2026-06-01T00:00:00Z"),
    reviewedAt: null,
    createdAt: new Date("2026-06-01T00:00:00Z"),
    updatedAt: new Date("2026-06-01T00:00:00Z"),
    ...overrides,
  } as any;
}

beforeEach(() => {
  h.rows.clear();
  h.inserts = [];
  h.updates = [];
});

describe("compliance document utilities", () => {
  it("classifies expiration buckets", () => {
    const now = new Date("2026-06-30T00:00:00Z");
    expect(expirationBucket(new Date("2026-06-29T00:00:00Z"), now)).toBe("expired");
    expect(expirationBucket(new Date("2026-07-05T00:00:00Z"), now)).toBe("expiring_7");
    expect(expirationBucket(new Date("2026-07-12T00:00:00Z"), now)).toBe("expiring_14");
    expect(expirationBucket(new Date("2026-07-25T00:00:00Z"), now)).toBe("expiring_30");
    expect(expirationBucket(new Date("2026-09-01T00:00:00Z"), now)).toBe("valid");
  });

  it("builds summaries with missing and expired blockers", () => {
    const now = new Date("2026-06-30T00:00:00Z");
    const summary = buildComplianceSummary([
      doc({ documentType: "cdl", expiresAt: new Date("2026-06-01T00:00:00Z") }),
      doc({ documentType: "medical_certificate", status: "pending" }),
    ], REQUIRED_DRIVER_DOCUMENTS, now);

    expect(summary.compliant).toBe(false);
    expect(summary.missing).toContain("driver_license");
    expect(summary.statusCounts.expired).toBe(1);
    expect(summary.statusCounts.pending).toBe(1);
  });

  it("blocks drivers from accepting jobs with expired or missing required documents", async () => {
    h.rows.set(complianceDocumentsTable, [
      doc({ documentType: "cdl", expiresAt: new Date("2026-06-01T00:00:00Z") }),
      doc({ documentType: "medical_certificate" }),
      doc({ documentType: "driver_license" }),
      doc({ documentType: "insurance" }),
      doc({ documentType: "dot_document" }),
    ]);

    const result = await driverCanAcceptJobs(7, new Date("2026-06-30T00:00:00Z"));

    expect(result.ok).toBe(false);
    expect(result.blockers.some((blocker) => blocker.includes("cdl expired"))).toBe(true);
  });
});
