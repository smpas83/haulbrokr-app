import { and, eq, inArray } from "drizzle-orm";
import {
  complianceAuditLogsTable,
  complianceDocumentVersionsTable,
  complianceDocumentsTable,
  complianceEventsTable,
  db,
  profilesTable,
  trucksTable,
  type ComplianceDocument,
  type Profile,
} from "@workspace/db";
import { isAdmin } from "../middlewares/requireAdmin";

export type ComplianceDocumentType = typeof complianceDocumentsTable.$inferInsert.documentType;
export type ComplianceStatus = "pending" | "approved" | "rejected" | "expired" | "needs_update";
export type ExpirationBucket = "expired" | "expiring_7" | "expiring_14" | "expiring_30" | "valid" | "no_expiration";

export const REQUIRED_VENDOR_DOCUMENTS: ComplianceDocumentType[] = [
  "w9",
  "coi",
  "dot_authority",
  "mc_number",
  "usdot_number",
  "business_registration",
];

export const REQUIRED_DRIVER_DOCUMENTS: ComplianceDocumentType[] = [
  "cdl",
  "medical_certificate",
  "driver_license",
  "insurance",
  "dot_document",
];

export const REQUIRED_TRUCK_DOCUMENTS: ComplianceDocumentType[] = [
  "truck_registration",
  "truck_insurance",
  "inspection",
];

export function expirationBucket(expiresAt: Date | null | undefined, now = new Date()): ExpirationBucket {
  if (!expiresAt) return "no_expiration";
  const diffMs = expiresAt.getTime() - now.getTime();
  if (diffMs < 0) return "expired";
  const days = Math.ceil(diffMs / (24 * 60 * 60 * 1000));
  if (days <= 7) return "expiring_7";
  if (days <= 14) return "expiring_14";
  if (days <= 30) return "expiring_30";
  return "valid";
}

export function effectiveComplianceStatus(doc: ComplianceDocument, now = new Date()): ComplianceStatus {
  if (doc.expiresAt && doc.expiresAt.getTime() < now.getTime()) return "expired";
  return doc.status;
}

export function serializeComplianceDocument(doc: ComplianceDocument, now = new Date()) {
  return {
    ...doc,
    effectiveStatus: effectiveComplianceStatus(doc, now),
    expirationBucket: expirationBucket(doc.expiresAt, now),
  };
}

function statusCounts(docs: ComplianceDocument[], now = new Date()) {
  const counts: Record<ComplianceStatus, number> = {
    pending: 0,
    approved: 0,
    rejected: 0,
    expired: 0,
    needs_update: 0,
  };
  for (const doc of docs) {
    const status = effectiveComplianceStatus(doc, now);
    counts[status] += 1;
  }
  return counts;
}

export function buildComplianceSummary(
  docs: ComplianceDocument[],
  requiredTypes: ComplianceDocumentType[],
  now = new Date(),
) {
  const byType = new Map(docs.map((doc) => [doc.documentType, doc]));
  const missing = requiredTypes.filter((type) => !byType.has(type));
  const expired = docs.filter((doc) => effectiveComplianceStatus(doc, now) === "expired");
  const needsReview = docs.filter((doc) => {
    const status = effectiveComplianceStatus(doc, now);
    return status === "pending" || status === "needs_update";
  });
  const rejected = docs.filter((doc) => effectiveComplianceStatus(doc, now) === "rejected");
  const compliant = missing.length === 0 && expired.length === 0 && needsReview.length === 0 && rejected.length === 0;
  return {
    compliant,
    missing,
    statusCounts: statusCounts(docs, now),
    expirationCounts: docs.reduce<Record<ExpirationBucket, number>>((acc, doc) => {
      const bucket = expirationBucket(doc.expiresAt, now);
      acc[bucket] += 1;
      return acc;
    }, { expired: 0, expiring_7: 0, expiring_14: 0, expiring_30: 0, valid: 0, no_expiration: 0 }),
    documents: docs.map((doc) => serializeComplianceDocument(doc, now)),
  };
}

export async function recordComplianceAudit(input: {
  documentId: number;
  action: typeof complianceAuditLogsTable.$inferInsert.action;
  actorProfileId: number | null;
  previousStatus?: ComplianceStatus | null;
  nextStatus?: ComplianceStatus | null;
  reason?: string | null;
  notes?: string | null;
  metadata?: unknown;
}) {
  await db.insert(complianceAuditLogsTable).values({
    documentId: input.documentId,
    action: input.action,
    actorProfileId: input.actorProfileId,
    previousStatus: input.previousStatus ?? null,
    nextStatus: input.nextStatus ?? null,
    reason: input.reason ?? null,
    notes: input.notes ?? null,
    metadataJson: input.metadata == null ? null : JSON.stringify(input.metadata),
  });
}

