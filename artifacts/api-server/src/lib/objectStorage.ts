import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Readable } from "stream";
import { randomUUID } from "crypto";
import {
  ObjectAclPolicy,
  ObjectPermission,
  canAccessObject,
  getObjectAclPolicy,
  setObjectAclPolicy,
} from "./objectAcl";
import {
  createStorageObject,
  listStorageObjectsByPrefix,
  type StorageObject,
} from "./storageObject";

export type { StorageObject } from "./storageObject";

function requireR2Env(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set`);
  }
  return value;
}

function getR2Bucket(): string {
  return requireR2Env("R2_BUCKET");
}

function getR2PublicUrl(): string {
  return requireR2Env("R2_PUBLIC_URL").replace(/\/$/, "");
}

function createR2Client(): S3Client {
  const accountId = requireR2Env("R2_ACCOUNT_ID");
  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: requireR2Env("R2_ACCESS_KEY_ID"),
      secretAccessKey: requireR2Env("R2_SECRET_ACCESS_KEY"),
    },
  });
}

let r2Client: S3Client | null = null;

export function getObjectStorageClient(): S3Client {
  if (!r2Client) {
    r2Client = createR2Client();
  }
  return r2Client;
}

/** @deprecated Use getObjectStorageClient() — kept for orphan upload cleaner compatibility. */
export const objectStorageClient = {
  listByPrefix(prefix: string) {
    return listStorageObjectsByPrefix(
      getObjectStorageClient(),
      getR2Bucket(),
      prefix,
    );
  },
};

function dirToKeyPrefix(dir: string): string {
  return dir.replace(/^\//, "").replace(/\/$/, "");
}

function entityIdFromObjectPath(objectPath: string): string {
  if (!objectPath.startsWith("/objects/")) {
    throw new ObjectNotFoundError();
  }
  return objectPath.slice("/objects/".length);
}

function objectPathFromEntityId(entityId: string): string {
  return `/objects/${entityId}`;
}

function objectKeyFromEntityId(
  entityId: string,
  privateObjectDir: string,
): string {
  return `${dirToKeyPrefix(privateObjectDir)}/${entityId}`;
}

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

export class ObjectStorageService {
  constructor() {}

  getPublicObjectSearchPaths(): Array<string> {
    const pathsStr = process.env.PUBLIC_OBJECT_SEARCH_PATHS || "";
    const paths = Array.from(
      new Set(
        pathsStr
          .split(",")
          .map((path) => path.trim())
          .filter((path) => path.length > 0),
      ),
    );
    if (paths.length === 0) {
      throw new Error(
        "PUBLIC_OBJECT_SEARCH_PATHS not set. Set PUBLIC_OBJECT_SEARCH_PATHS " +
          "(comma-separated key prefixes within R2_BUCKET).",
      );
    }
    return paths;
  }

  getPrivateObjectDir(): string {
    const dir = process.env.PRIVATE_OBJECT_DIR || "";
    if (!dir) {
      throw new Error(
        "PRIVATE_OBJECT_DIR not set. Set PRIVATE_OBJECT_DIR to the private " +
          "object key prefix within R2_BUCKET (e.g. /haulbrokr/private).",
      );
    }
    return dir;
  }

  async searchPublicObject(filePath: string): Promise<StorageObject | null> {
    if (
      !filePath ||
      filePath.includes("..") ||
      filePath.includes("\\") ||
      filePath.startsWith("/")
    ) {
      return null;
    }

    const client = getObjectStorageClient();
    const bucket = getR2Bucket();

    for (const searchPath of this.getPublicObjectSearchPaths()) {
      const objectKey = `${dirToKeyPrefix(searchPath)}/${filePath}`;
      const object = createStorageObject(client, bucket, objectKey);
      const [exists] = await object.exists();
      if (exists) {
        return object;
      }
    }

    return null;
  }

  async downloadObject(
    file: StorageObject,
    cacheTtlSec: number = 3600,
  ): Promise<Response> {
    const [metadata] = await file.getMetadata();
    const aclPolicy = await getObjectAclPolicy(file);
    const isPublic = aclPolicy?.visibility === "public";

    const nodeStream = file.createReadStream();
    const webStream = Readable.toWeb(nodeStream) as ReadableStream;

    const headers: Record<string, string> = {
      "Content-Type": metadata.contentType || "application/octet-stream",
      "Cache-Control": `${isPublic ? "public" : "private"}, max-age=${cacheTtlSec}`,
    };
    if (metadata.size) {
      headers["Content-Length"] = String(metadata.size);
    }

    return new Response(webStream, { headers });
  }

  async getObjectEntityUploadURL(): Promise<string> {
    const privateObjectDir = this.getPrivateObjectDir();
    const objectId = randomUUID();
    const entityId = `uploads/${objectId}`;
    const objectKey = objectKeyFromEntityId(entityId, privateObjectDir);
    const client = getObjectStorageClient();
    const bucket = getR2Bucket();

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: objectKey,
    });

    return getSignedUrl(client, command, { expiresIn: 900 });
  }

  async getObjectEntityFile(objectPath: string): Promise<StorageObject> {
    const entityId = entityIdFromObjectPath(objectPath);
    const privateObjectDir = this.getPrivateObjectDir();
    const objectKey = objectKeyFromEntityId(entityId, privateObjectDir);
    const client = getObjectStorageClient();
    const bucket = getR2Bucket();
    const object = createStorageObject(client, bucket, objectKey);
    const [exists] = await object.exists();
    if (!exists) {
      throw new ObjectNotFoundError();
    }
    return object;
  }

  normalizeObjectEntityPath(rawPath: string): string {
    if (rawPath.startsWith("/objects/")) {
      return rawPath;
    }

    const privatePrefix = dirToKeyPrefix(this.getPrivateObjectDir());

    if (rawPath.startsWith("https://storage.googleapis.com/")) {
      const url = new URL(rawPath);
      const rawObjectKey = url.pathname.replace(/^\//, "");
      if (rawObjectKey.startsWith(`${privatePrefix}/`)) {
        const entityId = rawObjectKey.slice(privatePrefix.length + 1);
        return objectPathFromEntityId(entityId);
      }
      return rawPath;
    }

    try {
      const url = new URL(rawPath);
      const pathname = decodeURIComponent(url.pathname.replace(/^\//, ""));
      const publicBase = getR2PublicUrl().replace(/^https?:\/\//, "");
      const hostMatchesPublic = url.host === publicBase.split("/")[0];

      let objectKey = pathname;
      if (hostMatchesPublic) {
        objectKey = pathname;
      } else if (pathname.startsWith(`${getR2Bucket()}/`)) {
        objectKey = pathname.slice(getR2Bucket().length + 1);
      }

      if (objectKey.startsWith(`${privatePrefix}/`)) {
        const entityId = objectKey.slice(privatePrefix.length + 1);
        return objectPathFromEntityId(entityId);
      }
    } catch {
      // Not a URL — fall through.
    }

    return rawPath;
  }

  async trySetObjectEntityAclPolicy(
    rawPath: string,
    aclPolicy: ObjectAclPolicy,
  ): Promise<string> {
    const normalizedPath = this.normalizeObjectEntityPath(rawPath);
    if (!normalizedPath.startsWith("/")) {
      return normalizedPath;
    }

    const objectFile = await this.getObjectEntityFile(normalizedPath);
    await setObjectAclPolicy(objectFile, aclPolicy);
    return normalizedPath;
  }

  async canAccessObjectEntity({
    userId,
    objectFile,
    requestedPermission,
  }: {
    userId?: string;
    objectFile: StorageObject;
    requestedPermission?: ObjectPermission;
  }): Promise<boolean> {
    return canAccessObject({
      userId,
      objectFile,
      requestedPermission: requestedPermission ?? ObjectPermission.READ,
    });
  }
}

export async function listPrivateUploadObjects(
  prefix: string,
): Promise<StorageObject[]> {
  return listStorageObjectsByPrefix(
    getObjectStorageClient(),
    getR2Bucket(),
    prefix,
  );
}
