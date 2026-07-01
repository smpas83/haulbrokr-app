import { describe, expect, it } from "vitest";
import express from "express";
import request from "supertest";
import pinoHttp from "pino-http";
import crypto from "node:crypto";
import { errorHandler } from "./errorHandler";

function makeApp() {
  const app = express();
  app.use(pinoHttp({
    genReqId(req, res) {
      const incoming = req.headers["x-request-id"];
      const requestId = typeof incoming === "string" && incoming ? incoming : crypto.randomUUID();
      res.setHeader("X-Request-Id", requestId);
      return requestId;
    },
  }));
  app.get("/boom", (_req, _res, next) => next(new Error("secret stack")));
  app.use(errorHandler);
  return app;
}

describe("errorHandler request ids", () => {
  it("returns a correlation id without exposing 5xx internals", async () => {
    const res = await request(makeApp())
      .get("/boom")
      .set("X-Request-Id", "req-beta-123");

    expect(res.status).toBe(500);
    expect(res.headers["x-request-id"]).toBe("req-beta-123");
    expect(res.body).toEqual({ error: "Internal server error", requestId: "req-beta-123" });
  });
});
