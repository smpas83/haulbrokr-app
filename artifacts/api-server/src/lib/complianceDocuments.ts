import type {
  ComplianceDocument,
  ComplianceOwnerType,
  ComplianceStatus,
} from "@workspace/db";
import {
  COMPLIANCE_VENDOR_DOC_TYPES,
  COMPLIANCE_DRIVER_DOC_TYPES,
  COMPLIANCE_FLEET_DOC_TYPES,
} from "@workspace/db";

/**
 * Pure compliance logic: status/expiration computation, summaries, and the
 * blocking rules that gate jobs, dispatches, and truck assignment. Kept free of
 * DB access so it can be unit-tested in isolation and reused everywhere.
 */

// Required document types per owner. A subject is only "compliant" once every
// required doc is approved and unexpired. Other doc types are optional extras.
export const REQUIRED_VENDOR_DOC_TYPES = [
  "w9",
  "coi",
  "insurance",
  "dot_authority",
] as const;

export const REQUIRED_DRIVER_DOC_TYPES = [
  "cdl",
  "medical_certificate",
  "driver_license",
  "insurance",
] as const;

export const REQUIRED_FLEET_DOC_TYPES = [
  "truck_registration",
  "insurance",
] as const;

export function allDocTypesForOwner(
  ownerType: ComplianceOwnerType,
): readonly string[] {
  switch (ownerType) {
    case "vendor":
      return COMPLIANCE_VENDOR_DOC_TYPES;
    case "driver":
      return COMPLIANCE_DRIVER_DOC_TYPES;
    case "fleet":
      return COMPLIANCE_FLEET_DOC_TYPES;
  }
}

export function requiredDocTypesForOwner(
  ownerType: ComplianceOwnerType,
): readonly string[] {
  switch (ownerType) {
    case "vendor":
      return REQUIRED_VENDOR_DOC_TYPES;
    case "driver":
      return REQUIRED_DRIVER_DOC_TYPES;
    case "fleet":
      return REQUIRED_FLEET_DOC_TYPES;
  }
}

export function isValidDocTypeForOwner(
  ownerType: ComplianceOwnerType,
  docType: string,
): boolean {
  return allDocTypesForOwner(ownerType).includes(docType);
}

type DocLike = Pick<ComplianceDocument, "status" | "expiresAt">;

/**
 * Effective status for a single document. An approved document whose expiry has
 * passed is reported as `expired` even if the stored status has not yet been
 * swept. Already-terminal stored statuses are returned as-is.
 */
export function effectiveStatus(
  doc: DocLike,
  now: Date = new Date(),
): ComplianceStatus {
  const stored = doc.status as ComplianceStatus;
  if (stored === "approved" && isExpired(doc, now)) {
    return "expired";
  }
  return stored;
}

export function isExpired(doc: DocLike, now: Date = new Date()): boolean {
  if (!doc.expiresAt) return false;
  return new Date(doc.expiresAt).getTime() <= now.getTime();
}

/** True when the document expires within `days` of `now` (and is not already expired). */
export function isExpiringWithin(
  doc: DocLike,
  days: number,
  now: Date = new Date(),
): boolean {
  if (!doc.expiresAt) return false;
  const expiry = new Date(doc.expiresAt).getTime();
  const horizon = now.getTime() + days * 24 * 60 * 60 * 1000;
  return expiry > now.getTime() && expiry <= horizon;
}

export interface DocTypeStatus {
  docType: string;
  required: boolean;
  present: boolean;
  status: ComplianceStatus | "missing";
  expiresAt: Date | null;
  documentId: number | null;
}

export interface ComplianceSummary {
  ownerType: ComplianceOwnerType;
  documents: DocTypeStatus[];
  missingRequired: string[];
  expiredRequired: string[];
  pendingRequired: string[];
  rejectedRequired: string[];
  /** Every required doc is approved and unexpired. */
  compliant: boolean;
}

/**
 * Build a per-doc-type summary from the current-version documents of a subject.
 * Only the latest version of each doc type is considered.
 */
