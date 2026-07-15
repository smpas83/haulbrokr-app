import { and, eq, inArray, desc, sql } from "drizzle-orm";
import {
  db,
  profilesTable,
  driverDocumentsTable,
  w9SubmissionsTable,
  insuranceSubmissionsTable,
  dotCdlTable,
  payoutAccountsTable,
  trucksTable,
  type Profile,
} from "@workspace/db";
import { computeProviderCanBid } from "./providerCompliance";

export type OnboardingStepStatus = "complete" | "pending" | "missing" | "rejected" | "n/a";

export interface CarrierOnboardingTrace {
  carrier: string;
  profileId: number;
  email: string | null;
  role: string;
  created: string;
  lastActivity: string;
  profileComplete: boolean;
  truckAdded: boolean;
  insuranceUploaded: OnboardingStepStatus;
  w9Uploaded: OnboardingStepStatus;
  coiUploaded: OnboardingStepStatus;
  w9Form: OnboardingStepStatus;
  insuranceForm: OnboardingStepStatus;
  dotVerified: OnboardingStepStatus;
  payoutReady: OnboardingStepStatus;
  storageFileExists: boolean;
  databaseRecordExists: boolean;
  adminCanSeeIt: boolean;
  documentCount: number;
  pendingDocumentCount: number;
  verifiedDocumentCount: number;
  canBid: boolean;
  overallStatus: string;
  reasonBlocked: string | null;
  stepsComplete: number;
  stepsTotal: number;
  nextAction: string;
}

function formStatus(status: string | undefined | null): OnboardingStepStatus {
  if (!status || status === "not_submitted") return "missing";
  if (status === "pending") return "pending";
  if (status === "verified") return "complete";
  if (status === "rejected") return "rejected";
  return "missing";
}

function fileStatus(status: string | undefined | null): OnboardingStepStatus {
  if (!status || status === "missing") return "missing";
  if (status === "uploaded") return "pending";
  if (status === "verified") return "complete";
  if (status === "rejected") return "rejected";
  return "missing";
}

function profileLooksComplete(p: Profile): boolean {
  return !!(
    p.companyName?.trim()
    && p.contactName?.trim()
    && p.email?.trim()
    && p.phone?.trim()
    && p.city?.trim()
    && p.state?.trim()
  );
}

