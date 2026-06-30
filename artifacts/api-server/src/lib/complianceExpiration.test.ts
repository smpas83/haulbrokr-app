import { describe, it, expect, beforeEach, vi } from "vitest";

const h = vi.hoisted(() => ({
  docs: [] as any[],
  inserts: [] as Record<string, unknown>[],
  updates: [] as Record<string, unknown>[],
}));

vi.mock("@workspace/db", () => {
  const makeTable = (name: string) =>
    new Proxy({}, { get: (_t, p) => `${name}.${String(p)}` });
  const complianceDocumentsTable = makeTable("compliance_documents");
  const complianceDocumentHistoryTable = makeTable("compliance_document_history");
  const notificationsTable = makeTable("notifications");
  const notificationDeliveriesTable = makeTable("notification_deliveries");
  const profilesTable = makeTable("profiles");

  const db = {
    select: () => ({
      from: (table: unknown) => ({
        where: () => {
          if (table === complianceDocumentsTable) return Promise.resolve(h.docs);
          if (table === profilesTable) return Promise.resolve([{ id: 7, email: "ops@example.com" }]);
          return Promise.resolve([]);
        },
      }),
    }),
    update: () => ({
      set: (vals: Record<string, unknown>) => {
        h.updates.push(vals);
        return {
          where: () => ({
            returning: () => Promise.resolve([{ id: h.docs[0]?.id ?? 1, ...vals }]),
          }),
        };
      },
    }),
    insert: (table: unknown) => ({
      values: (vals: Record<string, unknown>) => {
        h.inserts.push({ __table: table, ...vals });
        return {
          returning: () => Promise.resolve([{ id: 500 + h.inserts.length, ...vals }]),
        };
      },
    }),
  };

  return {
    db,
    complianceDocumentsTable,
    complianceDocumentHistoryTable,
    notificationsTable,
    notificationDeliveriesTable,
    profilesTable,
  };
});

vi.mock("./resendClient", () => ({
  getUncachableResendClient: vi.fn(async () => ({
    fromEmail: "noreply@example.com",
    client: { emails: { send: vi.fn(async () => ({ id: "email_1" })) } },
  })),
}));

import { sweepExpiredComplianceDocuments } from "./complianceExpiration";

beforeEach(() => {
  h.docs = [];
  h.inserts = [];
  h.updates = [];
});

describe("sweepExpiredComplianceDocuments", () => {
  it("persists expired status, writes audit history, and notifies the owner", async () => {
    h.docs = [{
      id: 9,
      ownerType: "driver",
      docType: "cdl",
      profileId: 7,
      status: "approved",
      version: 2,
      isCurrent: true,
      expiresAt: new Date("2026-01-01T00:00:00Z"),
    }];

    const result = await sweepExpiredComplianceDocuments(new Date("2026-06-30T00:00:00Z"));

    expect(result).toEqual({ checked: 1, expired: 1 });
    expect(h.updates.some((u) => u.status === "expired")).toBe(true);
    expect(h.inserts.some((i) => i.action === "expired")).toBe(true);
    expect(h.inserts.some((i) => i.type === "compliance_expired")).toBe(true);
  });
});
