import { beforeEach, describe, expect, it, vi } from "vitest";
import { encryptSecret, resolveEncryptionKey } from "./appleTokenCrypto";

const ENC_KEY_HEX = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

type JobRow = Record<string, any>;
type AppleRow = Record<string, any>;

const h = vi.hoisted(() => {
  const state = {
    appleRows: [] as AppleRow[],
    deletionJobs: [] as JobRow[],
    profile: {
      id: 42,
      clerkId: "user_abc",
      organizationId: null as number | null,
      orgRole: null as string | null,
      companyName: "Acme",
    } as Record<string, any> | null,
    jobSeq: 1,
    appleSeq: 1,
  };

  return {
    state,
    reset() {
      state.appleRows = [];
      state.deletionJobs = [];
      state.jobSeq = 1;
      state.appleSeq = 1;
      state.profile = {
        id: 42,
        clerkId: "user_abc",
        organizationId: null,
        orgRole: null,
        companyName: "Acme",
      };
    },
  };
});

function thenable<T>(value: T, extra?: Record<string, unknown>) {
  const p = Promise.resolve(value);
  return Object.assign(p, extra ?? {});
}

vi.mock("@workspace/db", () => {
  const appleAuthTokensTable = { __name: "apple" };
  const accountDeletionJobsTable = { __name: "jobs" };
  const profilesTable = {
    id: "id",
    clerkId: "clerkId",
    organizationId: "organizationId",
    orgRole: "orgRole",
  };

  const isApple = (table: unknown) => table === appleAuthTokensTable;
  const isJobs = (table: unknown) => table === accountDeletionJobsTable;
  const isProfiles = (table: unknown) => table === profilesTable;

  const db = {
    select: () => ({
      from: (table: unknown) => ({
        where: (_clause?: unknown) => {
          let rows: unknown[] = [];
          if (isJobs(table)) {
            rows = h.state.deletionJobs.filter((j) => j.status !== "completed");
          } else if (isApple(table)) {
            rows = [...h.state.appleRows];
          } else if (isProfiles(table)) {
            rows = h.state.profile ? [h.state.profile] : [];
          }
          return thenable(rows, {
            limit: async (n: number) => rows.slice(0, n),
          });
        },
        limit: async (n: number) => {
          if (isJobs(table)) return h.state.deletionJobs.slice(0, n);
          return [];
        },
      }),
    }),
    insert: (table: unknown) => ({
      values: (vals: Record<string, unknown>) => ({
        returning: async () => {
          if (isJobs(table)) {
            const row = {
              id: h.state.jobSeq++,
              attemptCount: 0,
              appleRevokeStatus: "pending",
              status: "pending",
              nextAttemptAt: new Date(),
              lastError: null,
              completedAt: null,
              ...vals,
            };
            h.state.deletionJobs.push(row);
            return [row];
          }
          if (isApple(table)) {
            const row = { id: h.state.appleSeq++, status: "active", ...vals };
            h.state.appleRows.push(row);
            return [row];
          }
          return [{ ...vals }];
        },
      }),
    }),
    update: (table: unknown) => ({
      set: (vals: Record<string, unknown>) => ({
        where: (_clause?: unknown) => {
          if (isJobs(table)) {
            // Prefer the most recent open job; fall back to last row.
            const job =
              h.state.deletionJobs.find((j) => j.status !== "completed") ??
              h.state.deletionJobs[h.state.deletionJobs.length - 1];
            if (job) Object.assign(job, vals);
            return thenable(undefined, {
              returning: async () => [job],
            });
          }
          if (isApple(table)) {
            for (const row of h.state.appleRows) Object.assign(row, vals);
            return thenable(undefined);
          }
          if (isProfiles(table) && h.state.profile) {
            Object.assign(h.state.profile, vals);
          }
          return thenable(undefined);
        },
      }),
    }),
    delete: () => ({
      where: async () => undefined,
    }),
    transaction: async (fn: (tx: any) => Promise<void>) => {
      const tx = {
        delete: () => ({ where: async () => undefined }),
        update: () => ({
          set: () => ({
            where: async () => undefined,
          }),
        }),
        select: () => ({
          from: () => ({
            where: async () => [],
          }),
        }),
      };
      await fn(tx);
      if (h.state.profile && !String(h.state.profile.clerkId).startsWith("deleted_")) {
        h.state.profile = {
          ...h.state.profile,
          clerkId: `deleted_${h.state.profile.id}_test`,
          companyName: "Deleted Account",
          organizationId: null,
          orgRole: null,
        };
      }
    },
  };

  return {
    db,
    appleAuthTokensTable,
    accountDeletionJobsTable,
    profilesTable,
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
    trucksTable: { ownerId: "ownerId", assignedDriverId: "assignedDriverId" },
    projectAssignmentsTable: {
      supervisorProfileId: "supervisorProfileId",
      assignedByProfileId: "assignedByProfileId",
    },
    organizationsTable: { id: "id", ownerProfileId: "ownerProfileId", name: "name" },
  };
});