export async function buildCarrierOnboardingTrace(profile: Profile): Promise<CarrierOnboardingTrace> {
  const [w9, insurance, dotCdl, payout, docs, trucks] = await Promise.all([
    db.select().from(w9SubmissionsTable).where(eq(w9SubmissionsTable.profileId, profile.id)).then((r) => r[0]),
    db.select().from(insuranceSubmissionsTable).where(eq(insuranceSubmissionsTable.profileId, profile.id)).then((r) => r[0]),
    db.select().from(dotCdlTable).where(eq(dotCdlTable.profileId, profile.id)).then((r) => r[0]),
    db.select().from(payoutAccountsTable).where(eq(payoutAccountsTable.profileId, profile.id)).then((r) => r[0]),
    db.select().from(driverDocumentsTable).where(eq(driverDocumentsTable.profileId, profile.id)),
    db.select({ id: trucksTable.id }).from(trucksTable).where(eq(trucksTable.ownerId, profile.id)).limit(1),
  ]);

  const docsWithFiles = docs.filter((d) => d.status !== "missing" && d.objectPath);
  const w9File = docs.find((d) => d.docType === "w9");
  const coiFile = docs.find((d) => d.docType === "coi");

  const w9Form = formStatus(w9?.status);
  const insuranceForm = formStatus(insurance?.status);
  const w9Uploaded = fileStatus(w9File?.status);
  const coiUploaded = fileStatus(coiFile?.status);
  // Insurance "uploaded" = COI file OR insurance form submitted
  const insuranceUploaded: OnboardingStepStatus =
    coiUploaded !== "missing" ? coiUploaded : insuranceForm;
  const dotVerified = formStatus(dotCdl?.status);
  const payoutReady = formStatus(payout?.status);

  const profileComplete = profileLooksComplete(profile);
  const truckAdded = trucks.length > 0;
  const databaseRecordExists = docsWithFiles.length > 0 || !!w9 || !!insurance || !!dotCdl;
  const storageFileExists = docsWithFiles.length > 0;
  const adminCanSeeIt = databaseRecordExists; // admin queries same tables
  const canBid = computeProviderCanBid({
    role: profile.role,
    w9Status: w9?.status ?? "not_submitted",
    insuranceStatus: insurance?.status ?? "not_submitted",
    dotCdlStatus: dotCdl?.status,
    payoutStatus: payout?.status ?? "not_submitted",
  });

  const steps: { ok: boolean; label: string }[] = [
    { ok: profileComplete, label: "Complete company profile" },
    { ok: truckAdded, label: "Add at least one truck" },
    { ok: w9Form === "complete" || w9Uploaded === "complete", label: "W-9 verified" },
    { ok: insuranceForm === "complete" || coiUploaded === "complete", label: "Insurance / COI verified" },
    { ok: dotVerified === "complete", label: "DOT / CDL verified" },
    { ok: payoutReady === "complete", label: "Payout account verified" },
  ];
  // Count pending (submitted but not verified) as progress toward completion for "save work"
  const submittedSteps = [
    profileComplete,
    truckAdded,
    w9Form !== "missing" || w9Uploaded !== "missing",
    insuranceForm !== "missing" || coiUploaded !== "missing",
    dotVerified !== "missing",
    payoutReady !== "missing",
  ];

  const stepsComplete = steps.filter((s) => s.ok).length;
  const stepsTotal = steps.length;
  const nextMissing = steps.find((s) => !s.ok);

  let overallStatus: string;
  let reasonBlocked: string | null = null;
  if (canBid) {
    overallStatus = "READY_TO_BID";
  } else if (submittedSteps.every(Boolean) && stepsComplete < stepsTotal) {
    overallStatus = "AWAITING_ADMIN_REVIEW";
    reasonBlocked = nextMissing?.label ?? "Awaiting admin verification";
  } else if (!profileComplete) {
    overallStatus = "STUCK_AT_PROFILE";
    reasonBlocked = "Company profile incomplete";
  } else if (w9Form === "missing" && w9Uploaded === "missing") {
    overallStatus = "STUCK_AT_W9";
    reasonBlocked = "W-9 not submitted or uploaded";
  } else if (insuranceForm === "missing" && coiUploaded === "missing") {
    overallStatus = "STUCK_AT_INSURANCE";
    reasonBlocked = "Insurance / COI not submitted or uploaded";
  } else if (dotVerified === "missing") {
    overallStatus = "STUCK_AT_DOT";
    reasonBlocked = "DOT / CDL not submitted";
  } else if (payoutReady === "missing") {
    overallStatus = "STUCK_AT_PAYOUT";
    reasonBlocked = "Payout account not connected";
  } else if (!truckAdded) {
    overallStatus = "STUCK_AT_FLEET";
    reasonBlocked = "No truck added to fleet";
  } else {
    overallStatus = "IN_PROGRESS";
    reasonBlocked = nextMissing?.label ?? "Onboarding incomplete";
  }

  const nextAction = canBid
    ? "Ready — can bid on loads"
    : (nextMissing?.label ? `Carrier should: ${nextMissing.label}` : "Awaiting admin review");

  return {
    carrier: profile.companyName || profile.contactName || `profile#${profile.id}`,
    profileId: profile.id,
    email: profile.email ?? null,
    role: profile.role,
    created: profile.createdAt.toISOString(),
    lastActivity: profile.updatedAt.toISOString(),
    profileComplete,
    truckAdded,
    insuranceUploaded,
    w9Uploaded,
    coiUploaded,
    w9Form,
    insuranceForm,
    dotVerified,
    payoutReady,
    storageFileExists,
    databaseRecordExists,
    adminCanSeeIt,
    documentCount: docsWithFiles.length,
    pendingDocumentCount: docs.filter((d) => d.status === "uploaded").length,
    verifiedDocumentCount: docs.filter((d) => d.status === "verified").length,
    canBid,
    overallStatus,
    reasonBlocked,
    stepsComplete,
    stepsTotal,
    nextAction,
  };
}

