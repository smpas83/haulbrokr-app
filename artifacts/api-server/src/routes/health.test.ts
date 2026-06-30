import express, { type Express } from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  query: vi.fn(),
}));

vi.mock("@workspace/db", () => ({
  pool: {
    query: h.query,
  },
}));

import healthRouter from "./health";

function makeApp(): Express {
  const app = express();
  app.use(healthRouter);
  return app;
}

beforeEach(() => {
  h.query.mockReset();
});

describe("health routes", () => {
  it("keeps liveness independent from the database", async () => {
    const app = makeApp();
    h.query.mockRejectedValueOnce(new Error("database unavailable"));

    const res = await request(app).get("/healthz");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
    expect(h.query).not.toHaveBeenCalled();
  });

  it("reports readiness only after a database ping succeeds", async () => {
    const app = makeApp();
    h.query.mockResolvedValueOnce({ rows: [{ "?column?": 1 }] });

    const res = await request(app).get("/readyz");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
    expect(h.query).toHaveBeenCalledWith("select 1");
  });

  it("returns 503 when the database ping fails", async () => {
    const app = makeApp();
    h.query.mockRejectedValueOnce(new Error("database unavailable"));

    const res = await request(app).get("/readyz");

    expect(res.status).toBe(503);
    expect(res.body).toEqual({ status: "unavailable" });
  });
});
