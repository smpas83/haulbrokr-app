import { and, eq, isNotNull, lte } from "drizzle-orm";
import {
  complianceDocumentHistoryTable,
  complianceDocumentsTable,
  db,
} from "@workspace/db";
import type { ComplianceDocument } from "@workspace/db";
import { safeNotify } from "./notifications";
import { logger } from "./logger";

export interface ComplianceExpirationSweepResult {
  checked: number;
  expired: number;
}

async function expireDocument(
  doc: ComplianceDocument,
  now: Date,
): Promise<boolean> {
  const [updated] = await db
    .update(complianceDocumentsTable)
    .set({ status: "expired", updatedAt: now })
    .where(eq(complianceDocumentsTable.id, doc.id))
    .returning();
  if (!updated) return false;

  await db.insert(complianceDocumentHistoryTable).values({
    documentId: doc.id,
    action: "expired",
    fromStatus: doc.status ?? null,
    toStatus: "expired",
    actorProfileId: null,
    version: doc.version ?? null,
    note: "Document expired automatically.",
  });

  if (doc.profileId) {
    await safeNotify({
      recipientProfileId: doc.profileId,
      type: "compliance_expired",
      title: `${doc.docType} expired`,
      body: `Your ${doc.docType} compliance document has expired. Upload a current version to restore eligibility.`,
      relatedType: "compliance_document",
      relatedId: doc.id,
      channels: ["in_app", "email", "sms", "push", "realtime"],
    });
  }

  return true;
}

export async function sweepExpiredComplianceDocuments(
  now: Date = new Date(),
): Promise<ComplianceExpirationSweepResult> {
  const docs = await db
    .select()
    .from(complianceDocumentsTable)
    .where(
      and(
        eq(complianceDocumentsTable.isCurrent, true),
        eq(complianceDocumentsTable.status, "approved"),
        isNotNull(complianceDocumentsTable.expiresAt),
        lte(complianceDocumentsTable.expiresAt, now),
      ),
    );

  let expired = 0;
  for (const doc of docs) {
    try {
      if (await expireDocument(doc, now)) expired += 1;
    } catch (err) {
      logger.error({ err, documentId: doc.id }, "Compliance expiration failed");
    }
  }

  logger.info({ checked: docs.length, expired }, "Compliance expiration sweep complete");
  return { checked: docs.length, expired };
}
