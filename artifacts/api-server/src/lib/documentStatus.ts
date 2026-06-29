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

/**
 * Carriers are gated on the existing compliance pipeline (W-9, insurance,
 * DOT/CDL, payout) — the same checks that already block bidding. Customers are
 * asked for a W-9 on file but are not hard-gated.
 */
export async function computeDocumentStatus(profile: Profile): Promise<DocumentStatus> {
  if (profile.role === "provider") {
    const snap = await getCarrierComplianceSnapshot(profile.id);
    const items: RequiredDocItem[] = [
      { key: "w9", label: "W-9 tax form", status: snap?.w9Status ?? "not_submitted", satisfied: (snap?.w9Status ?? "") === "verified" },
      { key: "coi", label: "Certificate of Insurance (COI)", status: snap?.insuranceStatus ?? "not_submitted", satisfied: (snap?.insuranceStatus ?? "") === "verified" },
      { key: "dot_cdl", label: "DOT / CDL authority", status: snap?.dotCdlStatus ?? "not_submitted", satisfied: (snap?.dotCdlStatus ?? "") === "verified" },
      { key: "payout", label: "Verified payout account", status: snap?.payoutStatus ?? "not_submitted", satisfied: (snap?.payoutStatus ?? "") === "verified" },
    ];
    const missing = items.filter((i) => !i.satisfied).map((i) => i.label);
    const complete = missing.length === 0;
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
