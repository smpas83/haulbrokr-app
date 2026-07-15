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
  uploadSessionsTable,
  type Profile,
} from "@workspace/db";
import { computeProviderCanBid } from "./providerCompliance";
import {
  buildTimeline,
  classifyFunnelStage,
  completionPercent,
  matchesFunnelFilter,
  type OnboardingFunnelFilter,
  type OnboardingFunnelStage,
  type OnboardingTimelineEvent,
} from "./onboardingFunnel";

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
  /** Ops funnel stage for the Admin Onboarding Center. */
  funnelStage: OnboardingFunnelStage;
  completionPercent: number;
  missingItems: string[];
  /** Exact upload/review error when a document was rejected or noted. */
  uploadError: string | null;
  stalled: boolean;
  timeline: OnboardingTimelineEvent[];
  lastAdminViewAt: string | null;
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

function iso(d: Date | string | null | undefined): string | null {
  if (!d) return null;
  return d instanceof Date ? d.toISOString() : new Date(d).toISOString();
}

export async function buildCarrierOnboardingTrace(profile: Profile): Promise<CarrierOnboardingTrace> {
  const [w9, insurance, dotCdl, payout, docs, trucks, uploadSessions] = await Promise.all([
    db.select().from(w9SubmissionsTable).where(eq(w9SubmissionsTable.profileId, profile.id)).then((r) => r[0]),
    db.select().from(insuranceSubmissionsTable).where(eq(insuranceSubmissionsTable.profileId, profile.id)).then((r) => r[0]),
    db.select().from(dotCdlTable).where(eq(dotCdlTable.profileId, profile.id)).then((r) => r[0]),
    db.select().from(payoutAccountsTable).where(eq(payoutAccountsTable.profileId, profile.id)).then((r) => r[0]),
    db.select().from(driverDocumentsTable).where(eq(driverDocumentsTable.profileId, profile.id)),
    db.select().from(trucksTable).where(eq(trucksTable.ownerId, profile.id)).orderBy(trucksTable.createdAt).limit(1),
    db.select().from(uploadSessionsTable).where(eq(uploadSessionsTable.profileId, profile.id)).orderBy(uploadSessionsTable.createdAt),
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
  const missingItems = steps.filter((s) => !s.ok).map((s) => s.label);

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

  const pendingDocumentCount = docs.filter((d) => d.status === "uploaded").length;
  const hasPendingReview =
    pendingDocumentCount > 0
    || w9Form === "pending"
    || insuranceForm === "pending"
    || dotVerified === "pending";
  const hasAnyDocumentOrForm =
    docsWithFiles.length > 0
    || w9Form !== "missing"
    || insuranceForm !== "missing"
    || dotVerified !== "missing";
  const isApproved =
    (w9Form === "complete" || w9Uploaded === "complete")
    && (insuranceForm === "complete" || coiUploaded === "complete")
    && (canBid || (dotVerified === "complete" && payoutReady === "complete"));

  const lastActivity = profile.updatedAt.toISOString();
  const funnelStage = classifyFunnelStage({
    profileComplete,
    truckAdded,
    hasAnyDocumentOrForm,
    hasPendingReview,
    isApproved: canBid || isApproved,
    canBid,
    lastActivityIso: lastActivity,
  });
  const stalled = funnelStage === "stalled";

  const rejectedDoc = docs.find((d) => d.status === "rejected" && (d.reviewNote || d.notes));
  const uploadError =
    rejectedDoc?.reviewNote
    || rejectedDoc?.notes
    || docs.find((d) => d.notes)?.notes
    || null;

  const firstUploadSession = uploadSessions[0];
  const firstUsedSession = uploadSessions.find((s) => s.usedAt);
  const firstDocWithFile = docsWithFiles
    .slice()
    .sort((a, b) => {
      const at = a.uploadedAt?.getTime() ?? a.createdAt.getTime();
      const bt = b.uploadedAt?.getTime() ?? b.createdAt.getTime();
      return at - bt;
    })[0];
  const approvedDoc = docs.find((d) => d.status === "verified" && d.verifiedAt);
  const rejectedAny = docs.find((d) => d.status === "rejected" && d.rejectedAt);
  const lastAdminViewAt = iso(profile.lastAdminOnboardingViewAt)
    || iso(approvedDoc?.verifiedAt)
    || iso(rejectedAny?.rejectedAt);

  const timeline = buildTimeline([
    {
      type: "signup",
      label: "Signup",
      at: profile.createdAt.toISOString(),
    },
    {
      type: "email_verified",
      label: "Email verified",
      // Profile rows are created after Clerk auth; email present implies verified signup path.
      at: profile.email ? profile.createdAt.toISOString() : null,
      status: profile.email ? "complete" : "missing",
      detail: profile.email ? "Clerk account linked to profile" : "No email on profile",
    },
    {
      type: "company_profile_saved",
      label: "Company profile saved",
      at: profileComplete ? profile.updatedAt.toISOString() : null,
      status: profileComplete ? "complete" : "missing",
    },
    {
      type: "equipment_added",
      label: "Equipment added",
      at: trucks[0] ? trucks[0].createdAt.toISOString() : null,
      status: truckAdded ? "complete" : "missing",
    },
    {
      type: "upload_requested",
      label: "Upload requested",
      at: firstUploadSession ? firstUploadSession.createdAt.toISOString() : (firstDocWithFile ? iso(firstDocWithFile.uploadedAt ?? firstDocWithFile.createdAt) : null),
      status: firstUploadSession || firstDocWithFile ? "complete" : "missing",
    },
    {
      type: "r2_upload_completed",
      label: "R2 upload completed",
      at: firstUsedSession?.usedAt
        ? firstUsedSession.usedAt.toISOString()
        : (firstDocWithFile?.objectPath ? iso(firstDocWithFile.uploadedAt ?? firstDocWithFile.createdAt) : null),
      status: firstUsedSession?.usedAt || firstDocWithFile?.objectPath ? "complete" : "missing",
    },
    {
      type: "database_finalized",
      label: "Database finalized",
      at: firstDocWithFile ? iso(firstDocWithFile.uploadedAt ?? firstDocWithFile.createdAt) : null,
      status: firstDocWithFile ? "complete" : "missing",
      detail: firstDocWithFile ? `${firstDocWithFile.docType} → ${firstDocWithFile.status}` : null,
    },
    {
      type: "admin_viewed",
      label: "Admin viewed",
      at: lastAdminViewAt,
      status: lastAdminViewAt ? "complete" : "missing",
    },
    {
      type: "approved",
      label: "Approved",
      at: approvedDoc ? iso(approvedDoc.verifiedAt) : null,
      status: approvedDoc ? "complete" : (rejectedAny ? "missing" : (hasPendingReview ? "pending" : "missing")),
      detail: approvedDoc ? `${approvedDoc.docType} verified` : null,
    },
    {
      type: "rejected",
      label: "Rejected",
      at: rejectedAny ? iso(rejectedAny.rejectedAt) : null,
      status: rejectedAny ? "rejected" : "missing",
      detail: rejectedAny?.reviewNote ?? null,
    },
  ]);

  return {
    carrier: profile.companyName || profile.contactName || `profile#${profile.id}`,
    profileId: profile.id,
    email: profile.email ?? null,
    role: profile.role,
    created: profile.createdAt.toISOString(),
    lastActivity,
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
    pendingDocumentCount,
    verifiedDocumentCount: docs.filter((d) => d.status === "verified").length,
    canBid,
    overallStatus,
    reasonBlocked,
    stepsComplete,
    stepsTotal,
    nextAction,
    funnelStage,
    completionPercent: completionPercent(stepsComplete, stepsTotal),
    missingItems,
    uploadError,
    stalled,
    timeline,
    lastAdminViewAt,
  };
}

export async function listProviderOnboardingTraces(
  filter: OnboardingFunnelFilter = "all",
): Promise<CarrierOnboardingTrace[]> {
  const providers = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.role, "provider"))
    .orderBy(desc(profilesTable.createdAt));

  const traces: CarrierOnboardingTrace[] = [];
  for (const profile of providers) {
    const trace = await buildCarrierOnboardingTrace(profile);
    if (
      matchesFunnelFilter(trace.funnelStage, filter, {
        isApproved: trace.canBid || trace.funnelStage === "approved",
        profileComplete: trace.profileComplete,
        truckAdded: trace.truckAdded,
        hasDocs: trace.documentCount > 0 || trace.w9Form !== "missing" || trace.insuranceForm !== "missing",
      })
    ) {
      traces.push(trace);
    }
  }
  return traces;
}

/** Record that staff opened a carrier in the Onboarding Center. */
export async function markAdminOnboardingViewed(profileId: number): Promise<void> {
  await db
    .update(profilesTable)
    .set({ lastAdminOnboardingViewAt: new Date() })
    .where(eq(profilesTable.id, profileId));
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
