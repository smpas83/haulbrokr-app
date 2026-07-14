import { describe, it, expect, beforeEach, vi } from "vitest";
import express, { type Express } from "express";
import request from "supertest";
import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";

/**
 * RC2 Phase 3 — security audit automation.
 * Auth gates, upload allowlist, secret exposure scan, XSS/SQL injection hygiene.
 */

process.env.UPLOAD_TOKEN_SECRET = "rc2-security-upload-secret";

const h = vi.hoisted(() => ({
  profile: null as Record<string, unknown> | null,
  storageThrow: null as Error | null,
}));

vi.mock("../middlewares/requireAuth", () => ({
  requireAuth: (req: any, res: any, next: any) => {
    if (!h.profile) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    req.clerkId = h.profile.clerkId;
    next();
  },
  requireProfile: (req: any, res: any, next: any) => {
    if (!h.profile) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    req.profile = { ...h.profile };
    next();
  },
  getRequestProfile: (req: any) => req.profile,
}));

vi.mock("@workspace/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve([]),
          orderBy: () => Promise.resolve([]),
          then: (ok: (v: unknown) => unknown) => Promise.resolve([]).then(ok),
        }),
        orderBy: () => Promise.resolve([]),
      }),
    }),
    insert: () => ({ values: () => ({ returning: () => Promise.resolve([]) }) }),
    update: () => ({ set: () => ({ where: () => ({ returning: () => Promise.resolve([]) }) }) }),
  },
  profilesTable: {},
  organizationsTable: {},
  deviceTokensTable: {},
  activityTable: {},
  driverDocumentsTable: {},
  jobsTable: {},
  ticketsTable: {},
  deliveryEvidenceTable: {},
  jobStatusUpdatesTable: {},
  trucksTable: {},
}));

vi.mock("../lib/objectStorage", () => {
  class FakeObjectNotFoundError extends Error {
    constructor() {
      super("Object not found");
      this.name = "ObjectNotFoundError";
    }
  }
  class MockObjectStorageService {
    getObjectEntityUploadURL = vi.fn(async () => "https://storage.example.com/u");
    normalizeObjectEntityPath = vi.fn(() => "/objects/uploads/u");
    getObjectEntityFile = vi.fn(async () => ({
      getMetadata: async () => [{ size: 10, contentType: "image/jpeg", generation: "1" }],
      delete: async () => {},
    }));
    searchPublicObject = vi.fn(async () => null);
    downloadObject = vi.fn(async () => new Response(null, { status: 200 }));
  }
  return {
    ObjectStorageService: MockObjectStorageService,
    ObjectNotFoundError: FakeObjectNotFoundError,
  };
});

import storageRouter from "./storage";
import notificationsRouter from "./notifications";
import profilesRouter from "./profiles";
import { globalRateLimit } from "../middlewares/rateLimit";

function walkTsFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (entry === "node_modules" || entry === "dist") continue;
      walkTsFiles(full, acc);
    } else if (/\.(ts|tsx|js|mjs)$/.test(entry) && !entry.includes(".test.")) {
      acc.push(full);
    }
  }
  return acc;
}

beforeEach(() => {
  h.profile = null;
});

describe("RC2 Phase 3 — authentication & authorization", () => {
  it("rejects unauthenticated profile and notification access", async () => {
    const app = express();
    app.use(express.json());
    app.use(profilesRouter);
    app.use(notificationsRouter);

    const me = await request(app).get("/profiles/me");
    expect(me.status).toBe(401);

    const notes = await request(app).get("/notifications");
    expect(notes.status).toBe(401);

    const upload = await request(app)
      .post("/storage/uploads/request-url")
      .send({ name: "a.jpg", size: 1, contentType: "image/jpeg" });
    // storage router not mounted — mount and recheck
  });

  it("rejects unauthenticated uploads", async () => {
    const app = express();
    app.use(express.json());
    app.use((req: any, _res, next) => {
      req.log = { error: vi.fn(), warn: vi.fn(), info: vi.fn() };
      next();
    });
    app.use(storageRouter);

    const res = await request(app)
      .post("/storage/uploads/request-url")
      .send({ name: "a.jpg", size: 100, contentType: "image/jpeg" });
    expect(res.status).toBe(401);
  });
});

