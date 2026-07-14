import { beforeEach, describe, expect, it, vi } from "vitest";
import express, { type Express } from "express";
import request from "supertest";

const h = vi.hoisted(() => ({
  profile: { id: 10, clerkId: "user_1", role: "customer", organizationId: null, orgRole: null } as Record<string, unknown>,
  preview: {
    willDelete: ["Profile personal data"],
    mayRetain: ["Financial settlement records"],
    organization: { isOwner: false, organizationId: null, otherMemberCount: 0, requiresOwnershipTransfer: false },
    blockedReason: null as string | null,
  },
  exports: [] as any[],
  deleteResult: { deleted: true, clerkDeleted: true, deletionRequestId: 1, profileId: 10 },
}));

vi.mock("../middlewares/requireAuth", () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    req.clerkId = h.profile.clerkId;
    req.auth = { sessionClaims: { iat: Math.floor(Date.now() / 1000) } };
    next();
  },
  requireProfile: (req: any, _res: any, next: any) => {
    req.clerkId = h.profile.clerkId;
    req.profile = { ...h.profile };
    req.auth = { sessionClaims: { iat: Math.floor(Date.now() / 1000) } };
    next();
  },
  getRequestProfile: (req: any) => req.profile,
}));

vi.mock("../lib/deleteAccount", () => ({
  DELETION_CONFIRMATION_PHRASE: "DELETE",
  hashClerkId: (id: string) => `hash_${id}`,
  previewAccountDeletion: vi.fn(async () => h.preview),
  deleteAccountForClerkUser: vi.fn(async () => h.deleteResult),
  resumeAccountDeletion: vi.fn(async () => h.deleteResult),
}));

vi.mock("../lib/dataExport", () => ({
  requestDataExport: vi.fn(async (profileId: number) => ({
    id: 99,
    profileId,
    status: "requested",
    requestedAt: new Date().toISOString(),
  })),
  listDataExports: vi.fn(async (profileId: number) => h.exports.filter((e) => e.profileId === profileId)),
  getDataExportForProfile: vi.fn(async (id: number, profileId: number) =>
    h.exports.find((e) => e.id === id && e.profileId === profileId) ?? null,
  ),
  createSignedExportDownloadUrl: vi.fn(async (id: number, profileId: number) => {
    const row = h.exports.find((e) => e.id === id && e.profileId === profileId);
    if (!row) {
      const err = new Error("Export not found") as Error & { code?: string };
      err.code = "NOT_FOUND";
      throw err;
    }
    if (row.status !== "ready") {
      const err = new Error("Export is not ready") as Error & { code?: string };
      err.code = "NOT_READY";
      throw err;
    }
    return { url: `https://signed.example/export-${id}.zip`, expiresAt: new Date().toISOString() };
  }),
  processDataExport: vi.fn(),
}));

vi.mock("@workspace/db", () => {
  const makeTable = (name: string) => new Proxy({}, { get: (_t, p) => `${name}.${String(p)}` });
  return {
    db: {
      select: () => ({
        from: () => ({
          where: () => ({
            orderBy: () => ({
              limit: () => Promise.resolve([]),
            }),
          }),
        }),
      }),
      insert: () => ({
        values: (v: any) => ({
          returning: () => Promise.resolve([{ id: 7, ...v }]),
        }),
      }),
      update: () => ({
        set: () => ({
          where: () => Promise.resolve([]),
        }),
      }),
    },
    accountDeletionRequestsTable: makeTable("accountDeletionRequests"),
  };
});

vi.mock("../lib/logger", () => ({ logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() } }));

import accountPrivacyRouter from "./account-privacy";
import { createSignedExportDownloadUrl } from "../lib/dataExport";

function app(): Express {
  const a = express();
  a.use(express.json());
  a.use(accountPrivacyRouter);
  return a;
}

describe("account privacy routes", () => {
  beforeEach(() => {
    h.profile = { id: 10, clerkId: "user_1", role: "customer", organizationId: null, orgRole: null };
    h.preview.blockedReason = null;
    h.preview.organization.requiresOwnershipTransfer = false;
    h.exports = [
      { id: 1, profileId: 10, status: "ready" },
      { id: 2, profileId: 99, status: "ready" },
    ];
  });

  it("returns deletion preview", async () => {
    const res = await request(app()).get("/account/deletion/preview");
    expect(res.status).toBe(200);
    expect(res.body.willDelete.length).toBeGreaterThan(0);
    expect(res.body.mayRetain.length).toBeGreaterThan(0);
  });

  it("requires DELETE confirmation phrase", async () => {
    const res = await request(app()).post("/account/deletion").send({ confirmation: "please" });
    expect(res.status).toBe(400);
  });

  it("executes deletion with confirmation + recent auth", async () => {
    const res = await request(app())
      .post("/account/deletion")
      .set("X-Reauth-Confirmed", "1")
      .send({ confirmation: "DELETE" });
    expect(res.status).toBe(200);
    expect(res.body.deleted).toBe(true);
  });

  it("blocks owner deletion when transfer required", async () => {
    h.preview.blockedReason = "Transfer ownership first";
    h.preview.organization.requiresOwnershipTransfer = true;
    const res = await request(app())
      .post("/account/deletion")
      .set("X-Reauth-Confirmed", "1")
      .send({ confirmation: "DELETE" });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("OWNERSHIP_TRANSFER_REQUIRED");
  });

  it("requests export for authenticated user only", async () => {
    const res = await request(app()).post("/account/export").send({});
    expect([201, 202]).toContain(res.status);
    expect(res.body.profileId).toBe(10);
  });

  it("enforces export organization isolation on download", async () => {
    // Other org's export id 2 must 404 for profile 10
    const res = await request(app()).get("/account/export/2/download");
    expect(res.status).toBe(404);
    expect(createSignedExportDownloadUrl).toHaveBeenCalledWith(2, 10);

    const ok = await request(app()).get("/account/export/1/download");
    expect(ok.status).toBe(200);
    expect(ok.body.url).toContain("signed.example");
  });
});