export async function listProviderOnboardingTraces(): Promise<CarrierOnboardingTrace[]> {
  const providers = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.role, "provider"))
    .orderBy(desc(profilesTable.createdAt));

  const traces: CarrierOnboardingTrace[] = [];
  // Batch in chunks to avoid overwhelming the DB with N+1 — still simple & correct.
  for (const profile of providers) {
    traces.push(await buildCarrierOnboardingTrace(profile));
  }
  return traces;
}

/**
 * When a carrier uploads a W-9 or COI *file*, mark the matching form row as
 * pending if it exists and is still not_submitted/rejected — so admin
 * pendingCompliance and bidding gates stay in sync with file uploads.
 * Does not invent form rows (forms require structured fields).
 */
export async function syncFormPendingFromFileUpload(
  profileId: number,
  docType: string,
): Promise<void> {
  if (docType === "w9") {
    await db
      .update(w9SubmissionsTable)
      .set({ status: "pending" })
      .where(and(
        eq(w9SubmissionsTable.profileId, profileId),
        inArray(w9SubmissionsTable.status, ["not_submitted", "rejected"]),
      ));
    return;
  }
  if (docType === "coi") {
    await db
      .update(insuranceSubmissionsTable)
      .set({ status: "pending" })
      .where(and(
        eq(insuranceSubmissionsTable.profileId, profileId),
        inArray(insuranceSubmissionsTable.status, ["not_submitted", "rejected"]),
      ));
  }
}

/** Overview helper: pending form rows + uploaded (unreviewed) files. */
export async function countPendingComplianceWork(): Promise<{
  formPending: number;
  documentsPending: number;
  documentsVerified: number;
  documentsExpired: number;
  totalPending: number;
}> {
  const [dotPendingAgg, w9PendingAgg, insurancePendingAgg, docsPendingAgg, docsVerifiedAgg, docsExpiredAgg] =
    await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(dotCdlTable).where(eq(dotCdlTable.status, "pending")),
      db.select({ count: sql<number>`count(*)` }).from(w9SubmissionsTable).where(eq(w9SubmissionsTable.status, "pending")),
      db.select({ count: sql<number>`count(*)` }).from(insuranceSubmissionsTable).where(eq(insuranceSubmissionsTable.status, "pending")),
      db.select({ count: sql<number>`count(*)` }).from(driverDocumentsTable).where(eq(driverDocumentsTable.status, "uploaded")),
      db.select({ count: sql<number>`count(*)` }).from(driverDocumentsTable).where(eq(driverDocumentsTable.status, "verified")),
      db.select({ count: sql<number>`count(*)` }).from(driverDocumentsTable)
        .where(sql`${driverDocumentsTable.expiry} is not null and ${driverDocumentsTable.expiry} < now()`),
    ]);

  const formPending =
    Number(dotPendingAgg[0]?.count ?? 0)
    + Number(w9PendingAgg[0]?.count ?? 0)
    + Number(insurancePendingAgg[0]?.count ?? 0);
  const documentsPending = Number(docsPendingAgg[0]?.count ?? 0);
  const documentsVerified = Number(docsVerifiedAgg[0]?.count ?? 0);
  const documentsExpired = Number(docsExpiredAgg[0]?.count ?? 0);

  return {
    formPending,
    documentsPending,
    documentsVerified,
    documentsExpired,
    // Union of work queues (forms + uploaded files awaiting approval).
    totalPending: formPending + documentsPending,
  };
}
