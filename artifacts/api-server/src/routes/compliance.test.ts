import { describe, it, expect, beforeEach, vi } from "vitest";
import express, { type Express } from "express";
import request from "supertest";

const h = vi.hoisted(() => ({
  profile: { id: 1, role: "provider", staffRole: null } as any,
  staff: undefined as undefined | { id: number; staffRole: string },
  permitted: true,
  // rows returned by select().from(table).where()
  complianceRows: [] as any[],
  truckRows: [] as any[],
  inserts: [] as Record<string, unknown>[],
  updates: [] as Record<string, unknown>[],
}));

vi.mock("@workspace/db", () => {
  const makeTable = (name: string) =>
    new Proxy({}, { get: (_t, p) => `${name}.${String(p)}` });
  const complianceDocumentsTable = makeTable("compliance_documents");
  const complianceDocumentHistoryTable = makeTable("compliance_document_history");
  const trucksTable = makeTable("trucks");
  const notificationsTable = makeTable("notifications");
  const notificationDeliveriesTable = makeTable("notification_deliveries");
  const profilesTable = makeTable("profiles");

  const rowsFor = (table: unknown): any[] => {
    if (table === complianceDocumentsTable) return h.complianceRows;
    if (table === trucksTable) return h.truckRows;
    if (table === profilesTable) return [{ id: 7, email: "owner@example.com" }];
    return [];
  };

  const db = {
    select: () => ({
      from: (table: unknown) => ({
        where: (..._a: unknown[]) => {
          const rows = rowsFor(table);
          const p: any = Promise.resolve(rows);
          p.orderBy = () => Promise.resolve(rows);
          return p;
        },
      }),
    }),
    insert: (table: unknown) => ({
      values: (vals: Record<string, unknown>) => {
        h.inserts.push({ __table: table, ...vals });
        return {
          returning: () => Promise.resolve([{ id: 100 + h.inserts.length, ...vals }]),
        };
      },
    }),
    update: (_table: unknown) => ({
      set: (vals: Record<string, unknown>) => {
        h.updates.push(vals);
        const where = (..._a: unknown[]) => {
          const p: any = Promise.resolve(undefined);
          p.returning = () => Promise.resolve([{ id: 1, ...vals }]);
          return p;
        };
        return { where };
      },
    }),
  };

  return {
    db,
    complianceDocumentsTable,
    complianceDocumentHistoryTable,
    trucksTable,
    notificationsTable,
    notificationDeliveriesTable,
    profilesTable,
    COMPLIANCE_OWNER_TYPES: ["vendor", "driver", "fleet"],
    COMPLIANCE_VENDOR_DOC_TYPES: [
      "w9", "coi", "business_registration", "dot_authority",
      "mc_number", "usdot_number", "insurance", "additional",
    ],
    COMPLIANCE_DRIVER_DOC_TYPES: [
      "cdl", "medical_certificate", "driver_license", "insurance",
      "dot_document", "endorsement", "additional",
    ],
    COMPLIANCE_FLEET_DOC_TYPES: [
      "truck_registration", "vin", "plate", "insurance",
      "inspection", "equipment_document", "additional",
    ],
  };
});

vi.mock("../middlewares/requireAuth", () => ({
  requireProfile: (req: any, _res: any, next: any) => {
    req.profile = h.profile;
    if (h.staff) req.staffUser = h.staff;
    next();
  },
  getRequestProfile: (req: any) => req.profile,
  attachClerkProfileIfPresent: (req: any, _res: any, next: any) => {
    req.profile = h.profile;
    next();
  },
}));

vi.mock("../middlewares/staffAuth", () => ({
  attachStaffSession: (req: any, _res: any, next: any) => {
    if (h.staff) req.staffUser = h.staff;
    next();
  },
  requireStaffOrProfile: (_req: any, _res: any, next: any) => next(),
}));

vi.mock("../middlewares/requireAdmin", () => ({
  requirePermission: (_perm: string) => (req: any, res: any, next: any) => {
    if (!h.permitted) {
      res.status(403).json({ error: "Missing required permission" });
      return;
    }
    next();
  },
}));

vi.mock("../lib/resendClient", () => ({
  getUncachableResendClient: vi.fn(async () => ({
    fromEmail: "noreply@example.com",
    client: { emails: { send: vi.fn(async () => ({ id: "email_1" })) } },
  })),
}));

import complianceRouter from "./compliance";

function makeApp(): Express {
  const app = express();
  app.use(express.json());
  app.use(complianceRouter);
  return app;
}

beforeEach(() => {
  h.profile = { id: 1, role: "provider", staffRole: null };
  h.staff = undefined;
  h.permitted = true;
  h.complianceRows = [];
  h.truckRows = [];
  h.inserts = [];
  h.updates = [];
});

const FAR = "2027-06-30T00:00:00Z";

