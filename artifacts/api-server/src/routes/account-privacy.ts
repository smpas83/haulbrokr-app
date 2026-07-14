import { Router, type IRouter } from "express";
import { and, desc, eq } from "drizzle-orm";
import { accountDeletionRequestsTable, db } from "@workspace/db";
import {
  getRequestProfile,
  requireAuth,
  requireProfile,
} from "../middlewares/requireAuth";
import {
  DELETION_CONFIRMATION_PHRASE,
  deleteAccountForClerkUser,
  hashClerkId,
  previewAccountDeletion,
  resumeAccountDeletion,
} from "../lib/deleteAccount";
import {
  createSignedExportDownloadUrl,
  getDataExportForProfile,
  listDataExports,
  processDataExport,
  requestDataExport,
} from "../lib/dataExport";
import { logger } from "../lib/logger";

const router: IRouter = Router();

function authAgeSeconds(req: {
  auth?: { sessionClaims?: Record<string, unknown> };
  headers: Record<string, unknown>;
}): number | null {
  // Clerk session claim iat when available; fallback header for mobile reauth confirmation.
  const claims = req.auth?.sessionClaims;
  const iat = typeof claims?.iat === "number" ? claims.iat : null;
  if (iat) return Math.max(0, Math.floor(Date.now() / 1000) - iat);
  const header = req.headers["x-reauth-confirmed"];
  if (header === "1" || header === "true") return 0;
  return null;
}

// ── Account deletion ──────────────────────────────────────────────────────────

router.get(
  "/account/deletion/preview",
  requireProfile,
  async (req, res): Promise<void> => {
    const profile = getRequestProfile(req);
    const preview = await previewAccountDeletion(profile.id);
    res.json(preview);
  },
);

router.get(
  "/account/deletion",
  requireProfile,
  async (req, res): Promise<void> => {
    const profile = getRequestProfile(req);
    const [row] = await db
      .select()
      .from(accountDeletionRequestsTable)
      .where(eq(accountDeletionRequestsTable.profileId, profile.id))
      .orderBy(desc(accountDeletionRequestsTable.requestedAt))
      .limit(1);
    res.json(row ?? null);
  },
);

/**
 * Confirm and execute account deletion.
 * Body: { confirmation: "DELETE", dryRun?: boolean }
 * Requires recent authentication (session age < 10 minutes) or x-reauth-confirmed.
 */
router.post(
  "/account/deletion",
  requireAuth,
  requireProfile,
  async (req, res): Promise<void> => {
    const profile = getRequestProfile(req);
    const confirmation = String(req.body?.confirmation ?? "").trim();
    const dryRun = Boolean(req.body?.dryRun);

    if (confirmation !== DELETION_CONFIRMATION_PHRASE) {
      res.status(400).json({
        error: `Confirmation phrase must be exactly "${DELETION_CONFIRMATION_PHRASE}"`,
        preview: await previewAccountDeletion(profile.id),
      });
      return;
    }

    const age = authAgeSeconds(req as any);
    if (age == null || age > 600) {
      res.status(401).json({
        error:
          "Recent authentication required. Sign in again, then confirm deletion.",
        code: "REAUTH_REQUIRED",
      });
      return;
    }

    const preview = await previewAccountDeletion(profile.id);
    if (preview.blockedReason) {
      const [blocked] = await db
        .insert(accountDeletionRequestsTable)
        .values({
          profileId: profile.id,
          clerkIdHash: hashClerkId(req.clerkId as string),
          status: "blocked_owner",
          blockReason: preview.blockedReason,
          confirmationPhrase: DELETION_CONFIRMATION_PHRASE,
          confirmedAt: new Date(),
        })
        .returning();
      res.status(409).json({
        error: preview.blockedReason,
        code: "OWNERSHIP_TRANSFER_REQUIRED",
        deletionRequest: blocked,
        preview,
      });
      return;
    }

    const [deletionRequest] = await db
      .insert(accountDeletionRequestsTable)
      .values({
        profileId: profile.id,
        clerkIdHash: hashClerkId(req.clerkId as string),
        status: dryRun ? "requested" : "processing",
        confirmationPhrase: DELETION_CONFIRMATION_PHRASE,
        confirmedAt: new Date(),
      })
      .returning();

    try {
      const result = await deleteAccountForClerkUser(req.clerkId as string, {
        deletionRequestId: dryRun ? undefined : deletionRequest.id,
        dryRun,
      });

      if (dryRun) {
        await db
          .update(accountDeletionRequestsTable)
          .set({ status: "requested", stepsCompleted: ["dry_run_ok"] })
          .where(eq(accountDeletionRequestsTable.id, deletionRequest.id));
        res.json({
          dryRun: true,
          ok: true,
          preview,
          deletionRequestId: deletionRequest.id,
          result,
        });
        return;
      }

      res.json({
        deleted: true,
        clerkDeleted: result.clerkDeleted,
        deletionRequestId: result.deletionRequestId,
        preview,
      });
    } catch (err) {
      const code = (err as { code?: string }).code;
      logger.error({ err, profileId: profile.id }, "Account deletion failed");
      if (code === "OWNERSHIP_TRANSFER_REQUIRED") {
        res.status(409).json({ error: (err as Error).message, code, preview });
        return;
      }
      res.status(500).json({
        error: err instanceof Error ? err.message : "Account deletion failed",
        code: "DELETION_FAILED",
        deletionRequestId: deletionRequest.id,
        resumable: true,
      });
    }
  },
);

