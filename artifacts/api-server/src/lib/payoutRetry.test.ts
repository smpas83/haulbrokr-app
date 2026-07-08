import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Shared, mutable test state for the (hoisted) `vi.mock` factories. Each test
 * tweaks the Stripe + readiness behaviour, then inspects what was recorded.
 */
const h = vi.hoisted(() => ({
  /** PaymentIntent returned by stripe.paymentIntents.retrieve(...). */
  pi: { id: "pi_1", status: "succeeded", latest_charge: "ch_1" } as any,
  /** Result of checkProviderPayoutReadiness(...). */
  readiness: { ok: true, stripeAccountId: "acct_1", message: "" } as any,
  /** When set, transfers.create throws this error. */
  transferError: null as Error | null,
  /** Recorded args of transfers.create: [params, options]. */
  transferCalls: [] as any[],
  /** Recorded payloads passed to db.update().set(...). */
  updates: [] as Record<string, unknown>[],
  /** Recorded payloads passed to db.insert().values(...) (flattened). */
  inserts: [] as Record<string, unknown>[],
  /** Rows returned by db.select()...where(...) (admin/provider profile lookups). */
  profileRows: [] as Record<string, unknown>[],
  /** Recorded args of resend.emails.send(...). */
  emailCalls: [] as any[],
  /** When set, getUncachableResendClient throws (e.g. Resend not connected). */
  resendError: null as Error | null,
  /** When set, emails.send resolves with this { error } payload. */
  emailSendError: null as any,
}));

vi.mock("@workspace/db", () => {
  const makeTable = (name: string) =>
    new Proxy({}, { get: (_t, p) => `${name}.${String(p)}` });
  const db = {
    update: () => ({
      set: (vals: Record<string, unknown>) => {
        h.updates.push(vals);
        return {
          where: () => ({
            returning: () => Promise.resolve([{ id: 1, ...vals }]),
          }),
        };
      },
    }),
    insert: () => ({
      values: (vals: any) => {
        h.inserts.push(...(Array.isArray(vals) ? vals : [vals]));
        return Promise.resolve(undefined);
      },
    }),
    select: () => ({
      from: () => ({ where: () => Promise.resolve(h.profileRows) }),
    }),
  };
  return {
    db,
    jobsTable: makeTable("jobs"),
    profilesTable: makeTable("profiles"),
    activityTable: makeTable("activity"),
  };
});

vi.mock("drizzle-orm", async (importActual) => {
  const actual = await importActual<Record<string, unknown>>();
  return { ...actual, inArray: () => "inArray" };
});

vi.mock("./stripeClient", () => ({
  getUncachableStripeClient: async () => ({
    paymentIntents: { retrieve: async () => h.pi },
    transfers: {
      create: async (params: any, options: any) => {
        h.transferCalls.push([params, options]);
        if (h.transferError) throw h.transferError;
        return { id: "tr_1" };
      },
    },
  }),
}));

vi.mock("./payoutStatus", () => ({
  checkProviderPayoutReadiness: async () => h.readiness,
}));

vi.mock("./resendClient", () => ({
  getUncachableResendClient: async () => {
    if (h.resendError) throw h.resendError;
    return {
      fromEmail: "alerts@haulbrokr.test",
      client: {
        emails: {
          send: async (payload: any) => {
            h.emailCalls.push(payload);
            return { data: null, error: h.emailSendError };
          },
        },
      },
    };
  },
}));

vi.mock("./logger", () => ({
  logger: { info: () => {}, error: () => {}, warn: () => {} },
}));

import { retryStuckPayout, settleConfirmedPayout } from "./payoutRetry";

const stuckJob = {
  id: 7,
  paymentStatus: "requires_action",
  stripePaymentIntentId: "pi_1",
  providerNetAmount: "850.00",
  providerId: 3,
  paymentAttempts: 2,
};

beforeEach(() => {
  h.pi = { id: "pi_1", status: "succeeded", latest_charge: "ch_1" };
  h.readiness = { ok: true, stripeAccountId: "acct_1", message: "" };
  h.transferError = null;
  h.transferCalls = [];
  h.updates = [];
  h.inserts = [];
  h.profileRows = [];
  h.emailCalls = [];
  h.resendError = null;
  h.emailSendError = null;
  delete process.env.ADMIN_USER_IDS;
});