export async function createComplianceEvent(input: {
  document: ComplianceDocument;
  eventType: string;
  message: string;
  metadata?: unknown;
}) {
  await db.insert(complianceEventsTable).values({
    documentId: input.document.id,
    profileId: input.document.profileId,
    truckId: input.document.truckId,
    eventType: input.eventType,
    message: input.message,
    metadataJson: input.metadata == null ? null : JSON.stringify(input.metadata),
  });
}

export async function appendDocumentVersion(document: ComplianceDocument, actorProfileId: number, versionNumber?: number) {
  const rows = await db.select().from(complianceDocumentVersionsTable).where(eq(complianceDocumentVersionsTable.documentId, document.id));
  const nextVersion = versionNumber ?? rows.length + 1;
  await db.insert(complianceDocumentVersionsTable).values({
    documentId: document.id,
    versionNumber: nextVersion,
    objectPath: document.objectPath,
    fileName: document.fileName,
    mimeType: document.mimeType,
    documentNumber: document.documentNumber,
    expiresAt: document.expiresAt,
    uploadedByProfileId: actorProfileId,
    uploadedAt: document.uploadedAt,
  });
}

export async function canManageComplianceDocument(
  req: Parameters<typeof isAdmin>[0],
  profile: Profile,
  target: { entityType: "profile" | "truck"; profileId?: number | null; truckId?: number | null },
): Promise<boolean> {
  if (await isAdmin(req)) return true;
  if (profile.role === "customer" || profile.role === "supervisor") return false;

  if (target.entityType === "profile") {
    if (target.profileId === profile.id) return profile.role === "driver" || profile.role === "provider";
    if (profile.role === "provider" && profile.organizationId) {
      const [targetProfile] = await db.select().from(profilesTable).where(eq(profilesTable.id, target.profileId!));
      return targetProfile?.organizationId === profile.organizationId;
    }
    return false;
  }

  if (!target.truckId) return false;
  const [truck] = await db.select().from(trucksTable).where(eq(trucksTable.id, target.truckId));
  return !!truck && truck.ownerId === profile.id && profile.role === "provider";
}

export async function documentsForProfile(profileId: number) {
  return db.select().from(complianceDocumentsTable).where(eq(complianceDocumentsTable.profileId, profileId));
}

export async function documentsForTruckIds(truckIds: number[]) {
  if (truckIds.length === 0) return [];
  return db.select().from(complianceDocumentsTable).where(inArray(complianceDocumentsTable.truckId, truckIds));
}

export async function driverCanAcceptJobs(profileId: number, now = new Date()): Promise<{ ok: boolean; blockers: string[] }> {
  const docs = await documentsForProfile(profileId);
  const summary = buildComplianceSummary(
    docs.filter((doc) => REQUIRED_DRIVER_DOCUMENTS.includes(doc.documentType)),
    REQUIRED_DRIVER_DOCUMENTS,
    now,
  );
  const blockers = [
    ...summary.missing.map((type) => `${type} missing`),
    ...summary.documents
      .filter((doc) => doc.effectiveStatus !== "approved")
      .map((doc) => `${doc.documentType} ${doc.effectiveStatus}`),
  ];
  return { ok: blockers.length === 0, blockers };
}

export async function dashboardCounts(now = new Date()) {
  const docs = await db.select().from(complianceDocumentsTable);
  return {
    total: docs.length,
    pending: docs.filter((doc) => doc.status === "pending").length,
    approved: docs.filter((doc) => doc.status === "approved" && effectiveComplianceStatus(doc, now) === "approved").length,
    rejected: docs.filter((doc) => doc.status === "rejected").length,
    expired: docs.filter((doc) => effectiveComplianceStatus(doc, now) === "expired").length,
    needsUpdate: docs.filter((doc) => doc.status === "needs_update").length,
    expiring30: docs.filter((doc) => ["expiring_7", "expiring_14", "expiring_30"].includes(expirationBucket(doc.expiresAt, now))).length,
  };
}

export async function expiringDocuments(days: 7 | 14 | 30, now = new Date()) {
  const docs = await db.select().from(complianceDocumentsTable);
  return docs.filter((doc) => {
    const bucket = expirationBucket(doc.expiresAt, now);
    if (days === 7) return bucket === "expiring_7";
    if (days === 14) return bucket === "expiring_7" || bucket === "expiring_14";
    return bucket === "expiring_7" || bucket === "expiring_14" || bucket === "expiring_30";
  });
}

export async function expiredDocuments(now = new Date()) {
  const docs = await db.select().from(complianceDocumentsTable);
  return docs.filter((doc) => effectiveComplianceStatus(doc, now) === "expired");
}
