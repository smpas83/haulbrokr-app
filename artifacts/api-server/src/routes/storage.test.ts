import { describe, it, expect, vi, beforeEach } from "vitest";
import express, { type Express } from "express";
import request from "supertest";

process.env.UPLOAD_TOKEN_SECRET = "test-secret-for-storage-tests";

const h = vi.hoisted(() => ({
  profile: { id: 42, clerkId: "user_test" } as Record<string, unknown>,
  fileMetadata: [{ size: 1024, contentType: "image/jpeg", generation: "12345" }] as any[],
  deleteFile: vi.fn(async () => {}),
  fileNotFound: false,
}));

vi.mock("../middlewares/requireAuth", () => ({
  requireAuth: (_req: any, _res: any, next: any) => next(),
  requireProfile: (req: any, _res: any, next: any) => {
    req.profile = { ...h.profile };
    next();
  },
  getRequestProfile: (req: any) => req.profile,
}));

vi.mock("@workspace/db", () => ({
  db: {
    select: () => ({ from: () => ({ where: () => Promise.resolve([]) }) }),
    insert: () => ({ values: () => ({ returning: () => Promise.resolve([{ id: 1 }]) }) }),
    update: () => ({
      set: () => ({ where: () => ({ returning: () => Promise.resolve([{ id: 1 }]) }) }),
    }),
  },
  driverDocumentsTable: new Proxy({}, { get: (_t, p) => `driverDocuments.${String(p)}` }),
}));

const FAKE_OBJECT_PATH = "/objects/uploads/fake-uuid-1234";
const FAKE_UPLOAD_URL = "https://storage.googleapis.com/test-bucket/uploads/fake-uuid-1234";

vi.mock("../lib/objectStorage", () => {
  class FakeObjectNotFoundError extends Error {
    constructor() {
      super("Object not found");
      this.name = "ObjectNotFoundError";
      Object.setPrototypeOf(this, FakeObjectNotFoundError.prototype);
    }
  }

  class MockObjectStorageService {
    getObjectEntityUploadURL = vi.fn(async () => FAKE_UPLOAD_URL);
    normalizeObjectEntityPath = vi.fn((_raw: string) => FAKE_OBJECT_PATH);
    getObjectEntityFile = vi.fn(async (path: string) => {
      if (h.fileNotFound || path !== FAKE_OBJECT_PATH) throw new FakeObjectNotFoundError();
      return {
        getMetadata: vi.fn(async () => h.fileMetadata),
        delete: h.deleteFile,
      };
    });
    searchPublicObject = vi.fn(async () => null);
    downloadObject = vi.fn(async () => new Response(null, { status: 200, headers: { "Content-Type": "text/plain" } }));
  }

  return {
    ObjectStorageService: MockObjectStorageService,
    ObjectNotFoundError: FakeObjectNotFoundError,
  };
});

import storageRouter from "./storage";

function makeApp(): Express {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res: any, next: any) => {
    req.log = { error: vi.fn(), warn: vi.fn(), info: vi.fn() };
    next();
  });
  app.use(storageRouter);
  return app;
}

let app: Express;
beforeEach(() => {
  h.profile = { id: 42, clerkId: "user_test" };
  h.fileMetadata = [{ size: 1024, contentType: "image/jpeg", generation: "12345" }];
  h.deleteFile = vi.fn(async () => {});
  h.fileNotFound = false;
  app = makeApp();
});

