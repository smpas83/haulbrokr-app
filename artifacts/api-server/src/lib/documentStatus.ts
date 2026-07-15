import { eq } from "drizzle-orm";
import { db, profilesTable, driverDocumentsTable, type Profile } from "@workspace/db";
import { getCarrierComplianceSnapshot } from "./adminComplianceBundle";

export interface RequiredDocItem {
  key: string;
  label: string;
  satisfied: boolean;
  status: string; // verified | pending | uploaded | rejected | not_submitted | missing
}

export interface DocumentStatus {
  profileId: number;
  role: string;
  complete: boolean;
  /** True when the account is hard-gated from core actions until docs are done. */
  gated: boolean;
  missing: string[]; // labels of unsatisfied required docs
  items: RequiredDocItem[];
}

function mergeFormAndFileStatus(
  formStatus: string,
  fileStatus: string | undefined,
): { status: string; satisfied: boolean; inProgress: boolean } {
  if (formStatus === "verified" || fileStatus === "verified") {
    return { status: "verified", satisfied: true, inProgress: false };
  }
  if (formStatus === "pending" || fileStatus === "uploaded") {
    return { status: formStatus === "pending" ? "pending" : "uploaded", satisfied: false, inProgress: true };
  }
  if (formStatus === "rejected" || fileStatus === "rejected") {
    return { status: "rejected", satisfied: false, inProgress: false };
  }
  return { status: formStatus || "not_submitted", satisfied: false, inProgress: false };
}

/**
 * Carriers are gated on the compliance pipeline (W-9, insurance, DOT/CDL, payout).
 * File uploads of W-9/COI now count as in-progress (pending review) so users who
 * uploaded files but have not filled forms still see saved progress.
 */
export async function computeDocumentStatus(profile: Profile): Promise<DocumentStatus> {
  if (profile.role === "provider") {
    const snap = await getCarrierComplianceSnapshot(profile.id);
    const docs = await db
      .select({ docType: driverDocumentsTable.docType, status: driverDocumentsTable.status })
      .from(driverDocumentsTable)
      .where(eq(driverDocumentsTable.profileId, profile.id));
    const byType = Object.fromEntries(docs.map((d) => [d.docType, d.status]));

    const w9 = mergeFormAndFileStatus(snap?.w9Status ?? "not_submitted", byType.w9);
    const coi = mergeFormAndFileStatus(snap?.insuranceStatus ?? "not_submitted", byType.coi);
    const dot = mergeFormAndFileStatus(snap?.dotCdlStatus ?? "not_submitted", undefined);
    const payoutStatus = snap?.payoutStatus ?? "not_submitted";
    const payoutOk = payoutStatus === "verified";

    const items: RequiredDocItem[] = [
      { key: "w9", label: "W-9 tax form", status: w9.status, satisfied: w9.satisfied },
      { key: "coi", label: "Certificate of Insurance (COI)", status: coi.status, satisfied: coi.satisfied },
      { key: "dot_cdl", label: "DOT / CDL authority", status: dot.status, satisfied: dot.satisfied },
      { key: "payout", label: "Verified payout account", status: payoutStatus, satisfied: payoutOk },
    ];
    const missing = items.filter((i) => !i.satisfied).map((i) => i.label);
    const complete = missing.length === 0;
    // Hard gate remains until admin verifies — uploads alone do not unlock bidding.
    return { profileId: profile.id, role: profile.role, complete, gated: !complete, missing, items };
  }

  // Customers: ask for a W-9 on file (uploaded or verified counts). Soft gate.
  const docs = await db
    .select({ docType: driverDocumentsTable.docType, status: driverDocumentsTable.status })
    .from(driverDocumentsTable)
    .where(eq(driverDocumentsTable.profileId, profile.id));
  const w9 = docs.find((d) => d.docType === "w9");
  const w9Ok = !!w9 && (w9.status === "verified" || w9.status === "uploaded");
  const items: RequiredDocItem[] = [
    { key: "w9", label: "W-9 tax form", status: w9?.status ?? "missing", satisfied: w9Ok },
  ];
  const missing = items.filter((i) => !i.satisfied).map((i) => i.label);
  const complete = missing.length === 0;
  // Customers are reminded but never hard-gated.
  return { profileId: profile.id, role: profile.role, complete, gated: false, missing, items };
}

export async function computeDocumentStatusById(profileId: number): Promise<DocumentStatus | null> {
  const [profile] = await db.select().from(profilesTable).where(eq(profilesTable.id, profileId));
  if (!profile) return null;
  return computeDocumentStatus(profile);
}
