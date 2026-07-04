/** Customer document types surfaced in admin review (uploaded files). */
export const CUSTOMER_UPLOAD_DOC_TYPES = [
  "cos",
  "po_template",
  "tax_exempt_certificate",
] as const;

/** Carrier + customer document types surfaced in admin review (uploaded files). */
export const ADMIN_UPLOAD_DOC_TYPES = [
  "w9",
  "coi",
  "dot_authority",
  "cdl_front",
  "cdl_back",
  "dot_medical_card",
  "business_license",
  "mc_authority",
  "vehicle_registration",
  "signed_carrier_agreement",
  "voided_check",
  "ach_authorization",
  "safety_rating",
  "bond",
  "equipment_list",
  ...CUSTOMER_UPLOAD_DOC_TYPES,
] as const;

export type AdminUploadDocType = (typeof ADMIN_UPLOAD_DOC_TYPES)[number];

export const W9_UPLOAD_DOC_TYPES = new Set<AdminUploadDocType>(["w9"]);
export const COI_UPLOAD_DOC_TYPES = new Set<AdminUploadDocType>(["coi"]);
export const DOT_UPLOAD_DOC_TYPES = new Set<AdminUploadDocType>([
  "dot_authority",
  "dot_medical_card",
  "mc_authority",
]);
export const CDL_UPLOAD_DOC_TYPES = new Set<AdminUploadDocType>([
  "cdl_front",
  "cdl_back",
]);

export function isAdminUploadDocType(
  value: string,
): value is AdminUploadDocType {
  return (ADMIN_UPLOAD_DOC_TYPES as readonly string[]).includes(value);
}

/** Payout statuses that satisfy the bidding gate (verification_status enum). */
export const BIDDING_READY_PAYOUT_STATUSES = new Set(["verified"]);

export function isPayoutReadyForBidding(payoutStatus: string): boolean {
  return BIDDING_READY_PAYOUT_STATUSES.has(payoutStatus);
}

/**
 * A provider may bid once every required compliance artifact is admin-approved
 * and payout verification is complete.
 */
export function computeProviderCanBid(input: {
  role: string;
  w9Status: string;
  insuranceStatus: string;
  dotCdlStatus: string | undefined;
  payoutStatus: string;
}): boolean {
  return (
    input.role === "provider" &&
    input.w9Status === "verified" &&
    input.insuranceStatus === "verified" &&
    input.dotCdlStatus === "verified" &&
    isPayoutReadyForBidding(input.payoutStatus)
  );
}

function artifactLabel(name: string, status: string): string {
  if (status === "not_submitted") return `${name} submission`;
  return `${name} approval (currently ${status})`;
}

/** Human-readable blockers when computeProviderCanBid is false. */
export function describeCanBidBlockers(input: {
  role: string;
  w9Status: string;
  insuranceStatus: string;
  dotCdlStatus: string | undefined;
  payoutStatus: string;
}): string[] {
  const blockers: string[] = [];
  if (input.role !== "provider") blockers.push("a provider account");
  if (input.w9Status !== "verified")
    blockers.push(artifactLabel("W-9", input.w9Status));
  if (input.insuranceStatus !== "verified")
    blockers.push(artifactLabel("insurance", input.insuranceStatus));
  const dotCdlStatus = input.dotCdlStatus ?? "not_submitted";
  if (dotCdlStatus !== "verified")
    blockers.push(artifactLabel("DOT/CDL", dotCdlStatus));
  if (!isPayoutReadyForBidding(input.payoutStatus)) {
    if (input.payoutStatus === "not_submitted")
      blockers.push("payout account on file");
    else
      blockers.push(
        `verified payout account (currently ${input.payoutStatus})`,
      );
  }
  return blockers;
}

/** True when any required artifact still needs admin action. */
export function hasPendingComplianceReview(input: {
  w9Status: string;
  insuranceStatus: string;
  dotCdlStatus: string | undefined;
  uploadedDocs: { status: string }[];
}): boolean {
  if (input.w9Status === "pending") return true;
  if (input.insuranceStatus === "pending") return true;
  if (input.dotCdlStatus === "pending") return true;
  return input.uploadedDocs.some((d) => d.status === "uploaded");
}