describe("POST /storage/uploads/request-url", () => {
  it("returns uploadURL, objectPath, and uploadToken for a valid request", async () => {
    const res = await request(app)
      .post("/storage/uploads/request-url")
      .send({ name: "id.jpg", size: 512, contentType: "image/jpeg" });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("uploadURL");
    expect(res.body).toHaveProperty("objectPath", FAKE_OBJECT_PATH);
    expect(typeof res.body.uploadToken).toBe("string");
    expect(res.body.uploadToken.length).toBeGreaterThan(10);
  });

  it("rejects missing fields with 400", async () => {
    const res = await request(app)
      .post("/storage/uploads/request-url")
      .send({ name: "id.jpg" });
    expect(res.status).toBe(400);
  });

  it("rejects files over 50 MB with 400", async () => {
    const res = await request(app)
      .post("/storage/uploads/request-url")
      .send({ name: "id.jpg", size: 60 * 1024 * 1024, contentType: "image/jpeg" });
    expect(res.status).toBe(400);
  });

  it("rejects unsupported content types (RC2 upload hardening)", async () => {
    const res = await request(app)
      .post("/storage/uploads/request-url")
      .send({ name: "evil.html", size: 512, contentType: "text/html" });
    expect(res.status).toBe(400);
  });
});

describe("POST /storage/uploads/finalize", () => {
  async function getUploadToken(
    size = 4096,
    contentType = "image/jpeg",
  ): Promise<{ uploadToken: string; objectPath: string }> {
    const res = await request(app)
      .post("/storage/uploads/request-url")
      .send({ name: "id.jpg", size, contentType });
    expect(res.status).toBe(200);
    return { uploadToken: res.body.uploadToken, objectPath: res.body.objectPath };
  }

  it("happy path: returns storageToken when metadata is within declared limits", async () => {
    const { uploadToken, objectPath } = await getUploadToken();

    const res = await request(app)
      .post("/storage/uploads/finalize")
      .send({ objectPath, uploadToken });

    expect(res.status).toBe(200);
    expect(typeof res.body.storageToken).toBe("string");
    expect(res.body.objectPath).toBe(objectPath);
  });

  it("rejects a token issued to a different profile (profile_mismatch)", async () => {
    const { uploadToken, objectPath } = await getUploadToken();

    h.profile = { id: 999, clerkId: "attacker" };
    const res = await request(app)
      .post("/storage/uploads/finalize")
      .send({ objectPath, uploadToken });

    expect(res.status).toBe(403);
    expect(res.body.reason).toBe("profile_mismatch");
  });

  it("rejects replay of an already-consumed uploadToken (single-use)", async () => {
    const { uploadToken, objectPath } = await getUploadToken();

    const first = await request(app)
      .post("/storage/uploads/finalize")
      .send({ objectPath, uploadToken });
    expect(first.status).toBe(200);

    const second = await request(app)
      .post("/storage/uploads/finalize")
      .send({ objectPath, uploadToken });
    expect(second.status).toBe(403);
  });

  it("rejects and deletes an oversized upload (actual > declared max)", async () => {
    const { uploadToken, objectPath } = await getUploadToken(1024);

    h.fileMetadata = [{ size: 100 * 1024 * 1024, contentType: "image/jpeg" }];

    const res = await request(app)
      .post("/storage/uploads/finalize")
      .send({ objectPath, uploadToken });

    expect(res.status).toBe(422);
    expect(res.body.error).toMatch(/size/i);
    expect(h.deleteFile).toHaveBeenCalled();
  });

  it("rejects and deletes a content-type mismatch", async () => {
    const { uploadToken, objectPath } = await getUploadToken(4096, "image/jpeg");

    h.fileMetadata = [{ size: 512, contentType: "application/x-executable" }];

    const res = await request(app)
      .post("/storage/uploads/finalize")
      .send({ objectPath, uploadToken });

    expect(res.status).toBe(422);
    expect(res.body.error).toMatch(/content type/i);
    expect(h.deleteFile).toHaveBeenCalled();
  });

  it("returns 422 when the object is not found in storage", async () => {
    const { uploadToken, objectPath } = await getUploadToken();
    h.fileNotFound = true;

    const res = await request(app)
      .post("/storage/uploads/finalize")
      .send({ objectPath, uploadToken });

    expect(res.status).toBe(422);
  });
});