vi.mock("drizzle-orm", () => ({
  eq: (...args: unknown[]) => ({ eq: args }),
  and: (...args: unknown[]) => ({ and: args }),
  or: (...args: unknown[]) => ({ or: args }),
  ne: (...args: unknown[]) => ({ ne: args }),
  lte: (...args: unknown[]) => ({ lte: args }),
  sql: (...args: unknown[]) => ({ sql: args }),
}));

vi.mock("./appleAuth", async () => {
  const actual = await vi.importActual<typeof import("./appleAuth")>("./appleAuth");
  return {
    ...actual,
    isAppleAuthConfigured: vi.fn(() => true),
    revokeAppleToken: vi.fn(async () => undefined),
  };
});

vi.mock("./logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

describe("deleteAccountForClerkUser", () => {
  beforeEach(() => {
    vi.resetModules();
    h.reset();
    process.env.CLERK_SECRET_KEY = "sk_test_delete";
    process.env.APPLE_TOKEN_ENCRYPTION_KEY = ENC_KEY_HEX;
    global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => "" }) as any;
  });

  it("anonymizes the profile, revokes Apple tokens, and deletes the Clerk user", async () => {
    const key = resolveEncryptionKey(ENC_KEY_HEX);
    h.state.appleRows.push({
      id: 1,
      clerkId: "user_abc",
      profileId: 42,
      encryptedRefreshToken: encryptSecret("rft_live", key),
      status: "active",
    });

    const { deleteAccountForClerkUser } = await import("./deleteAccount.js");
    const { revokeAppleToken } = await import("./appleAuth.js");

    const result = await deleteAccountForClerkUser("user_abc");

    expect(result.deleted).toBe(true);
    expect(result.profileId).toBe(42);
    expect(result.clerkDeleted).toBe(true);
    expect(result.appleRevoked).toBe(true);
    expect(result.status).toBe("completed");
    expect(revokeAppleToken).toHaveBeenCalled();
    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.clerk.com/v1/users/user_abc",
      expect.objectContaining({ method: "DELETE" }),
    );
    expect(String(h.state.profile?.clerkId).startsWith("deleted_")).toBe(true);
  });

  it("still deletes Clerk when no profile exists", async () => {
    h.state.profile = null;

    const { deleteAccountForClerkUser } = await import("./deleteAccount.js");
    const result = await deleteAccountForClerkUser("user_orphan");

    expect(result.deleted).toBe(true);
    expect(result.profileId).toBeNull();
    expect(result.clerkDeleted).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.clerk.com/v1/users/user_orphan",
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("completes local deletion even when Apple revoke fails, leaving retryable job state", async () => {
    const key = resolveEncryptionKey(ENC_KEY_HEX);
    h.state.appleRows.push({
      id: 1,
      clerkId: "user_abc",
      profileId: 42,
      encryptedRefreshToken: encryptSecret("rft_live", key),
      status: "active",
    });

    const apple = await import("./appleAuth.js");
    vi.mocked(apple.revokeAppleToken).mockRejectedValueOnce(new Error("Apple down"));

    const { deleteAccountForClerkUser } = await import("./deleteAccount.js");
    const result = await deleteAccountForClerkUser("user_abc");

    expect(result.deleted).toBe(true);
    expect(result.clerkDeleted).toBe(true);
    expect(result.appleRevoked).toBe(false);
    expect(result.status).toBe("revoking_apple");
    expect(h.state.deletionJobs[0].appleRevokeStatus).toBe("failed");
  });
});
