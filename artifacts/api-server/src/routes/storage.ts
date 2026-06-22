import { Router, type IRouter, type Request, type Response } from "express";
import { Readable } from "stream";
import { z } from "zod/v4";
import { and, eq } from "drizzle-orm";
import { db, driverDocumentsTable } from "@workspace/db";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage";
import { getRequestProfile, requireProfile } from "../middlewares/requireAuth";
import {
  issueUploadToken,
  verifyUploadToken,
  isUploadTokenConsumed,
  markUploadTokenConsumed,
  issueStorageToken,
} from "../lib/uploadToken";

const RequestUploadUrlBody = z.object({
  name: z.string().min(1).max(255),
  size: z.number().int().positive().max(50 * 1024 * 1024),
  contentType: z.string().min(1).max(255),
});

const FinalizeBody = z.object({
  uploadToken: z.string().min(1),
  objectPath: z.string().min(1),
});

const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

const uploadRateLimit = new Map<string, { count: number; windowStart: number }>();

function checkUploadRateLimit(profileId: string): boolean {
  const now = Date.now();
  const entry = uploadRateLimit.get(profileId);
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    uploadRateLimit.set(profileId, { count: 1, windowStart: now });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) {
    return false;
  }
  entry.count++;
  return true;
}

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

/**
 * POST /storage/uploads/request-url
 *
 * Request a presigned URL for file upload.
 * The client sends JSON metadata (name, size, contentType) — NOT the file.
 * Then uploads the file directly to the returned presigned URL.
 *
 * Requires a completed profile so the returned uploadToken is cryptographically
 * bound to the caller's profileId, preventing foreign-path injection attacks.
 *
 * Issues a single-use, short-lived upload token (HMAC, no DB round-trip).
 */
router.post("/storage/uploads/request-url", requireProfile, async (req: Request, res: Response) => {
  const parsed = RequestUploadUrlBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Missing or invalid required fields" });
    return;
  }

  try {
    const { name, size, contentType } = parsed.data;
    const profile = getRequestProfile(req);

    if (!checkUploadRateLimit(String(profile.id))) {
      res.status(429).json({ error: "Too many upload requests. Please wait before requesting another upload URL." });
      return;
    }

    const uploadURL = await objectStorageService.getObjectEntityUploadURL();
    const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);

    const uploadToken = issueUploadToken({
      objectPath,
      profileId: String(profile.id),
      maxSize: size,
      contentType,
      issuedAt: Math.floor(Date.now() / 1000),
    });

    res.json({ uploadURL, objectPath, uploadToken, metadata: { name, size, contentType } });
  } catch (error) {
    req.log.error({ err: error }, "Error generating upload URL");
    res.status(500).json({ error: "Failed to generate upload URL" });
  }
});

/**
 * POST /storage/uploads/finalize
 *
 * After the client has PUT the file to the presigned URL, call this endpoint to:
 * 1. Verify the uploadToken (HMAC, single-use).
 * 2. Fetch actual object metadata from GCS and validate size + content-type.
 * 3. Delete bad objects immediately.
 * 4. Issue a storageToken (with GCS generation) for use in PUT /driver-docs/:docType.
 */