/** Resume a failed deletion (compensating cleanup). */
router.post(
  "/account/deletion/resume",
  requireAuth,
  requireProfile,
  async (req, res): Promise<void> => {
    const profile = getRequestProfile(req);
    const id = Number(req.body?.deletionRequestId);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: "deletionRequestId is required" });
      return;
    }
    const [row] = await db
      .select()
      .from(accountDeletionRequestsTable)
      .where(
        and(
          eq(accountDeletionRequestsTable.id, id),
          eq(accountDeletionRequestsTable.profileId, profile.id),
        ),
      );
    if (!row) {
      res.status(404).json({ error: "Deletion request not found" });
      return;
    }
    try {
      const result = await resumeAccountDeletion(id);
      res.json(result);
    } catch (err) {
      res
        .status(500)
        .json({
          error: err instanceof Error ? err.message : "Resume failed",
          resumable: true,
        });
    }
  },
);

// Legacy App Store path — same semantics as POST /account/deletion
router.delete("/profiles/me", requireAuth, async (req, res): Promise<void> => {
  const clerkId = req.clerkId as string;
  try {
    // Soft gate: DELETE without confirmation still requires an explicit header for safety.
    if (req.headers["x-confirm-delete"] !== "DELETE") {
      res.status(400).json({
        error:
          "Send header X-Confirm-Delete: DELETE and prefer POST /account/deletion with confirmation body.",
        code: "CONFIRMATION_REQUIRED",
      });
      return;
    }
    const result = await deleteAccountForClerkUser(clerkId);
    res.status(200).json(result);
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "OWNERSHIP_TRANSFER_REQUIRED") {
      res.status(409).json({ error: (err as Error).message, code });
      return;
    }
    logger.error({ err }, "DELETE /profiles/me failed");
    res
      .status(500)
      .json({
        error: err instanceof Error ? err.message : "Account deletion failed",
      });
  }
});

// ── Data export ───────────────────────────────────────────────────────────────

router.post(
  "/account/export",
  requireProfile,
  async (req, res): Promise<void> => {
    const profile = getRequestProfile(req);
    try {
      const row = await requestDataExport(profile.id);
      // Give async processing a brief head-start for small accounts in test/dev.
      if (process.env.DATA_EXPORT_SYNC === "1") {
        await processDataExport(row.id);
        const fresh = await getDataExportForProfile(row.id, profile.id);
        res.status(201).json(fresh ?? row);
        return;
      }
      res.status(202).json(row);
    } catch (err) {
      if ((err as { code?: string }).code === "EXPORT_LIMIT") {
        res.status(429).json({ error: (err as Error).message });
        return;
      }
      logger.error({ err }, "Export request failed");
      res
        .status(500)
        .json({
          error: err instanceof Error ? err.message : "Export request failed",
        });
    }
  },
);

router.get(
  "/account/export",
  requireProfile,
  async (req, res): Promise<void> => {
    const profile = getRequestProfile(req);
    const rows = await listDataExports(profile.id);
    res.json(rows);
  },
);

router.get(
  "/account/export/:id",
  requireProfile,
  async (req, res): Promise<void> => {
    const profile = getRequestProfile(req);
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: "Invalid export id" });
      return;
    }
    const row = await getDataExportForProfile(id, profile.id);
    if (!row) {
      res.status(404).json({ error: "Export not found" });
      return;
    }
    res.json(row);
  },
);

router.get(
  "/account/export/:id/download",
  requireProfile,
  async (req, res): Promise<void> => {
    const profile = getRequestProfile(req);
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: "Invalid export id" });
      return;
    }
    try {
      const signed = await createSignedExportDownloadUrl(id, profile.id);
      res.json(signed);
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === "NOT_FOUND") {
        res.status(404).json({ error: (err as Error).message });
        return;
      }
      if (code === "NOT_READY") {
        res.status(409).json({ error: (err as Error).message });
        return;
      }
      if (code === "EXPIRED") {
        res.status(410).json({ error: (err as Error).message });
        return;
      }
      // Authorization / org isolation: wrong profile already 404 above.
      logger.error(
        { err, exportId: id, profileId: profile.id },
        "Export download failed",
      );
      res.status(500).json({ error: "Failed to create download URL" });
    }
  },
);

export default router;