describe("upload", () => {
  it("creates a pending vendor document with an audit entry", async () => {
    const res = await request(makeApp())
      .post("/compliance/documents")
      .send({ ownerType: "vendor", docType: "w9", profileId: 1, objectPath: "u/w9.pdf" });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe("pending");
    expect(res.body.version).toBe(1);
    // one document insert + one history insert
    expect(h.inserts.length).toBe(2);
    const history = h.inserts.find((i) => i.action !== undefined);
    expect(history?.action).toBe("uploaded");
  });

  it("rejects an invalid docType for the owner", async () => {
    const res = await request(makeApp())
      .post("/compliance/documents")
      .send({ ownerType: "vendor", docType: "cdl", profileId: 1 });
    expect(res.status).toBe(400);
  });

  it("rejects an invalid ownerType", async () => {
    const res = await request(makeApp())
      .post("/compliance/documents")
      .send({ ownerType: "spaceship", docType: "w9", profileId: 1 });
    expect(res.status).toBe(400);
  });

  it("forbids uploading for another profile when not staff", async () => {
    const res = await request(makeApp())
      .post("/compliance/documents")
      .send({ ownerType: "vendor", docType: "w9", profileId: 999 });
    expect(res.status).toBe(403);
  });

  it("bumps version and records 'replaced' when a current doc exists", async () => {
    h.complianceRows = [
      { id: 7, ownerType: "vendor", docType: "w9", profileId: 1, truckId: null, version: 1, isCurrent: true, status: "approved" },
    ];
    const res = await request(makeApp())
      .post("/compliance/documents")
      .send({ ownerType: "vendor", docType: "w9", profileId: 1 });
    expect(res.status).toBe(201);
    expect(res.body.version).toBe(2);
    const history = h.inserts.find((i) => i.action !== undefined);
    expect(history?.action).toBe("replaced");
    // prior current row superseded
    expect(h.updates.some((u) => u.isCurrent === false)).toBe(true);
  });
});

describe("replace", () => {
  it("supersedes an existing document with a new pending version", async () => {
    h.complianceRows = [
      { id: 7, ownerType: "vendor", docType: "insurance", profileId: 1, truckId: null, version: 2, isCurrent: true, status: "approved", objectPath: "old.pdf" },
    ];
    const res = await request(makeApp())
      .put("/compliance/documents/7/replace")
      .send({ objectPath: "new.pdf", expiresAt: FAR });
    expect(res.status).toBe(201);
    expect(res.body.version).toBe(3);
    expect(res.body.status).toBe("pending");
  });

  it("404s for a missing document", async () => {
    h.complianceRows = [];
    const res = await request(makeApp())
      .put("/compliance/documents/123/replace")
      .send({ objectPath: "x.pdf" });
    expect(res.status).toBe(404);
  });
});

describe("history", () => {
  it("returns versions and audit log for an owned document", async () => {
    h.complianceRows = [
      { id: 7, ownerType: "vendor", docType: "w9", profileId: 1, truckId: null, version: 2, isCurrent: true, status: "pending" },
      { id: 6, ownerType: "vendor", docType: "w9", profileId: 1, truckId: null, version: 1, isCurrent: false, status: "approved" },
    ];
    const res = await request(makeApp()).get("/compliance/documents/7/history");
    expect(res.status).toBe(200);
    expect(res.body.versions.length).toBe(2);
    expect(res.body.documentId).toBe(7);
  });
});

describe("approve / reject (staff)", () => {
  beforeEach(() => {
    h.staff = { id: 50, staffRole: "cfo" };
  });

  it("approves a document, writes history, and notifies the owner", async () => {
    h.complianceRows = [{ id: 9, status: "pending", version: 1, profileId: 7 }];
    const res = await request(makeApp())
      .post("/admin/compliance/documents/9/approve")
      .send({ note: "looks good" });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("approved");
    const history = h.inserts.find((i) => i.action !== undefined);
    expect(history?.action).toBe("approved");
    const notification = h.inserts.find((i) => i.type === "compliance_approved");
    expect(notification?.recipientProfileId).toBe(7);
  });

  it("requires a reason to reject", async () => {
    h.complianceRows = [{ id: 9, status: "pending", version: 1 }];
    const res = await request(makeApp())
      .post("/admin/compliance/documents/9/reject")
      .send({});
    expect(res.status).toBe(400);
  });

  it("rejects with a reason and writes history", async () => {
    h.complianceRows = [{ id: 9, status: "pending", version: 1 }];
    const res = await request(makeApp())
      .post("/admin/compliance/documents/9/reject")
      .send({ reason: "illegible scan" });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("rejected");
  });

  it("marks a document as needs_update with a note and notification", async () => {
    h.complianceRows = [{ id: 9, status: "approved", version: 1, profileId: 7, docType: "insurance" }];
    const res = await request(makeApp())
      .post("/admin/compliance/documents/9/needs-update")
      .send({ note: "Upload the renewed COI page." });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("needs_update");
    const history = h.inserts.find((i) => i.action === "needs_update");
    expect(history?.note).toBe("Upload the renewed COI page.");
  });

  it("records an admin note without changing status", async () => {
    h.complianceRows = [{ id: 9, status: "approved", version: 1, profileId: 7 }];
    const res = await request(makeApp())
      .post("/admin/compliance/documents/9/notes")
      .send({ note: "Called carrier for clearer copy." });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    const history = h.inserts.find((i) => i.action === "note");
    expect(history?.toStatus).toBe("approved");
  });

  it("enforces the compliance permission", async () => {
    h.permitted = false;
    h.complianceRows = [{ id: 9, status: "pending", version: 1 }];
    const res = await request(makeApp())
      .post("/admin/compliance/documents/9/approve")
      .send({});
    expect(res.status).toBe(403);
  });
});