router.post("/storage/uploads/finalize", requireProfile, async (req: Request, res: Response) => {
  const parsed = FinalizeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Missing or invalid required fields" });
    return;
  }

  const { uploadToken, objectPath } = parsed.data;
  const profile = getRequestProfile(req);

  if (isUploadTokenConsumed(uploadToken)) {
    res.status(403).json({ error: "Upload token has already been used" });
    return;
  }

  const tokenResult = verifyUploadToken(uploadToken, String(profile.id), objectPath);
  if (!tokenResult.ok) {
    res.status(403).json({ error: "Invalid or expired upload token", reason: tokenResult.error });
    return;
  }

  const { maxSize, contentType: declaredContentType } = tokenResult.payload;

  let objectFile;
  try {
    objectFile = await objectStorageService.getObjectEntityFile(objectPath);
  } catch (err) {
    if (err instanceof ObjectNotFoundError) {
      res.status(422).json({ error: "Uploaded object not found in storage — upload may not have completed" });
    } else {
      res.status(500).json({ error: "Failed to verify uploaded object" });
    }
    return;
  }

  const [metadata] = await objectFile.getMetadata();
  const actualSize = Number(metadata.size ?? 0);
  const actualContentType: string = (metadata.contentType as string) || "";

  if (actualSize > maxSize) {
    try { await objectFile.delete(); } catch (delErr) {
      req.log.warn({ err: delErr, objectPath }, "Failed to delete oversized upload");
    }
    res.status(422).json({
      error: "Uploaded file exceeds the declared size limit",
      maxSize,
      actualSize,
    });
    return;
  }

  const normalizedDeclared = declaredContentType.split(";")[0].trim().toLowerCase();
  const normalizedActual = actualContentType.split(";")[0].trim().toLowerCase();
  if (normalizedActual && normalizedDeclared && normalizedActual !== normalizedDeclared) {
    try { await objectFile.delete(); } catch (delErr) {
      req.log.warn({ err: delErr, objectPath }, "Failed to delete content-type mismatch upload");
    }
    res.status(422).json({
      error: "Uploaded file content type does not match the declared type",
      declared: declaredContentType,
      actual: actualContentType,
    });
    return;
  }

  markUploadTokenConsumed(uploadToken);

  const generation = String(metadata.generation ?? "");

  const storageToken = issueStorageToken({
    objectPath,
    profileId: String(profile.id),
    issuedAt: Math.floor(Date.now() / 1000),
    generation,
  });

  res.json({ storageToken, objectPath });
});

/**
 * GET /storage/public-objects/*
 *
 * Serve public assets from PUBLIC_OBJECT_SEARCH_PATHS.
 * These are unconditionally public — no authentication or ACL checks.
 * IMPORTANT: Always provide this endpoint when object storage is set up.
 */
router.get("/storage/public-objects/*filePath", async (req: Request, res: Response) => {
  try {
    const raw = req.params.filePath;
    const filePath = Array.isArray(raw) ? raw.join("/") : raw;
    const file = await objectStorageService.searchPublicObject(filePath);
    if (!file) {
      res.status(404).json({ error: "File not found" });
      return;
    }

    const response = await objectStorageService.downloadObject(file);

    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));

    if (response.body) {
      const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    req.log.error({ err: error }, "Error serving public object");
    res.status(500).json({ error: "Failed to serve public object" });
  }
});

/**
 * GET /storage/objects/*
 *
 * Serve object entities from PRIVATE_OBJECT_DIR.
 * These are served from a separate path from /public-objects and can optionally
 * be protected with authentication or ACL checks based on the use case.
 */
router.get("/storage/objects/*path", requireProfile, async (req: Request, res: Response) => {
  try {
    const raw = req.params.path;
    const wildcardPath = Array.isArray(raw) ? raw.join("/") : raw;
    const objectPath = `/objects/${wildcardPath}`;

    // ACL: caller must own a driver_documents row that references this object.
    const profile = getRequestProfile(req);
    const [owned] = await db.select({ id: driverDocumentsTable.id })
      .from(driverDocumentsTable)
      .where(and(
        eq(driverDocumentsTable.profileId, profile.id),
        eq(driverDocumentsTable.objectPath, objectPath),
      ));
    if (!owned) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const objectFile = await objectStorageService.getObjectEntityFile(objectPath);
    const response = await objectStorageService.downloadObject(objectFile);

    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));

    if (response.body) {
      const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      req.log.warn({ err: error }, "Object not found");
      res.status(404).json({ error: "Object not found" });
      return;
    }
    req.log.error({ err: error }, "Error serving object");
    res.status(500).json({ error: "Failed to serve object" });
  }
});

export default router;
