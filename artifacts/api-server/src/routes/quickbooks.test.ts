import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import express, { type Express } from "express";
import request from "supertest";

const h = vi.hoisted(() => ({
  profile: { id: 7, role: "provider", companyName: "Haul Co" } as Record<string, unknown>,
  connections: [] as Record<string, unknown>[],
  writes: 0,
}));

vi.mock("@workspace/db", () => {
  const makeTable = (name: string) =>
    new Proxy({}, { get: (_t, p) => `${name}.${String(p)}` });
  const quickbooksConnectionsTable = makeTable("quickbooks_connections");
  const jobsTable = makeTable("jobs");
  const db = {
    select: () => ({
      from: (table: unknown) => ({
        where: () => Promise.resolve(table === quickbooksConnectionsTable ? h.connections : []),
      }),
    }),
    insert: () => ({
      values: (row: Record<string, unknown>) => {
        h.writes += 1;
        const created = { id: 1, ...row, invoicesSynced: 0, lastSyncedAt: null };
        h.connections.push(created);
        return { returning: () => Promise.resolve([created]) };
      },
    }),
    update: () => ({
      set: (vals: Record<string, unknown>) => ({
        where: () => ({
          returning: () => {
            h.writes += 1;
            const updated = { ...(h.connections[0] ?? {}), ...vals };
            h.connections[0] = updated;
            return Promise.resolve([updated]);
          },
        }),
      }),
    }),
  };
  return { db, quickbooksConnectionsTable, jobsTable };
});

vi.mock("../middlewares/requireAuth", () => ({
  requireProfile: (req: any, _res: any, next: any) => {
    req.profile = { ...h.profile };
    next();
  },
  getRequestProfile: (req: any) => req.profile,
}));

import quickbooksRouter from "./quickbooks";

const originalNodeEnv = process.env.NODE_ENV;
const originalClientId = process.env.QUICKBOOKS_CLIENT_ID;
const originalClientSecret = process.env.QUICKBOOKS_CLIENT_SECRET;

function makeApp(): Express {
  const app = express();
  app.use(express.json());
  app.use(quickbooksRouter);
  return app;
}

beforeEach(() => {
  h.connections = [];
  h.writes = 0;
  delete process.env.QUICKBOOKS_CLIENT_ID;
  delete process.env.QUICKBOOKS_CLIENT_SECRET;
  process.env.NODE_ENV = "test";
});

afterEach(() => {
  process.env.NODE_ENV = originalNodeEnv;
  if (originalClientId === undefined) delete process.env.QUICKBOOKS_CLIENT_ID;
  else process.env.QUICKBOOKS_CLIENT_ID = originalClientId;
  if (originalClientSecret === undefined) delete process.env.QUICKBOOKS_CLIENT_SECRET;
  else process.env.QUICKBOOKS_CLIENT_SECRET = originalClientSecret;
});

describe("QuickBooks beta safety", () => {
  it("blocks simulated connect in production without OAuth credentials", async () => {
    process.env.NODE_ENV = "production";

    const res = await request(makeApp())
      .post("/quickbooks/connect")
      .send({ companyName: "Acme Books" });

    expect(res.status).toBe(501);
    expect(h.writes).toBe(0);
  });

  it("keeps simulated connect available outside production", async () => {
    const res = await request(makeApp())
      .post("/quickbooks/connect")
      .send({ companyName: "Acme Books" });

    expect(res.status).toBe(201);
    expect(res.body.connected).toBe(true);
  });
});
