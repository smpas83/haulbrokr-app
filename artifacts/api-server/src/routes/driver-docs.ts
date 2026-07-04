import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { z } from "zod/v4";
import {
  db,
  driverDocumentsTable,
  DRIVER_DOC_TYPES,
  type DriverDocType,
} from "@workspace/db";
import { getRequestProfile, requireProfile } from "../middlewares/requireAuth";
import { verifyStorageToken } from "../lib/uploadToken";
import {
  ObjectStorageService,
  ObjectNotFoundError,
} from "../lib/objectStorage";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

const DocTypeSchema = z.enum(DRIVER_DOC_TYPES);

const UpsertBody = z.object({
  objectPath: z.string().min(1).optional(),
  storageToken: z.string().min(1).optional(),
  fileName: z.string().max(255).optional(),
  mimeType: z.string().max(255).optional(),
  docNumber: z.string().max(255).optional().nullable(),
  expiry: z.string().datetime().optional().nullable(),
});

router.get("/driver-docs", requireProfile, async (req, res): Promise<void> => {
  const profile = getRequestProfile(req);
  const rows = await db
    .select()
    .from(driverDocumentsTable)
    .where(eq(driverDocumentsTable.profileId, profile.id));
  res.json(rows);
});

router.put(
  "/driver-docs/:docType",
  requireProfile,
  async (req, res): Promise<void> => {
    const parsedType = DocTypeSchema.safeParse(req.params.docType);
    if (!parsedType.success) {
      res.status(400).json({ error: "Invalid doc type" });
      return;
    }
    const docType: DriverDocType = parsedType.data;

    const parsed = UpsertBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid body" });
      return;
    }
    const { objectPath, storageToken, fileName, mimeType, docNumber, expiry } =
      parsed.data;

    const profile = getRequestProfile(req);

    if (objectPath !== undefined) {
      if (!storageToken) {
        res.status(400).json({
          error: "storageToken is required when providing objectPath",
        });
        return;
      }

      const tokenResult = verifyStorageToken(
        storageToken,
        String(profile.id),
        objectPath,
      );
      if (!tokenResult.ok) {
        res.status(403).json({
          error: "Invalid or expired storage token",
          reason: tokenResult.error,
        });
        return;
      }

      const { generation: tokenGeneration } = tokenResult.payload;
      if (tokenGeneration) {
        let objectFile;
        try {
          objectFile =
            await objectStorageService.getObjectEntityFile(objectPath);
        } catch (err) {
          if (err instanceof ObjectNotFoundError) {
            res
              .status(422)
              .json({ error: "Document object not found in storage" });
          } else {
            res.status(500).json({ error: "Failed to verify document object" });
          }
          return;
        }

        const [currentMeta] = await objectFile.getMetadata();
        const currentGeneration = String(currentMeta.generation ?? "");
        if (currentGeneration !== tokenGeneration) {
          res.status(409).json({
            error:
              "Document object has been modified since it was verified. Please re-upload.",
          });
          return;
        }
      }
    }

    const [existing] = await db
      .select()
      .from(driverDocumentsTable)
      .where(
        and(
          eq(driverDocumentsTable.profileId, profile.id),
          eq(driverDocumentsTable.docType, docType),
        ),
      );

    const now = new Date();
    const isUpload = objectPath !== undefined;
    const updates: Record<string, any> = {};
    if (objectPath !== undefined) {
      updates.objectPath = objectPath;
      updates.fileName = fileName ?? null;
      updates.mimeType = mimeType ?? null;
      updates.status = "uploaded";
      updates.uploadedAt = now;
      updates.rejectedAt = null;
    }
    if (docNumber !== undefined) updates.docNumber = docNumber;
    if (expiry !== undefined) updates.expiry = expiry ? new Date(expiry) : null;

    if (existing) {
      const [updated] = await db
        .update(driverDocumentsTable)
        .set(updates)
        .where(eq(driverDocumentsTable.id, existing.id))
        .returning();
      res.json(updated);
      return;
    }
    const [created] = await db
      .insert(driverDocumentsTable)
      .values({
        profileId: profile.id,
        docType,
        status: isUpload ? "uploaded" : "missing",
        objectPath: objectPath ?? null,
        fileName: fileName ?? null,
        mimeType: mimeType ?? null,
        docNumber: docNumber ?? null,
        expiry: expiry ? new Date(expiry) : null,
        uploadedAt: isUpload ? now : null,
      })
      .returning();
    res.status(201).json(created);
  },
);

router.delete(
  "/driver-docs/:docType",
  requireProfile,
  async (req, res): Promise<void> => {
    const parsedType = DocTypeSchema.safeParse(req.params.docType);
    if (!parsedType.success) {
      res.status(400).json({ error: "Invalid doc type" });
      return;
    }
    const profile = getRequestProfile(req);
    await db
      .delete(driverDocumentsTable)
      .where(
        and(
          eq(driverDocumentsTable.profileId, profile.id),
          eq(driverDocumentsTable.docType, parsedType.data),
        ),
      );
    res.status(204).end();
  },
);

export default router;
