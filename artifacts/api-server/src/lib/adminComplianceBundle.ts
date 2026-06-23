import { eq, and, inArray, desc } from "drizzle-orm";
import {
  db,
  profilesTable,
  w9SubmissionsTable,
  insuranceSubmissionsTable,
  dotCdlTable,
  driverDocumentsTable,
  payoutAccountsTable,
  type Profile,
} from "@workspace/db";
import {
  ADMIN_UPLOAD_DOC_TYPES,
  computeProviderCanBid,
  hasPendingComplianceReview,
  isAdminUploadDocType,
} from "./providerCompliance";

export function profileSummary(p: Profile) {
  return {
    id: p.id,
    companyName: p.companyName,
    contactName: p.contactName ?? null,
    email: p.email ?? null,
    phone: p.phone ?? null,
    city: p.city ?? null,
    state: p.state ?? null,
    role: p.role,
  };
}

function docStatusOr(submitted: { status: string } | undefined, fallback: string) {
  return submitted?.status ?? fallback;
}

export async function listProviderComplianceBundles() {
  const providers = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.role, "provider"))
    .orderBy(desc(profilesTable.updatedAt));

  if (providers.length === 0) return [];

  const providerIds = providers.map((p) => p.id);

  const [w9Rows, insuranceRows, dotRows, payoutRows, uploadRows] = await Promise.all([
    db.select().from(w9SubmissionsTable).where(inArray(w9SubmissionsTable.profileId, providerIds)),
    db.select().from(insuranceSubmissionsTable).where(inArray(insuranceSubmissionsTable.profileId, providerIds)),
    db.select().from(dotCdlTable).where(inArray(dotCdlTable.profileId, providerIds)),
    db.select().from(payoutAccountsTable).where(inArray(payoutAccountsTable.profileId, providerIds)),
    db.select().from(driverDocumentsTable).where(
      and(
        inArray(driverDocumentsTable.profileId, providerIds),
        inArray(driverDocumentsTable.docType, [...ADMIN_UPLOAD_DOC_TYPES]),
      ),
    ),
  ]);

  const w9ByProfile = new Map(w9Rows.map((r) => [r.profileId, r]));
  const insuranceByProfile = new Map(insuranceRows.map((r) => [r.profileId, r]));
  const dotByProfile = new Map(dotRows.map((r) => [r.profileId, r]));
  const payoutByProfile = new Map(payoutRows.map((r) => [r.profileId, r]));
  const uploadsByProfile = new Map<number, typeof uploadRows>();
  for (const row of uploadRows) {
    if (row.status === "missing") continue;
    const list = uploadsByProfile.get(row.profileId) ?? [];
    list.push(row);
    uploadsByProfile.set(row.profileId, list);
  }

  return providers
    .map((profile) => {
      const w9 = w9ByProfile.get(profile.id);
      const insurance = insuranceByProfile.get(profile.id);
      const dotCdl = dotByProfile.get(profile.id);
      const payout = payoutByProfile.get(profile.id);
      const uploadedDocuments = (uploadsByProfile.get(profile.id) ?? []).map((doc) => ({
        docType: doc.docType,
        status: doc.status,
        reviewNote: doc.reviewNote ?? null,
        fileName: doc.fileName ?? null,
        objectPath: doc.objectPath ?? null,
        mimeType: doc.mimeType ?? null,
        uploadedAt: doc.uploadedAt,
      }));

      const w9Status = docStatusOr(w9, "not_submitted");
      const insuranceStatus = docStatusOr(insurance, "not_submitted");
      const dotCdlStatus = dotCdl?.status ?? "not_submitted";
      const payoutStatus = payout?.status ?? "not_submitted";

      const canBid = computeProviderCanBid({
        role: profile.role,
        w9Status,
        insuranceStatus,
        dotCdlStatus,
        payoutStatus,
      });

      const hasPendingReview = hasPendingComplianceReview({
        w9Status,
        insuranceStatus,
        dotCdlStatus,
        uploadedDocs: uploadedDocuments,
      });

      return {
        profileId: profile.id,
        profile: profileSummary(profile),
        canBid,
        hasPendingReview,
        w9: w9
          ? {
              status: w9.status,
              reviewNote: w9.reviewNote ?? null,
              submittedAt: w9.createdAt,
              legalName: w9.legalName,
              businessName: w9.businessName ?? null,
              taxIdType: w9.taxIdType,
              taxIdLast4: w9.taxIdLast4,
            }
          : null,
        insurance: insurance
          ? {
              status: insurance.status,
              reviewNote: insurance.reviewNote ?? null,
              submittedAt: insurance.createdAt,
              glCarrier: insurance.glCarrier,
              glPolicyNumber: insurance.glPolicyNumber,
              glCoverageAmount: parseFloat(insurance.glCoverageAmount),
              glExpirationDate: insurance.glExpirationDate,
            }
          : null,
        dotCdl: dotCdl
          ? {
              id: dotCdl.id,
              status: dotCdl.status,
              reviewNote: dotCdl.reviewNote ?? null,
              submittedAt: dotCdl.submittedAt,
              dotNumber: dotCdl.dotNumber ?? null,
              mcNumber: dotCdl.mcNumber ?? null,
              cdlNumber: dotCdl.cdlNumber ?? null,
              cdlState: dotCdl.cdlState ?? null,
              cdlClass: dotCdl.cdlClass ?? null,
              cdlExpiry: dotCdl.cdlExpiry,
              dotVerified: dotCdl.dotVerified,
              cdlVerified: dotCdl.cdlVerified,
              fmcsaAuthority: dotCdl.fmcsaAuthority,
              insuranceActive: dotCdl.insuranceActive,
              dotOperatingStatus: dotCdl.dotOperatingStatus,
              notSuspended: dotCdl.notSuspended,
              safetyRating: dotCdl.safetyRating ?? null,
            }
          : null,
        payoutStatus,
        uploadedDocuments,
      };
    })
    .filter((bundle) =>
      bundle.w9 != null
      || bundle.insurance != null
      || bundle.dotCdl != null
      || bundle.uploadedDocuments.length > 0,
    );
}

