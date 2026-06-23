/** Carrier document types surfaced in admin review (uploaded files). */
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
] as const;

export type AdminUploadDocType = (typeof ADMIN_UPLOAD_DOC_TYPES)[number];

export const W9_UPLOAD_DOC_TYPES = new Set<AdminUploadDocType>(["w9"]);
export const COI_UPLOAD_DOC_TYPES = new Set<AdminUploadDocType>(["coi"]);
export const DOT_UPLOAD_DOC_TYPES = new Set<AdminUploadDocType>([
  "dot_authority", "dot_medical_card", "mc_authority",
]);
export const CDL_UPLOAD_DOC_TYPES = new Set<AdminUploadDocType>(["cdl_front", "cdl_back"]);

export function isAdminUploadDocType(value: string): value is AdminUploadDocType {
  return (ADMIN_UPLOAD_DOC_TYPES as readonly string[]).includes(value);
}

/**
 * A provider may bid once every required compliance artifact is admin-approved
 * and a payout account has been submitted.
 */
export function computeProviderCanBid(input: {
  role: string;
  w9Status: string;
  insuranceStatus: string;
  dotCdlStatus: string | undefined;
  payoutStatus: string;
}): boolean {
  return (
    input.role === "provider"
    && input.w9Status === "verified"
    && input.insuranceStatus === "verified"
    && input.dotCdlStatus === "verified"
    && input.payoutStatus !== "not_submitted"
  );
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
