import express, { type Express } from "express";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { apiRateLimit, __resetApiRateLimitForTests } from "./apiRateLimit";

function makeApp(): Express {
  const app = express();
  app.use(apiRateLimit());
  app.get("/ping", (_req, res) => {
    res.json({ ok: true });
  });
  return app;
}

describe("apiRateLimit", () => {
  beforeEach(() => {
    process.env.API_RATE_LIMIT_WINDOW_MS = "100";
    process.env.API_RATE_LIMIT_MAX = "2";
    __resetApiRateLimitForTests();
  });

  it("allows requests within the configured window and emits rate headers", async () => {
    const app = makeApp();

    const first = await request(app).get("/ping");
    const second = await request(app).get("/ping");

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(first.headers["ratelimit-limit"]).toBe("2");
    expect(first.headers["ratelimit-remaining"]).toBe("1");
    expect(second.headers["ratelimit-remaining"]).toBe("0");
  });

  it("rejects requests after the per-client limit is exceeded", async () => {
    const app = makeApp();

    await request(app).get("/ping");
    await request(app).get("/ping");
    const blocked = await request(app).get("/ping");

    expect(blocked.status).toBe(429);
    expect(blocked.headers["retry-after"]).toBeTruthy();
    expect(blocked.body.error).toMatch(/too many requests/i);
  });

  it("tracks forwarded clients independently", async () => {
    const app = makeApp();

    await request(app).get("/ping").set("X-Forwarded-For", "203.0.113.10");
    await request(app).get("/ping").set("X-Forwarded-For", "203.0.113.10");
    const blocked = await request(app).get("/ping").set("X-Forwarded-For", "203.0.113.10");
    const otherClient = await request(app).get("/ping").set("X-Forwarded-For", "203.0.113.11");

    expect(blocked.status).toBe(429);
    expect(otherClient.status).toBe(200);
  });
});