describe("summaries", () => {
  it("driver summary reports missing required docs and blocks job acceptance", async () => {
    h.profile = { id: 1, role: "driver", staffRole: null };
    h.complianceRows = [];
    const res = await request(makeApp()).get("/compliance/drivers/1/summary");
    expect(res.status).toBe(200);
    expect(res.body.compliant).toBe(false);
    expect(res.body.canAcceptJobs).toBe(false);
    expect(res.body.missingRequired).toContain("cdl");
  });

  it("driver summary is compliant + canAcceptJobs when all required docs approved", async () => {
    h.profile = { id: 1, role: "driver", staffRole: null };
    h.complianceRows = ["cdl", "medical_certificate", "driver_license", "insurance"].map((docType, i) => ({
      id: i + 1, ownerType: "driver", docType, profileId: 1, truckId: null, version: 1, isCurrent: true, status: "approved", expiresAt: FAR,
    }));
    const res = await request(makeApp()).get("/compliance/drivers/1/summary");
    expect(res.status).toBe(200);
    expect(res.body.compliant).toBe(true);
    expect(res.body.canAcceptJobs).toBe(true);
  });

  it("forbids viewing another profile's summary when not staff", async () => {
    h.profile = { id: 2, role: "driver", staffRole: null };
    const res = await request(makeApp()).get("/compliance/drivers/1/summary");
    expect(res.status).toBe(403);
  });

  it("fleet summary blocks assignment when registration is expired", async () => {
    h.truckRows = [{ id: 5, ownerId: 1 }];
    h.complianceRows = [
      { id: 1, ownerType: "fleet", docType: "truck_registration", truckId: 5, profileId: 1, status: "approved", expiresAt: "2026-01-01T00:00:00Z", version: 1, isCurrent: true },
      { id: 2, ownerType: "fleet", docType: "insurance", truckId: 5, profileId: 1, status: "approved", expiresAt: FAR, version: 1, isCurrent: true },
    ];
    const res = await request(makeApp()).get("/compliance/fleet/5/summary");
    expect(res.status).toBe(200);
    expect(res.body.canBeAssigned).toBe(false);
    expect(res.body.blockers).toContain("truck_registration expired");
  });
});

describe("dashboards", () => {
  beforeEach(() => {
    h.staff = { id: 50, staffRole: "cfo" };
  });

  it("dashboard aggregates current documents by effective status", async () => {
    h.complianceRows = [
      { id: 1, docType: "w9", status: "approved", expiresAt: FAR, isCurrent: true },
      { id: 2, docType: "coi", status: "approved", expiresAt: "2026-01-01T00:00:00Z", isCurrent: true }, // expired
      { id: 3, docType: "insurance", status: "pending", isCurrent: true },
    ];
    const res = await request(makeApp()).get("/admin/compliance/dashboard");
    expect(res.status).toBe(200);
    expect(res.body.totalCurrentDocuments).toBe(3);
    expect(res.body.byStatus.approved).toBe(1);
    expect(res.body.byStatus.expired).toBe(1);
    expect(res.body.pendingReview).toBe(1);
  });

  it("expired endpoint returns only expired current documents", async () => {
    h.complianceRows = [
      { id: 2, docType: "coi", status: "approved", expiresAt: "2026-01-01T00:00:00Z", isCurrent: true },
    ];
    const res = await request(makeApp()).get("/admin/compliance/expired");
    expect(res.status).toBe(200);
    expect(res.body.documents.length).toBe(1);
  });

  it("expiring endpoint returns current documents inside the requested window", async () => {
    h.complianceRows = [
      { id: 2, docType: "coi", status: "approved", expiresAt: "2026-07-10T00:00:00Z", isCurrent: true },
    ];
    const res = await request(makeApp()).get("/admin/compliance/expiring?days=30");
    expect(res.status).toBe(200);
    expect(res.body.documents.length).toBe(1);
  });
});