describe("settleConfirmedPayout", () => {
  it("transfers the net amount and marks the job released without re-charging", async () => {
    await settleConfirmedPayout(
      { id: 7, providerNetAmount: "850.00", paymentAttempts: 2 },
      "acct_1",
      { id: "pi_1", latest_charge: "ch_1" },
    );

    const [params, options] = h.transferCalls[0];
    expect(params.amount).toBe(85000);
    expect(params.destination).toBe("acct_1");
    expect(params.source_transaction).toBe("ch_1");
    // Attempt is UNCHANGED — same idempotency key Stripe would dedupe against.
    expect(options.idempotencyKey).toBe("job-transfer:7:2");
    expect(h.updates[0]).toMatchObject({
      paymentStatus: "released",
      stripeTransferId: "tr_1",
    });
  });
});

describe("retryStuckPayout", () => {
  it("releases a stuck payout via the transfer leg only", async () => {
    const result = await retryStuckPayout({ ...stuckJob });
    expect(result).toMatchObject({ jobId: 7, outcome: "released" });
    expect(h.transferCalls).toHaveLength(1);
    expect(h.transferCalls[0][1].idempotencyKey).toBe("job-transfer:7:2");
    expect(h.updates[0]).toMatchObject({ paymentStatus: "released" });
  });

  it("skips jobs that are not awaiting a payout release", async () => {
    const result = await retryStuckPayout({
      ...stuckJob,
      paymentStatus: "released",
    });
    expect(result.outcome).toBe("skipped");
    expect(h.transferCalls).toHaveLength(0);
  });

  it("skips when the customer charge has not succeeded (never transfers)", async () => {
    h.pi = { id: "pi_1", status: "requires_action", latest_charge: null };
    const result = await retryStuckPayout({ ...stuckJob });
    expect(result.outcome).toBe("skipped");
    expect(h.transferCalls).toHaveLength(0);
  });

  it("skips when the provider is not ready to receive payouts", async () => {
    h.readiness = { ok: false, message: "Provider payouts are disabled." };
    const result = await retryStuckPayout({ ...stuckJob });
    expect(result.outcome).toBe("skipped");
    expect(result.message).toBe("Provider payouts are disabled.");
    expect(h.transferCalls).toHaveLength(0);
  });

  it("returns failed (never re-charges, never marks failed) when the transfer errors", async () => {
    h.transferError = new Error("transfer boom");
    const result = await retryStuckPayout({ ...stuckJob });
    expect(result.outcome).toBe("failed");
    expect(result.message).toBe("transfer boom");
    // It records the failure count but NEVER touches paymentStatus — the job
    // stays in `requires_action` and is never routed back through /charge.
    expect(h.updates).toHaveLength(1);
    expect(h.updates[0]).toMatchObject({ payoutRetryFailures: 1 });
    expect(h.updates[0]).not.toHaveProperty("paymentStatus");
  });

  it("does not alert admins before the failure threshold is reached", async () => {
    process.env.ADMIN_USER_IDS = "admin_clerk_1";
    h.transferError = new Error("transfer boom");
    // Second consecutive failure (still below ALERT_AFTER_FAILURES = 3).
    await retryStuckPayout({ ...stuckJob, payoutRetryFailures: 1 });
    expect(h.updates[0]).toMatchObject({ payoutRetryFailures: 2 });
    expect(h.updates[0]).not.toHaveProperty("payoutAlertSentAt");
    expect(h.inserts).toHaveLength(0);
  });

  it("alerts every admin once the failure threshold is crossed", async () => {
    process.env.ADMIN_USER_IDS = "admin_clerk_1, admin_clerk_2";
    h.transferError = new Error("transfer boom");
    // profileRows backs BOTH the admin lookup and the provider lookup; the admins
    // are returned first, the provider second (only its companyName is read).
    h.profileRows = [
      {
        id: 10,
        clerkId: "admin_clerk_1",
        companyName: "Admin One",
        email: "one@admin.test",
      },
      {
        id: 11,
        clerkId: "admin_clerk_2",
        companyName: "Admin Two",
        email: "two@admin.test",
      },
    ];
    const result = await retryStuckPayout({
      ...stuckJob,
      materialType: "Concrete",
      payoutRetryFailures: 2, // this attempt makes it the 3rd in a row
    });
    expect(result.outcome).toBe("failed");
    expect(h.updates[0]).toMatchObject({ payoutRetryFailures: 3 });
    expect(h.updates[0].payoutAlertSentAt).toBeInstanceOf(Date);
    // One activity row per admin, carrying job id, provider, and the reason.
    expect(h.inserts).toHaveLength(2);
    expect(h.inserts.map((i) => i.profileId).sort()).toEqual([10, 11]);
    for (const row of h.inserts) {
      expect(row).toMatchObject({ type: "payout_stuck_alert", relatedId: 7 });
      expect(row.description).toContain("#7");
      expect(row.description).toContain("transfer boom");
    }
    // A single email goes to every admin with an address, carrying job id,
    // provider, failure count, and the latest error.
    expect(h.emailCalls).toHaveLength(1);
    const email = h.emailCalls[0];
    expect(email.from).toBe("alerts@haulbrokr.test");
    expect(email.to.sort()).toEqual(["one@admin.test", "two@admin.test"]);
    expect(email.subject).toContain("#7");
    expect(email.subject).toContain("3");
    // providerName resolves from the provider profile lookup (first row here).
    expect(email.text).toContain("Admin One");
    expect(email.text).toContain("#7");
    expect(email.text).toContain("transfer boom");
    expect(email.text).toContain("3");
  });

  it("emails only admins that have an address on file", async () => {
    process.env.ADMIN_USER_IDS = "admin_clerk_1, admin_clerk_2";
    h.transferError = new Error("transfer boom");
    h.profileRows = [
      {
        id: 10,
        clerkId: "admin_clerk_1",
        companyName: "Admin One",
        email: "one@admin.test",
      },
      {
        id: 11,
        clerkId: "admin_clerk_2",
        companyName: "Admin Two",
        email: null,
      },
    ];
    await retryStuckPayout({ ...stuckJob, payoutRetryFailures: 2 });
    // In-app alert still reaches both admins; email only the one with an address.
    expect(h.inserts).toHaveLength(2);
    expect(h.emailCalls).toHaveLength(1);
    expect(h.emailCalls[0].to).toEqual(["one@admin.test"]);
  });

  it("does not email when no admin has an address (in-app alert still fires)", async () => {
    process.env.ADMIN_USER_IDS = "admin_clerk_1";
    h.transferError = new Error("transfer boom");
    h.profileRows = [
      {
        id: 10,
        clerkId: "admin_clerk_1",
        companyName: "Admin One",
        email: null,
      },
    ];
    await retryStuckPayout({ ...stuckJob, payoutRetryFailures: 2 });
    expect(h.inserts).toHaveLength(1);
    expect(h.emailCalls).toHaveLength(0);
  });

  it("still records the in-app alert when the email provider is unavailable", async () => {
    process.env.ADMIN_USER_IDS = "admin_clerk_1";
    h.transferError = new Error("transfer boom");
    h.resendError = new Error("Resend not connected");
    h.profileRows = [
      {
        id: 10,
        clerkId: "admin_clerk_1",
        companyName: "Admin One",
        email: "one@admin.test",
      },
    ];
    const result = await retryStuckPayout({
      ...stuckJob,
      payoutRetryFailures: 2,
    });
    // A mail-provider failure must never break the sweep or the in-app alert.
    expect(result.outcome).toBe("failed");
    expect(h.inserts).toHaveLength(1);
    expect(h.updates[0].payoutAlertSentAt).toBeInstanceOf(Date);
  });

  it("does not re-email once an alert has already been sent for the job", async () => {
    process.env.ADMIN_USER_IDS = "admin_clerk_1";
    h.transferError = new Error("transfer boom");
    h.profileRows = [
      {
        id: 10,
        clerkId: "admin_clerk_1",
        companyName: "Admin One",
        email: "one@admin.test",
      },
    ];
    await retryStuckPayout({
      ...stuckJob,
      payoutRetryFailures: 5,
      payoutAlertSentAt: new Date("2026-06-16T00:00:00.000Z"),
    });
    // Already alerted → neither a duplicate in-app row nor a duplicate email.
    expect(h.inserts).toHaveLength(0);
    expect(h.emailCalls).toHaveLength(0);
  });

  it("does not re-alert once an alert has already been sent for the job", async () => {
    process.env.ADMIN_USER_IDS = "admin_clerk_1";
    h.transferError = new Error("transfer boom");
    h.profileRows = [
      { id: 10, clerkId: "admin_clerk_1", companyName: "Admin One" },
    ];
    await retryStuckPayout({
      ...stuckJob,
      payoutRetryFailures: 5,
      payoutAlertSentAt: new Date("2026-06-16T00:00:00.000Z"),
    });
    // Counter keeps climbing, but no duplicate alert and no new timestamp.
    expect(h.updates[0]).toMatchObject({ payoutRetryFailures: 6 });
    expect(h.updates[0]).not.toHaveProperty("payoutAlertSentAt");
    expect(h.inserts).toHaveLength(0);
  });

  it("does not alert when no admins are configured", async () => {
    h.transferError = new Error("transfer boom");
    await retryStuckPayout({ ...stuckJob, payoutRetryFailures: 2 });
    expect(h.updates[0]).toMatchObject({ payoutRetryFailures: 3 });
    // Threshold crossed → timestamp set, but with no ADMIN_USER_IDS nothing is sent.
    expect(h.updates[0].payoutAlertSentAt).toBeInstanceOf(Date);
    expect(h.inserts).toHaveLength(0);
  });
});
