import { describe, it, expect, beforeEach, vi } from "vitest";
import express, { type Express } from "express";
import request from "supertest";
import { normalizePagePath } from "./analytics";

const h = vi.hoisted(() => ({
  inserts: [] as Record<string, unknown>[],
  insertFails: false,
}));

vi.mock("@workspace/db", () => {
  const makeTable = (name: string) =>
    new Proxy({}, { get: (_t, p) => `${name}.${String(p)}` });
  return {
    db: {
      insert: () => ({
        values: (vals: Record<string, unknown>) => {
          if (h.insertFails) return Promise.reject(new Error("db down"));
          h.inserts.push(vals);
          return Promise.resolve(undefined);
        },
      }),
    },
    pageViewsTable: makeTable("pageViews"),
  };
});

import analyticsRouter from "./analytics";

function makeApp(): Express {
  const app = express();
  app.use(express.json());
  app.use(analyticsRouter);
  return app;
}

beforeEach(() => {
  h.inserts = [];
  h.insertFails = false;
});

describe("normalizePagePath", () => {
  it("normalizes paths and strips query/hash", () => {
    expect(normalizePagePath("/sign-up?ref=1")).toBe("/sign-up");
    expect(normalizePagePath("dashboard#top")).toBe("/dashboard");
    expect(normalizePagePath("//evil.com")).toBeNull();
    expect(normalizePagePath("https://evil.com")).toBeNull();
    expect(normalizePagePath("/admin/overview")).toBeNull();
    expect(normalizePagePath("/api/health")).toBeNull();
    expect(normalizePagePath("/fleet/")).toBe("/fleet");
  });
});

describe("POST /analytics/pageview", () => {
  it("records a valid page view", async () => {
    const res = await request(makeApp())
      .post("/analytics/pageview")
      .send({ path: "/sign-up", referrer: "https://google.com", sessionId: "sess_abcdefgh" });
    expect(res.status).toBe(204);
    expect(h.inserts).toHaveLength(1);
    expect(h.inserts[0]).toMatchObject({
      path: "/sign-up",
      referrer: "https://google.com",
      sessionId: "sess_abcdefgh",
    });
  });

  it("rejects invalid payloads", async () => {
    const res = await request(makeApp())
      .post("/analytics/pageview")
      .send({ path: "/", sessionId: "short" });
    expect(res.status).toBe(400);
    expect(h.inserts).toHaveLength(0);
  });

  it("silently skips admin paths", async () => {
    const res = await request(makeApp())
      .post("/analytics/pageview")
      .send({ path: "/admin", sessionId: "sess_abcdefgh" });
    expect(res.status).toBe(204);
    expect(h.inserts).toHaveLength(0);
  });

  it("returns 204 even when insert fails", async () => {
    h.insertFails = true;
    const res = await request(makeApp())
      .post("/analytics/pageview")
      .send({ path: "/", sessionId: "sess_abcdefgh" });
    expect(res.status).toBe(204);
  });
});
