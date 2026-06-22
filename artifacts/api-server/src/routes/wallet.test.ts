import { describe, it, expect, beforeEach, vi } from "vitest";
import express, { type Express } from "express";
import request from "supertest";

const h = vi.hoisted(() => ({
  /** Rows returned by `db.select().from(table).where()`, keyed by table token. */
  rows: new Map<unknown, unknown[]>(),
  /** Profile injected by the mocked requireProfile middleware. */
  profile: { id: 2, role: "provider" } as Record<string, unknown>,
}));

vi.mock("@workspace/db", () => {
  const makeTable = (name: string) =>
    new Proxy({}, { get: (_t, p) => `${name}.${String(p)}` });
  const db = {
    select: () => ({
      from: (table: unknown) => ({
        where: () => Promise.resolve(h.rows.get(table) ?? []),
      }),
    }),
  };
  return {
    db,
    jobsTable: makeTable("jobs"),
    factoringRequestsTable: makeTable("factoring"),
    payoutAccountsTable: makeTable("payoutAccounts"),
  };
});

vi.mock("../middlewares/requireAuth", () => ({
  requireAuth: (_req: any, _res: any, next: any) => next(),
  requireProfile: (req: any, _res: any, next: any) => {
    req.profile = h.profile;
    next();
  },
  getRequestProfile: (req: any) => req.profile,
}));

import walletRouter from "./wallet";
import { jobsTable, factoringRequestsTable, payoutAccountsTable } from "@workspace/db";

const PROVIDER_ID = 2;

function makeApp(): Express {
  const app = express();
  app.use(express.json());
  app.use(walletRouter);
  return app;
}

function baseJob(overrides: Record<string, unknown> = {}) {
  return {
    id: 10,
    providerId: PROVIDER_ID,
    status: "completed",
    materialType: "gravel",
    paymentStatus: "released",
    providerNetAmount: "100.00",
    completedAt: new Date("2026-06-01T00:00:00Z"),
    createdAt: new Date("2026-05-01T00:00:00Z"),
    ...overrides,
  };
}

beforeEach(() => {
  h.rows.clear();
  h.profile = { id: PROVIDER_ID, role: "provider" };
});

describe("GET /wallet", () => {
  it("returns correct balances for a provider with paid + pending jobs", async () => {
    h.rows.set(jobsTable, [
      baseJob({ id: 10, paymentStatus: "released", providerNetAmount: "100.00", completedAt: new Date("2026-06-03T00:00:00Z") }),
      baseJob({ id: 11, paymentStatus: "invoiced", providerNetAmount: "50.00", completedAt: new Date("2026-06-02T00:00:00Z") }),
    ]);
    h.rows.set(factoringRequestsTable, [
      { id: 1, jobId: 10, netAmount: "97.00", status: "approved", requestedAt: new Date("2026-06-04T00:00:00Z"), createdAt: new Date("2026-06-04T00:00:00Z") },
    ]);
    h.rows.set(payoutAccountsTable, [
      { stripeAccountId: "acct_1", payoutsEnabled: 1, accountLast4: "4821" },
    ]);

    const res = await request(makeApp()).get("/wallet");

    expect(res.status).toBe(200);
    expect(res.body.availableBalance).toBe(100);
    expect(res.body.pendingBalance).toBe(50);
    expect(res.body.lifetimeEarnings).toBe(150);

    expect(res.body.payoutAccount).toEqual({
      connected: true,
      payoutsEnabled: true,
      bankLast4: "4821",
    });

    // 2 earnings + 1 factoring, ordered by createdAt desc (factoring is newest).
    expect(res.body.transactions).toHaveLength(3);
    expect(res.body.transactions[0].type).toBe("factoring");
    expect(res.body.transactions[0].amount).toBe(97);
    const types = res.body.transactions.map((t: any) => t.type);
    expect(types.filter((t: string) => t === "earning")).toHaveLength(2);
  });

  it("returns a zeroed wallet for a provider with no jobs or payout account", async () => {
    const res = await request(makeApp()).get("/wallet");

    expect(res.status).toBe(200);
    expect(res.body.availableBalance).toBe(0);
    expect(res.body.pendingBalance).toBe(0);
    expect(res.body.lifetimeEarnings).toBe(0);
    expect(res.body.payoutAccount).toEqual({
      connected: false,
      payoutsEnabled: false,
      bankLast4: null,
    });
    expect(res.body.transactions).toEqual([]);
  });

  it("rejects a customer with 403", async () => {
    h.profile = { id: 1, role: "customer" };

    const res = await request(makeApp()).get("/wallet");

    expect(res.status).toBe(403);
  });
});
