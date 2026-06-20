import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Shared, mutable test state. Declared via `vi.hoisted` so the (hoisted)
 * `vi.mock` factories below can reference it.
 */
const h = vi.hoisted(() => ({
  /** Rows returned by `db.select().from(table).where()`, keyed by table token. */
  rows: new Map<unknown, unknown[]>(),
  /** Stand-in for `stripe.accounts.retrieve`. */
  stripeRetrieve: vi.fn(),
}));

vi.mock("@workspace/db", () => {
  const makeTable = (name: string) =>
    new Proxy({}, { get: (_t, p) => `${name}.${String(p)}` });
  const payoutAccountsTable = makeTable("payoutAccounts");
  const db = {
    select: () => ({
      from: (table: unknown) => ({
        where: () => Promise.resolve(h.rows.get(table) ?? []),
      }),
    }),
    update: () => ({
      set: () => ({ where: () => Promise.resolve(undefined) }),
    }),
  };
  return { db, payoutAccountsTable };
});

vi.mock("./stripeClient", () => ({
  getUncachableStripeClient: vi.fn(async () => ({
    accounts: { retrieve: h.stripeRetrieve },
  })),
}));

import {
  checkProviderPayoutReadiness,
  PAYOUTS_NOT_CONNECTED_MSG,
  PAYOUTS_NOT_ENABLED_MSG,
} from "./payoutStatus";
import { payoutAccountsTable } from "@workspace/db";

const PROVIDER_ID = 42;

function setPayoutRow(row: Record<string, unknown> | null) {
  if (row) h.rows.set(payoutAccountsTable, [row]);
  else h.rows.set(payoutAccountsTable, []);
}

beforeEach(() => {
  h.rows.clear();
  h.stripeRetrieve.mockReset();
});

describe("checkProviderPayoutReadiness", () => {
  it("blocks a provider who never connected a Stripe account", async () => {
    setPayoutRow(null);

    const result = await checkProviderPayoutReadiness(PROVIDER_ID);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("not_connected");
      expect(result.message).toBe(PAYOUTS_NOT_CONNECTED_MSG);
    }
    // Never reaches Stripe — there is no account to look up.
    expect(h.stripeRetrieve).not.toHaveBeenCalled();
  });

  it("blocks a connected provider whose payouts are not enabled", async () => {
    setPayoutRow({ stripeAccountId: "acct_123", payoutsEnabled: 0 });
    h.stripeRetrieve.mockResolvedValue({
      payouts_enabled: false,
      charges_enabled: true,
      details_submitted: true,
    });

    const result = await checkProviderPayoutReadiness(PROVIDER_ID);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("not_enabled");
      expect(result.message).toBe(PAYOUTS_NOT_ENABLED_MSG);
    }
  });

  it("allows a provider whose live Stripe account has payouts enabled", async () => {
    // Stored flag is stale (0) but live Stripe says enabled — live wins.
    setPayoutRow({ stripeAccountId: "acct_live", payoutsEnabled: 0 });
    h.stripeRetrieve.mockResolvedValue({
      payouts_enabled: true,
      charges_enabled: true,
      details_submitted: true,
    });

    const result = await checkProviderPayoutReadiness(PROVIDER_ID);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.stripeAccountId).toBe("acct_live");
    }
  });

  describe("Stripe unreachable — falls back to the last stored flag", () => {
    it("allows when the stored flag says payouts were enabled", async () => {
      setPayoutRow({ stripeAccountId: "acct_cached_ok", payoutsEnabled: 1 });
      h.stripeRetrieve.mockRejectedValue(new Error("Stripe down"));

      const result = await checkProviderPayoutReadiness(PROVIDER_ID);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.stripeAccountId).toBe("acct_cached_ok");
      }
    });

    it("blocks when the stored flag says payouts were not enabled", async () => {
      setPayoutRow({ stripeAccountId: "acct_cached_no", payoutsEnabled: 0 });
      h.stripeRetrieve.mockRejectedValue(new Error("Stripe down"));

      const result = await checkProviderPayoutReadiness(PROVIDER_ID);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe("not_enabled");
        expect(result.message).toBe(PAYOUTS_NOT_ENABLED_MSG);
      }
    });
  });
});
