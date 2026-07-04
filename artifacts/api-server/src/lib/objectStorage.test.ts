import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const h = vi.hoisted(() => ({
  headExists: true,
  headMetadata: {
    ContentLength: 1024,
    ContentType: "image/jpeg",
    ETag: '"abc123"',
    Metadata: {},
  },
  listedObjects: [] as Array<{ Key?: string; LastModified?: Date }>,
  signedUrl:
    "https://account.r2.cloudflarestorage.com/haulbrokr-uploads/haulbrokr/private/uploads/test-uuid?X-Amz-Signature=abc",
}));

vi.mock("@aws-sdk/client-s3", () => {
  class HeadObjectCommand {
    constructor(public input: unknown) {}
  }
  class GetObjectCommand {
    constructor(public input: unknown) {}
  }
  class DeleteObjectCommand {
    constructor(public input: unknown) {}
  }
  class PutObjectCommand {
    constructor(public input: unknown) {}
  }
  class CopyObjectCommand {
    constructor(public input: unknown) {}
  }
  class ListObjectsV2Command {
    constructor(public input: unknown) {}
  }

  const client = {
    send: vi.fn(
      async (command: {
        constructor: { name: string };
        input?: { Prefix?: string };
      }) => {
        if (command.constructor.name === "HeadObjectCommand") {
          if (!h.headExists) {
            const err = new Error("NotFound");
            (err as { name: string }).name = "NotFound";
            throw err;
          }
          return h.headMetadata;
        }
        if (command.constructor.name === "PutObjectCommand") {
          return {};
        }
        if (command.constructor.name === "ListObjectsV2Command") {
          return { Contents: h.listedObjects, IsTruncated: false };
        }
        if (command.constructor.name === "GetObjectCommand") {
          const { Readable } = await import("stream");
          return { Body: Readable.from([Buffer.from("test")]) };
        }
        if (command.constructor.name === "DeleteObjectCommand") {
          return {};
        }
        if (command.constructor.name === "CopyObjectCommand") {
          return {};
        }
        throw new Error(`Unexpected command: ${command.constructor.name}`);
      },
    ),
  };

  class S3Client {
    send = client.send;
    constructor(_config: unknown) {}
  }

  return {
    S3Client,
    HeadObjectCommand,
    GetObjectCommand,
    DeleteObjectCommand,
    PutObjectCommand,
    CopyObjectCommand,
    ListObjectsV2Command,
  };
});

vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: vi.fn(async () => h.signedUrl),
}));

describe("ObjectStorageService (R2)", () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    process.env.R2_ACCOUNT_ID = "test-account";
    process.env.R2_ACCESS_KEY_ID = "test-key";
    process.env.R2_SECRET_ACCESS_KEY = "test-secret";
    process.env.R2_BUCKET = "haulbrokr-uploads";
    process.env.R2_PUBLIC_URL = "https://cdn.example.com";
    process.env.PRIVATE_OBJECT_DIR = "/haulbrokr/private";
    process.env.PUBLIC_OBJECT_SEARCH_PATHS = "/haulbrokr/public";
    h.headExists = true;
    h.headMetadata = {
      ContentLength: 1024,
      ContentType: "image/jpeg",
      ETag: '"abc123"',
      Metadata: {},
    };
    h.listedObjects = [];
    h.signedUrl =
      "https://account.r2.cloudflarestorage.com/haulbrokr-uploads/haulbrokr/private/uploads/test-uuid?X-Amz-Signature=abc";
    vi.resetModules();
  });

  afterEach(() => {
    process.env = { ...envBackup };
  });

  async function loadService() {
    const mod = await import("./objectStorage");
    return new mod.ObjectStorageService();
  }

  it("returns a presigned upload URL and normalizes object path from R2 URL", async () => {
    const service = await loadService();
    const uploadURL = await service.getObjectEntityUploadURL();
    expect(uploadURL).toBe(h.signedUrl);
    expect(service.normalizeObjectEntityPath(uploadURL)).toBe(
      "/objects/uploads/test-uuid",
    );
  });

  it("normalizes legacy GCS URLs to /objects paths", async () => {
    const service = await loadService();
    const normalized = service.normalizeObjectEntityPath(
      "https://storage.googleapis.com/haulbrokr/private/uploads/legacy-id",
    );
    expect(normalized).toBe("/objects/uploads/legacy-id");
  });

  it("normalizes R2 public URLs to /objects paths", async () => {
    const service = await loadService();
    const normalized = service.normalizeObjectEntityPath(
      "https://cdn.example.com/haulbrokr/private/uploads/public-id",
    );
    expect(normalized).toBe("/objects/uploads/public-id");
  });

  it("loads an existing private object by /objects path", async () => {
    const service = await loadService();
    const objectFile = await service.getObjectEntityFile(
      "/objects/uploads/existing-id",
    );
    const [metadata] = await objectFile.getMetadata();
    expect(metadata.size).toBe(1024);
    expect(metadata.contentType).toBe("image/jpeg");
    expect(metadata.generation).toBe("abc123");
  });

  it("throws ObjectNotFoundError when object is missing", async () => {
    h.headExists = false;
    const service = await loadService();
    const mod = await import("./objectStorage");
    await expect(
      service.getObjectEntityFile("/objects/uploads/missing-id"),
    ).rejects.toBeInstanceOf(mod.ObjectNotFoundError);
  });

  it("finds public objects under PUBLIC_OBJECT_SEARCH_PATHS", async () => {
    const service = await loadService();
    const found = await service.searchPublicObject("logo.png");
    expect(found).not.toBeNull();
    expect(found?.name).toBe("haulbrokr/public/logo.png");
  });

  it("returns null when public object is not found", async () => {
    h.headExists = false;
    const service = await loadService();
    const found = await service.searchPublicObject("missing.png");
    expect(found).toBeNull();
  });

  it("streams object bytes via downloadObject", async () => {
    const service = await loadService();
    const objectFile = await service.getObjectEntityFile(
      "/objects/uploads/existing-id",
    );
    const response = await service.downloadObject(objectFile);
    expect(response.headers.get("Content-Type")).toBe("image/jpeg");
    expect(response.headers.get("Content-Length")).toBe("1024");
    const text = await response.text();
    expect(text).toBe("test");
  });

  it("lists private upload objects by prefix", async () => {
    h.listedObjects = [
      {
        Key: "haulbrokr/private/uploads/orphan-1",
        LastModified: new Date("2020-01-01T00:00:00.000Z"),
      },
    ];
    const mod = await import("./objectStorage");
    const objects = await mod.listPrivateUploadObjects(
      "haulbrokr/private/uploads/",
    );
    expect(objects).toHaveLength(1);
    expect(objects[0]?.name).toBe("haulbrokr/private/uploads/orphan-1");
    expect(objects[0]?.metadata?.timeCreated).toBe("2020-01-01T00:00:00.000Z");
  });
});
