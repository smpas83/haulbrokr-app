import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  profile: null as null | Record<string, unknown>,
  members: [] as Array<{ id: number; orgRole: string | null }>,
  selectCount: 0,
  inserts: [] as unknown[],
  updates: [] as unknown[],
  deletes: 0,
}));

vi.mock("@workspace/db", () => {
  const makeTable = (name: string) => new Proxy({}, { get: (_t, p) => `${name}.${String(p)}` });
  const db: any = {
    select: () => ({
      from: () => ({
        where: () => {
          h.selectCount += 1;
          // Odd selects → profile (or empty); even → members list for org checks
          if (h.selectCount % 2 === 1) {
            return Promise.resolve(h.profile ? [h.profile] : []);
          }
          return Promise.resolve(h.members);
        },
      }),
    }),
    insert: () => ({
      values: (v: unknown) => {
        h.inserts.push(v);
        return { returning: () => Promise.resolve([{ id: 1, ...(v as object) }]) };
      },
    }),
    update: () => ({
      set: (v: unknown) => {
        h.updates.push(v);
        return {
          where: () => ({
            returning: () => Promise.resolve([{ id: (h.profile as any)?.id ?? 1, ...(v as object) }]),
          }),
        };
      },
    }),
    delete: () => ({
      where: () => {
        h.deletes += 1;
        return Promise.resolve();
      },
    }),
    transaction: async (fn: (tx: typeof db) => Promise<void>) => {
      await fn(db);
    },
  };
  return {
    db,
    activityTable: makeTable("activity"),
    accountDeletionAuditTable: makeTable("accountDeletionAudit"),
    accountDeletionRequestsTable: makeTable("accountDeletionRequests"),
    bidsTable: makeTable("bids"),
    creditApplicationsTable: makeTable("creditApplications"),
    dataExportRequestsTable: makeTable("dataExports"),
    deviceTokensTable: makeTable("deviceTokens"),
    dotCdlTable: makeTable("dotCdl"),
    driverDocumentsTable: makeTable("driverDocs"),
    insuranceSubmissionsTable: makeTable("insurance"),
    organizationsTable: makeTable("orgs"),
    paymentMethodsTable: makeTable("payment"),
    payoutAccountsTable: makeTable("payout"),
    profilesTable: makeTable("profiles"),
    projectAssignmentsTable: makeTable("assignments"),
    quickbooksConnectionsTable: makeTable("qb"),
    recurringSchedulesTable: makeTable("recurring"),
    trucksTable: makeTable("trucks"),
    uploadSessionsTable: makeTable("uploads"),
    w9SubmissionsTable: makeTable("w9"),
  };
});

vi.mock("./logger", () => ({ logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() } }));

import { deleteAccountForClerkUser, previewAccountDeletion } from "./deleteAccount";

describe("account deletion", () => {
  beforeEach(() => {
    h.profile = {
      id: 10,
      clerkId: "user_abc",
      organizationId: 5,
      orgRole: "member",
    };
    h.members = [];
    h.selectCount = 0;
    h.inserts = [];
    h.updates = [];
    h.deletes = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, status: 200, text: async () => "" })),
    );
    process.env.CLERK_SECRET_KEY = "sk_test_delete";
  });

  it("blocks sole owners when other members exist without another owner", async () => {
    h.profile = { id: 10, clerkId: "user_abc", organizationId: 5, orgRole: "owner" };
    h.members = [{ id: 11, orgRole: "member" }];
    const preview = await previewAccountDeletion(10);
    expect(preview.organization.requiresOwnershipTransfer).toBe(true);
    expect(preview.blockedReason).toMatch(/Transfer ownership/i);
    h.selectCount = 0;
    await expect(deleteAccountForClerkUser("user_abc")).rejects.toMatchObject({
      code: "OWNERSHIP_TRANSFER_REQUIRED",
    });
  });

  it("allows owner deletion when another owner already exists", async () => {
    h.profile = { id: 10, clerkId: "user_abc", organizationId: 5, orgRole: "owner" };
    h.members = [{ id: 11, orgRole: "owner" }];
    const preview = await previewAccountDeletion(10);
    expect(preview.organization.requiresOwnershipTransfer).toBe(false);
  });

  it("dry-run does not call Clerk", async () => {
    h.profile = { id: 10, clerkId: "user_abc", organizationId: null, orgRole: null };
    const result = await deleteAccountForClerkUser("user_abc", { dryRun: true });
    expect(result.deleted).toBe(true);
    expect(result.clerkDeleted).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("anonymizes profile, removes tokens, and deletes Clerk identity", async () => {
    h.profile = { id: 10, clerkId: "user_abc", organizationId: null, orgRole: null };
    const result = await deleteAccountForClerkUser("user_abc");
    expect(result.deleted).toBe(true);
    expect(result.clerkDeleted).toBe(true);
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/users/user_abc"),
      expect.objectContaining({ method: "DELETE" }),
    );
    expect(h.deletes).toBeGreaterThan(0);
    expect(h.updates.some((u) => (u as any).companyName === "Deleted Account")).toBe(true);
    expect(h.updates.some((u) => String((u as any).clerkId ?? "").startsWith("deleted_"))).toBe(true);
    expect(h.inserts.length).toBeGreaterThan(0);
  });
});