export function summarizeCompliance(
  ownerType: ComplianceOwnerType,
  currentDocuments: ComplianceDocument[],
  now: Date = new Date(),
): ComplianceSummary {
  const required = requiredDocTypesForOwner(ownerType);
  const byType = new Map<string, ComplianceDocument>();
  for (const doc of currentDocuments) {
    // Defensive: keep the highest version if multiple "current" rows slip in.
    const existing = byType.get(doc.docType);
    if (!existing || (doc.version ?? 0) > (existing.version ?? 0)) {
      byType.set(doc.docType, doc);
    }
  }

  const docTypes = new Set<string>([
    ...allDocTypesForOwner(ownerType),
    ...byType.keys(),
  ]);

  const documents: DocTypeStatus[] = [];
  for (const docType of docTypes) {
    const doc = byType.get(docType);
    documents.push({
      docType,
      required: required.includes(docType),
      present: !!doc,
      status: doc ? effectiveStatus(doc, now) : "missing",
      expiresAt: doc?.expiresAt ? new Date(doc.expiresAt) : null,
      documentId: doc?.id ?? null,
    });
  }
  documents.sort((a, b) => {
    if (a.required !== b.required) return a.required ? -1 : 1;
    return a.docType.localeCompare(b.docType);
  });

  const missingRequired: string[] = [];
  const expiredRequired: string[] = [];
  const pendingRequired: string[] = [];
  const rejectedRequired: string[] = [];

  for (const docType of required) {
    const doc = byType.get(docType);
    if (!doc) {
      missingRequired.push(docType);
      continue;
    }
    const status = effectiveStatus(doc, now);
    if (status === "expired") expiredRequired.push(docType);
    else if (status === "pending" || status === "needs_update")
      pendingRequired.push(docType);
    else if (status === "rejected") rejectedRequired.push(docType);
  }

  const compliant =
    missingRequired.length === 0 &&
    expiredRequired.length === 0 &&
    pendingRequired.length === 0 &&
    rejectedRequired.length === 0;

  return {
    ownerType,
    documents,
    missingRequired,
    expiredRequired,
    pendingRequired,
    rejectedRequired,
    compliant,
  };
}

/**
 * Required doc types whose current version is approved-but-expired. Uses only
 * the local required-type constants (no DB-derived taxonomy), so it is safe to
 * call from hot paths like job acceptance regardless of how `@workspace/db` is
 * mocked in tests.
 */
export function expiredRequiredDocTypes(
  ownerType: ComplianceOwnerType,
  currentDocuments: ComplianceDocument[],
  now: Date = new Date(),
): string[] {
  const required = requiredDocTypesForOwner(ownerType);
  const byType = new Map<string, ComplianceDocument>();
  for (const doc of currentDocuments) {
    const existing = byType.get(doc.docType);
    if (!existing || (doc.version ?? 0) > (existing.version ?? 0)) {
      byType.set(doc.docType, doc);
    }
  }
  const out: string[] = [];
  for (const docType of required) {
    const doc = byType.get(docType);
    if (doc && effectiveStatus(doc, now) === "expired") out.push(docType);
  }
  return out;
}

export interface BlockingResult {
  allowed: boolean;
  blockers: string[];
}

function blockersFromSummary(summary: ComplianceSummary): string[] {
  const blockers: string[] = [];
  for (const t of summary.expiredRequired) blockers.push(`${t} expired`);
  for (const t of summary.missingRequired) blockers.push(`${t} missing`);
  for (const t of summary.rejectedRequired) blockers.push(`${t} rejected`);
  for (const t of summary.pendingRequired)
    blockers.push(`${t} awaiting approval`);
  return blockers;
}

/** Drivers with expired/missing/unapproved required documents cannot accept jobs. */
export function driverCanAcceptJobs(
  currentDocuments: ComplianceDocument[],
  now: Date = new Date(),
): BlockingResult {
  const summary = summarizeCompliance("driver", currentDocuments, now);
  return { allowed: summary.compliant, blockers: blockersFromSummary(summary) };
}

/** Vendors without fully approved compliance cannot receive dispatches. */
export function vendorCanReceiveDispatch(
  currentDocuments: ComplianceDocument[],
  now: Date = new Date(),
): BlockingResult {
  const summary = summarizeCompliance("vendor", currentDocuments, now);
  return { allowed: summary.compliant, blockers: blockersFromSummary(summary) };
}

/** Trucks with expired/missing registration or insurance cannot be assigned. */
export function truckCanBeAssigned(
  currentDocuments: ComplianceDocument[],
  now: Date = new Date(),
): BlockingResult {
  const summary = summarizeCompliance("fleet", currentDocuments, now);
  return { allowed: summary.compliant, blockers: blockersFromSummary(summary) };
}
