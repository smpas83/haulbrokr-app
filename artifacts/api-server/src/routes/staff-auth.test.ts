import { describe, it, expect, beforeEach, vi } from "vitest";
import express, { type Express } from "express";
import cookieParser from "cookie-parser";
import request from "supertest";
import { hashStaffPassword } from "../lib/staffPassword";
import { signStaffSession } from "../lib/staffSession";

const h = vi.hoisted(() => ({
  users: [] as Array<{
    id: number;
    username: string;
    passwordHash: string;
    staffRole: string;
    displayName: string;
    active: boolean;
  }>,
}));

vi.mock("@workspace/db", () => {
  const staffUsersTable = new Proxy({}, { get: (_t, p) => `staffUsers.${String(p)}` });
  const db = {
    select: () => ({
      from: (table: unknown) => ({
        where: (..._args: unknown[]) => {
          if (table === staffUsersTable) return Promise.resolve(h.users);
          return Promise.resolve([]);
        },
      }),
    }),
  };
  return { db, staffUsersTable };
});

vi.mock("../middlewares/requireAuth", () => ({
  attachClerkProfileIfPresent: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

import staffAuthRouter from "./staff-auth";
import adminRouter from "./admin";

async function makeApp(): Promise<Express> {
  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use(staffAuthRouter);
  app.use(adminRouter);
  return app;
}

beforeEach(async () => {
  h.users = [];
  const hash = await hashStaffPassword("test-password");
  h.users.push({
    id: 1,
    username: "ceo",
    passwordHash: hash,
    staffRole: "ceo",
    displayName: "CEO",
    active: true,
  });
});

describe("staff admin login", () => {
  it("POST /admin/login sets session cookie and returns permissions", async () => {
    const app = await makeApp();
    const res = await request(app)
      .post("/admin/login")
      .send({ username: "ceo", password: "test-password" });

    expect(res.status).toBe(200);
    expect(res.body.staffRole).toBe("ceo");
    expect(res.body.permissions).toContain("overview");
    expect(res.headers["set-cookie"]?.[0]).toMatch(/haulbrokr_staff=/);
  });

  it("GET /admin/access works with staff session cookie (no Clerk)", async () => {
    const app = await makeApp();
    const token = signStaffSession(1, "ceo");
    const res = await request(app)
      .get("/admin/access")
      .set("Cookie", [`haulbrokr_staff=${token}`]);

    expect(res.status).toBe(200);
    expect(res.body.isAdmin).toBe(true);
    expect(res.body.staffRole).toBe("ceo");
    expect(res.body.authMethod).toBe("staff");
  });

  it("POST /admin/logout clears session", async () => {
    const app = await makeApp();
    const token = signStaffSession(1, "ceo");
    const res = await request(app)
      .post("/admin/logout")
      .set("Cookie", [`haulbrokr_staff=${token}`]);
    expect(res.status).toBe(200);
    expect(res.headers["set-cookie"]?.[0]).toMatch(/haulbrokr_staff=;/);
  });

  it("rate limits repeated failed login attempts", async () => {
    const app = await makeApp();

    for (let i = 0; i < 5; i++) {
      const res = await request(app)
        .post("/admin/login")
        .send({ username: "locked-user", password: "wrong-password" });
      expect(res.status).toBe(401);
    }

    const locked = await request(app)
      .post("/admin/login")
      .send({ username: "locked-user", password: "wrong-password" });

    expect(locked.status).toBe(429);
  });
});