export async function reviewProviderW9(profileId: number, approved: boolean, note: string | null) {
  const status = approved ? "verified" : "rejected";
  const [rec] = await db
    .update(w9SubmissionsTable)
    .set({ status, reviewNote: note })
    .where(eq(w9SubmissionsTable.profileId, profileId))
    .returning();
  return rec ?? null;
}

export async function reviewProviderInsurance(profileId: number, approved: boolean, note: string | null) {
  const status = approved ? "verified" : "rejected";
  const [rec] = await db
    .update(insuranceSubmissionsTable)
    .set({ status, reviewNote: note })
    .where(eq(insuranceSubmissionsTable.profileId, profileId))
    .returning();
  return rec ?? null;
}

export async function reviewProviderUploadedDoc(
  profileId: number,
  docType: string,
  approved: boolean,
  note: string | null,
) {
  if (!isAdminUploadDocType(docType)) return null;
  const now = new Date();
  const [rec] = await db
    .update(driverDocumentsTable)
    .set(
      approved
        ? { status: "verified", verifiedAt: now, rejectedAt: null, reviewNote: note }
        : { status: "rejected", rejectedAt: now, verifiedAt: null, reviewNote: note },
    )
    .where(and(eq(driverDocumentsTable.profileId, profileId), eq(driverDocumentsTable.docType, docType)))
    .returning();
  return rec ?? null;
}

export async function getCarrierComplianceSnapshot(profileId: number) {
  const [profile] = await db.select().from(profilesTable).where(eq(profilesTable.id, profileId));
  if (!profile) return null;

  const [w9] = await db.select().from(w9SubmissionsTable).where(eq(w9SubmissionsTable.profileId, profileId));
  const [insurance] = await db.select().from(insuranceSubmissionsTable).where(eq(insuranceSubmissionsTable.profileId, profileId));
  const [dotCdl] = await db.select().from(dotCdlTable).where(eq(dotCdlTable.profileId, profileId));
  const [payout] = await db.select().from(payoutAccountsTable).where(eq(payoutAccountsTable.profileId, profileId));

  const w9Status = w9?.status ?? "not_submitted";
  const insuranceStatus = insurance?.status ?? "not_submitted";
  const dotCdlStatus = dotCdl?.status ?? "not_submitted";
  const payoutStatus = payout?.status ?? "not_submitted";

  return {
    w9Status,
    insuranceStatus,
    dotCdlStatus,
    payoutStatus,
    canBid: computeProviderCanBid({
      role: profile.role,
      w9Status,
      insuranceStatus,
      dotCdlStatus,
      payoutStatus,
    }),
    w9ReviewNote: w9?.reviewNote ?? null,
    insuranceReviewNote: insurance?.reviewNote ?? null,
    dotCdlReviewNote: dotCdl?.reviewNote ?? null,
  };
}

export async function getProviderCanBid(profileId: number): Promise<boolean> {
  const snapshot = await getCarrierComplianceSnapshot(profileId);
  return snapshot?.canBid ?? false;
}
