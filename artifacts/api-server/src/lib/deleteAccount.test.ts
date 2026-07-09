import { beforeEach, describe, expect, it, vi } from "vitest";

const selectChain = {
  from: vi.fn(),
  where: vi.fn(),
};

const tx = {
  delete: vi.fn(),
  update: vi.fn(),
  select: vi.fn(),
};

const db = {
  select: vi.fn(),
  transaction: vi.fn(),
};

vi.mock("@workspace/db", () => ({
  db,
  profilesTable: { id: "id", clerkId: "clerkId", organizationId: "organizationId", orgRole: "orgRole" },
  deviceTokensTable: { profileId: "profileId" },
  activityTable: { profileId: "profileId" },
  w9SubmissionsTable: { profileId: "profileId" },
  insuranceSubmissionsTable: { profileId: "profileId" },
  paymentMethodsTable: { profileId: "profileId" },
  payoutAccountsTable: { profileId: "profileId" },
  creditApplicationsTable: { profileId: "profileId" },
  dotCdlTable: { profileId: "profileId" },
  driverDocumentsTable: { profileId: "profileId" },
  quickbooksConnectionsTable: { profileId: "profileId" },
  uploadSessionsTable: { profileId: "profileId" },
  bidsTable: { providerId: "providerId" },
  trucksTable: { ownerId: "ownerId" },
  projectAssignmentsTable: {
    supervisorProfileId: "supervisorProfileId",
    assignedByProfileId: "assignedByProfileId",
  },
  organizationsTable: { id: "id", ownerProfileId: "ownerProfileId", name: "name" },
}));

vi.mock("drizzle-orm", () => ({
  eq: (...args: unknown[]) => ({ eq: args }),
  and: (...args: unknown[]) => ({ and: args }),
  or: (...args: unknown[]) => ({ or: args }),
  sql: (...args: unknown[]) => ({ sql: args }),
}));

describe("deleteAccountForClerkUser", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.CLERK_SECRET_KEY = "sk_test_delete";
    global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => "" }) as any;

    const whereSelect = vi.fn().mockResolvedValue([
      {
        id: 42,
        clerkId: "user_abc",
        organizationId: null,
        orgRole: null,
      },
    ]);
    db.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: whereSelect,
      }),
    });

    const deleteWhere = vi.fn().mockResolvedValue(undefined);
    tx.delete.mockReturnValue({ where: deleteWhere });
    const updateSet = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
    tx.update.mockReturnValue({ set: updateSet });
    tx.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    });

    db.transaction.mockImplementation(async (fn: (t: typeof tx) => Promise<void>) => fn(tx));
  });

  it("anonymizes the profile and deletes the Clerk user", async () => {
    const { deleteAccountForClerkUser } = await import("./deleteAccount.js");
    const result = await deleteAccountForClerkUser("user_abc");

    expect(result).toEqual({ deleted: true, profileId: 42, clerkDeleted: true });
    expect(tx.update).toHaveBeenCalled();
    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.clerk.com/v1/users/user_abc",
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("still deletes Clerk when no profile exists", async () => {
    db.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    });

    const { deleteAccountForClerkUser } = await import("./deleteAccount.js");
    const result = await deleteAccountForClerkUser("user_orphan");

    expect(result).toEqual({ deleted: true, profileId: null, clerkDeleted: true });
    expect(db.transaction).not.toHaveBeenCalled();
    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.clerk.com/v1/users/user_orphan",
      expect.objectContaining({ method: "DELETE" }),
    );
  });
});