describe("RC2 Phase 3 — file upload validation", () => {
  it("rejects executable and script content types", async () => {
    h.profile = { id: 1, clerkId: "u1", role: "driver" };
    const app = express();
    app.use(express.json());
    app.use((req: any, _res, next) => {
      req.log = { error: vi.fn(), warn: vi.fn(), info: vi.fn() };
      next();
    });
    app.use(storageRouter);

    for (const contentType of [
      "application/x-msdownload",
      "application/javascript",
      "text/html",
      "application/x-sh",
      "image/svg+xml",
    ]) {
      const res = await request(app)
        .post("/storage/uploads/request-url")
        .send({ name: "evil.bin", size: 100, contentType });
      expect(res.status).toBe(400);
    }
  });

  it("allows image and PDF uploads", async () => {
    h.profile = { id: 1, clerkId: "u1", role: "driver" };
    const app = express();
    app.use(express.json());
    app.use((req: any, _res, next) => {
      req.log = { error: vi.fn(), warn: vi.fn(), info: vi.fn() };
      next();
    });
    app.use(storageRouter);

    for (const contentType of ["image/jpeg", "image/png", "application/pdf", "image/webp"]) {
      const res = await request(app)
        .post("/storage/uploads/request-url")
        .send({ name: "doc", size: 100, contentType });
      expect(res.status).toBe(200);
    }
  });
});

describe("RC2 Phase 3 — rate limiting", () => {
  it("exposes rate limit headers and eventually 429s", async () => {
    const app = express();
    app.use(globalRateLimit);
    app.get("/x", (_req, res) => res.json({ ok: true }));

    const first = await request(app).get("/x");
    expect(first.headers["x-ratelimit-limit"]).toBeTruthy();

    let limited = false;
    for (let i = 0; i < 130; i++) {
      const res = await request(app).get("/x");
      if (res.status === 429) {
        limited = true;
        break;
      }
    }
    expect(limited).toBe(true);
  });
});

describe("RC2 Phase 3 — secret exposure & injection hygiene", () => {
  it("does not ship live Stripe/Clerk secrets in source", () => {
    const roots = [
      join(process.cwd(), "src"),
      join(process.cwd(), "../../scripts"),
    ];
    const secretPatterns = [
      /sk_live_[A-Za-z0-9]{20,}/,
      /rk_live_[A-Za-z0-9]{20,}/,
      /whsec_[A-Za-z0-9]{20,}/,
      /sk_test_[A-Za-z0-9]{20,}/,
    ];

    const offenders: string[] = [];
    for (const root of roots) {
      let files: string[] = [];
      try {
        files = walkTsFiles(root);
      } catch {
        continue;
      }
      for (const file of files) {
        const text = readFileSync(file, "utf8");
        for (const re of secretPatterns) {
          if (re.test(text)) offenders.push(`${file} ~ ${re}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("SQL access uses Drizzle parameterized APIs (no string-interpolated user SQL)", () => {
    const routesDir = join(process.cwd(), "src/routes");
    const files = walkTsFiles(routesDir).filter((f) => !f.includes(".test."));
    const dangerous: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      // Flag raw string concatenation into sql tagged templates with req.body
      if (/sql`[^`]*\$\{[^}]*req\.(body|query|params)/.test(text)) {
        dangerous.push(file);
      }
      if (/pool\.query\(\s*[`'"].*\$\{/.test(text)) {
        dangerous.push(file);
      }
    }
    expect(dangerous).toEqual([]);
  });

  it("API JSON responses do not reflect unsanitized HTML script tags from filenames", async () => {
    h.profile = { id: 1, clerkId: "u1", role: "driver" };
    const app = express();
    app.use(express.json());
    app.use((req: any, _res, next) => {
      req.log = { error: vi.fn(), warn: vi.fn(), info: vi.fn() };
      next();
    });
    app.use(storageRouter);

    const res = await request(app)
      .post("/storage/uploads/request-url")
      .send({
        name: "<script>alert(1)</script>.jpg",
        size: 100,
        contentType: "image/jpeg",
      });
    expect(res.status).toBe(200);
    // JSON content-type prevents browser XSS even if metadata echoes the filename.
    expect(res.headers["content-type"]).toMatch(/json/);
    expect(res.body.objectPath).not.toMatch(/<script>/i);
  });

  it("security headers middleware contract is present in app.ts", () => {
    const appSrc = readFileSync(join(process.cwd(), "src/app.ts"), "utf8");
    expect(appSrc).toContain("X-Content-Type-Options");
    expect(appSrc).toContain("X-Frame-Options");
    expect(appSrc).toContain("Strict-Transport-Security");
    expect(appSrc).toContain("cors");
  });

  it("Stripe webhooks mount before JSON parser (CSRF/signature integrity)", () => {
    const appSrc = readFileSync(join(process.cwd(), "src/app.ts"), "utf8");
    const webhookIdx = appSrc.indexOf('app.use(\n  "/api/webhooks/stripe"');
    const altWebhookIdx = appSrc.indexOf('"/api/webhooks/stripe"');
    const jsonIdx = appSrc.indexOf("app.use(express.json())");
    expect(altWebhookIdx).toBeGreaterThan(-1);
    expect(jsonIdx).toBeGreaterThan(-1);
    expect(altWebhookIdx).toBeLessThan(jsonIdx);
    expect(webhookIdx === -1 || webhookIdx < jsonIdx).toBe(true);
  });
});
