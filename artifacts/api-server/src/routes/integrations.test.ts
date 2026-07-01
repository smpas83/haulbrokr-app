import express, { type Express } from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  isAdmin: true,
}));

vi.mock("../middlewares/staffAuth", () => ({
  attachStaffSession: (_req: any, _res: any, next: any) => next(),
}));

vi.mock("../middlewares/requireAuth", () => ({
  attachClerkProfileIfPresent: (_req: any, _res: any, next: any) => next(),
}));

vi.mock("../middlewares/requireAdmin", () => ({
  requireAdmin: (_req: any, res: any, next: any) => {
    if (!h.isAdmin) {
      res.status(403).json({ error: "Admin access required." });
      return;
    }
    next();
  },
}));

import integrationsRouter from "./integrations";

function makeApp(): Express {
  const app = express();
  app.use(integrationsRouter);
  return app;
}

beforeEach(() => {
  h.isAdmin = true;
  process.env.STRIPE_SECRET_KEY = "sk_live_test";
  process.env.STRIPE_PUBLISHABLE_KEY = "pk_live_test";
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
  process.env.PAYMENTS_MOCK_MODE = "false";
  process.env.GOOGLE_MAPS_API_KEY = "AIza_test";
  process.env.CLERK_SECRET_KEY = "sk_live_test";
  process.env.CLERK_PUBLISHABLE_KEY = "pk_live_test";
  process.env.RESEND_API_KEY = "re_test";
  process.env.RESEND_FROM_EMAIL = "noreply@haulbrokr.com";
  process.env.R2_ACCOUNT_ID = "account";
  process.env.R2_ACCESS_KEY_ID = "access";
  process.env.R2_SECRET_ACCESS_KEY = "secret";
  process.env.R2_BUCKET = "bucket";
  process.env.R2_PUBLIC_URL = "https://cdn.haulbrokr.com";
  process.env.PRIVATE_OBJECT_DIR = "/private";
  process.env.PUBLIC_OBJECT_SEARCH_PATHS = "/public";
});

describe("GET /integrations/status", () => {
  it("returns integration status for staff", async () => {
    const res = await request(makeApp()).get("/integrations/status");

    expect(res.status).toBe(200);
    expect(res.body.integrations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "stripe", status: "configured" }),
        expect.objectContaining({ key: "sms", status: "disabled" }),
        expect.objectContaining({ key: "push", status: "disabled" }),
      ]),
    );
    expect(JSON.stringify(res.body)).not.toContain("sk_live_test");
  });

  it("requires staff access", async () => {
    h.isAdmin = false;

    const res = await request(makeApp()).get("/integrations/status");

    expect(res.status).toBe(403);
  });
});
