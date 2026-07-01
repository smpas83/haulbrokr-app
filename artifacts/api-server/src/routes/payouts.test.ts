import { beforeEach, describe, expect, it, vi } from "vitest";
import express, { type Express } from "express";
import request from "supertest";

const h = vi.hoisted(() => ({
  profile: { id: 42, role: "provider", email: "driver@example.com" } as Record<string, unknown>,
  payoutRows: [] as Record<string, unknown>[],
  insertedRows: [] as Record<string, unknown>[],
  updatedRows: [] as Record<string, unknown>[],
  createdAccounts: [] as Record<string, unknown>[],
  createdLinks: [] as Record<string, unknown>[],
}));

vi.mock("../middlewares/requireAuth", () => ({
  requireProfile: (req: any, _res: any, next: any) => {
    req.profile = { ...h.profile };
    next();
  },
  getRequestProfile: (req: any) => req.profile,
}));

vi.mock("@workspace/db", () => {
  const payoutAccountsTable = new Proxy({}, { get: (_t, p) => `payoutAccounts.${String(p)}` });
  const db = {
    select: () => ({
      from: () => ({
        where: () => Promise.resolve(h.payoutRows),
      }),
    }),
    insert: () => ({
      values: (vals: Record<string, unknown>) => {
        h.insertedRows.push(vals);
        return Promise.resolve(undefined);
      },
    }),
    update: () => ({
      set: (vals: Record<string, unknown>) => ({
        where: () => {
          h.updatedRows.push(vals);
          return Promise.resolve(undefined);
        },
      }),
    }),
  };
  return { db, payoutAccountsTable };
});

vi.mock("../lib/stripeClient", () => ({
  getUncachableStripeClient: vi.fn(async () => ({
    accounts: {
      create: vi.fn(async (payload: Record<string, unknown>, options: Record<string, unknown>) => {
        h.createdAccounts.push({ payload, options });
        return { id: "acct_new" };
      }),
    },
    accountLinks: {
      create: vi.fn(async (payload: Record<string, unknown>) => {
        h.createdLinks.push(payload);
        return { url: "https://connect.stripe.test/onboarding" };
      }),
    },
  })),
}));

import payoutsRouter from "./payouts";

function makeApp(): Express {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    req.log = { error: vi.fn(), warn: vi.fn(), info: vi.fn() };
    next();
  });
  app.use(payoutsRouter);
  return app;
}

beforeEach(() => {
  h.profile = { id: 42, role: "provider", email: "driver@example.com" };
  h.payoutRows = [];
  h.insertedRows = [];
  h.updatedRows = [];
  h.createdAccounts = [];
  h.createdLinks = [];
});

describe("POST /payouts/connect-link", () => {
  it("creates a Stripe Express account once and returns an onboarding URL", async () => {
    const res = await request(makeApp())
      .post("/payouts/connect-link")
      .set("Host", "api.haulbrokr.test")
      .set("X-Forwarded-Proto", "https")
      .send({ returnTo: "haulbrokr://wallet" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      url: "https://connect.stripe.test/onboarding",
      stripeAccountId: "acct_new",
    });
    expect(h.createdAccounts[0].payload).toMatchObject({
      type: "express",
      email: "driver@example.com",
      metadata: { profileId: "42" },
    });
    expect(h.createdAccounts[0].options).toMatchObject({
      idempotencyKey: "payouts:acct-create:42",
    });
    expect(h.insertedRows[0]).toMatchObject({ profileId: 42, stripeAccountId: "acct_new" });
    expect(h.createdLinks[0]).toMatchObject({
      account: "acct_new",
      type: "account_onboarding",
    });
    expect(h.createdLinks[0].return_url).toContain("returnTo=haulbrokr%3A%2F%2Fwallet");
  });

  it("reuses an existing Stripe account and drops unsafe return targets", async () => {
    h.payoutRows = [{ id: 7, profileId: 42, stripeAccountId: "acct_existing" }];

    const res = await request(makeApp())
      .post("/payouts/connect-link")
      .set("Host", "api.haulbrokr.test")
      .set("X-Forwarded-Proto", "https")
      .send({ returnTo: "https://evil.example/phish" });

    expect(res.status).toBe(200);
    expect(res.body.stripeAccountId).toBe("acct_existing");
    expect(h.createdAccounts).toHaveLength(0);
    expect(h.insertedRows).toHaveLength(0);
    expect(h.updatedRows).toHaveLength(0);
    expect(h.createdLinks[0].return_url).not.toContain("evil.example");
    expect(h.createdLinks[0].refresh_url).not.toContain("evil.example");
  });
});
