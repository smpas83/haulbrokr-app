import { beforeEach, describe, expect, it, vi } from "vitest";
import express, { type Express } from "express";
import request from "supertest";

const h = vi.hoisted(() => ({
  profile: { id: 1, role: "provider", orgRole: "owner", organizationId: 1 } as any,
  admin: false,
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
        return {
          returning: () => Promise.resolve([{ id: h.inserts.length, createdAt: new Date(), updatedAt: new Date(), ...vals }]),
        };
      },
    }),
    update: () => ({
      set: (vals: Record<string, unknown>) => {
        h.updates.push(vals);
        return {
          where: () => ({
            returning: () => Promise.resolve([{ id: 10, createdAt: new Date(), updatedAt: new Date(), ...vals }]),
          }),
        };
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

vi.mock("../middlewares/requireAuth", () => ({
  requireProfile: (req: any, _res: any, next: any) => {
    req.profile = h.profile;
    next();
  },
  getRequestProfile: (req: any) => req.profile,
}));

vi.mock("../middlewares/requireAdmin", () => ({
  isAdmin: vi.fn(async () => h.admin),
}));

import complianceRouter from "./compliance-documents";
import {
  complianceAuditLogsTable,
  complianceDocumentVersionsTable,
  complianceDocumentsTable,
  complianceEventsTable,
  trucksTable,
} from "@workspace/db";

function makeApp(): Express {
  const app = express();
  app.use(express.json());
  app.use(complianceRouter);
  return app;
}

function doc(overrides: Record<string, unknown> = {}) {
  return {
    id: 10,
    entityType: "profile",
    profileId: 1,
    truckId: null,
    documentType: "w9",
    status: "pending",
    objectPath: "old.pdf",
    fileName: "old.pdf",
    mimeType: "application/pdf",
    documentNumber: null,
    issuingAuthority: null,
    expiresAt: null,
    rejectionReason: null,
    adminNotes: null,
    uploadedByProfileId: 1,
    reviewedByProfileId: null,
    uploadedAt: new Date("2026-06-01T00:00:00Z"),
    reviewedAt: null,
    createdAt: new Date("2026-06-01T00:00:00Z"),
    updatedAt: new Date("2026-06-01T00:00:00Z"),
    ...overrides,
  } as any;
}

beforeEach(() => {
  h.profile = { id: 1, role: "provider", orgRole: "owner", organizationId: 1 };
  h.admin = false;
  h.rows.clear();
  h.inserts = [];
  h.updates = [];
  h.rows.set(complianceDocumentsTable, []);
  h.rows.set(complianceDocumentVersionsTable, []);
  h.rows.set(trucksTable, [{ id: 99, ownerId: 1, vin: "VIN", licensePlate: "ABC", make: "Mack", model: "Granite", year: 2022, isAvailable: true }]);
});

describe("compliance document routes", () => {
  it("allows providers to upload vendor document metadata and creates version/audit rows", async () => {
    const res = await request(makeApp()).post("/compliance/documents").send({
      entityType: "profile",
      documentType: "w9",
      objectPath: "docs/w9.pdf",
      fileName: "w9.pdf",
      mimeType: "application/pdf",
    });

    expect(res.status).toBe(201);
    expect(h.inserts[0]).toMatchObject({ profileId: 1, documentType: "w9", status: "pending" });
    expect(h.inserts.find((row) => row.__table === complianceDocumentVersionsTable)).toMatchObject({ documentId: 1, versionNumber: 1 });
    expect(h.inserts.find((row) => row.__table === complianceAuditLogsTable)).toMatchObject({ action: "uploaded" });
  });

  it("blocks customers from uploading compliance documents", async () => {
    h.profile = { id: 7, role: "customer", orgRole: "owner" };

    const res = await request(makeApp()).post("/compliance/documents").send({
      entityType: "profile",
      documentType: "w9",
    });

    expect(res.status).toBe(403);
  });

  it("supports document replacement with version history", async () => {
    h.rows.set(complianceDocumentsTable, [doc()]);

    const res = await request(makeApp()).patch("/compliance/documents/10/replace").send({
      objectPath: "new.pdf",
      fileName: "new.pdf",
      expiresAt: "2026-12-01T00:00:00.000Z",
    });

    expect(res.status).toBe(200);
    expect(h.updates[0]).toMatchObject({ objectPath: "new.pdf", status: "pending", rejectionReason: null });
    expect(h.inserts.find((row) => row.__table === complianceDocumentVersionsTable)).toBeTruthy();
  });

  it("allows admins to approve and reject documents and emits compliance events", async () => {
    h.admin = true;
    h.profile = { id: 9, role: "provider", staffRole: "cto" };
    h.rows.set(complianceDocumentsTable, [doc()]);

    let res = await request(makeApp()).post("/compliance/documents/10/approve").send({ notes: "ok" });
    expect(res.status).toBe(200);
    expect(h.updates[0]).toMatchObject({ status: "approved", reviewedByProfileId: 9 });
    expect(h.inserts.find((row) => row.__table === complianceEventsTable)).toMatchObject({ eventType: "document_approved" });

    h.rows.set(complianceDocumentsTable, [doc()]);
    res = await request(makeApp()).post("/compliance/documents/10/reject").send({ reason: "bad image" });
    expect(res.status).toBe(200);
    expect(h.updates.at(-1)).toMatchObject({ status: "rejected", rejectionReason: "bad image" });
    expect(h.inserts.find((row) => row.__table === complianceEventsTable && row.eventType === "document_rejected")).toBeTruthy();
  });

  it("returns fleet compliance summary for only owned trucks", async () => {
    h.rows.set(complianceDocumentsTable, [
      doc({ entityType: "truck", profileId: null, truckId: 99, documentType: "truck_registration", status: "approved" }),
    ]);

    const res = await request(makeApp()).get("/compliance/fleet/summary");

    expect(res.status).toBe(200);
    expect(res.body.trucks).toHaveLength(1);
    expect(res.body.trucks[0].compliance.missing).toContain("truck_insurance");
  });

  it("returns admin dashboard, expiring, and expired document counts", async () => {
    h.admin = true;
    h.profile = { id: 9, role: "provider", staffRole: "cto" };
    h.rows.set(complianceDocumentsTable, [
      doc({ status: "pending" }),
      doc({ id: 11, status: "approved", expiresAt: new Date(Date.now() - 1000) }),
      doc({ id: 12, status: "approved", expiresAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000) }),
    ]);

    const dashboard = await request(makeApp()).get("/admin/compliance/dashboard");
    expect(dashboard.status).toBe(200);
    expect(dashboard.body.expired).toBe(1);
    expect(dashboard.body.expiring30).toBe(1);

    const expired = await request(makeApp()).get("/admin/compliance/expired");
    expect(expired.body.documents).toHaveLength(1);
  });
});
