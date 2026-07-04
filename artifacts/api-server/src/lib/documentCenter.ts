import {
  db,
  enterpriseDocumentsTable,
  w9SubmissionsTable,
  insuranceSubmissionsTable,
  driverDocumentsTable,
  deliveryEvidenceTable,
  jobsTable,
} from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";

interface ProfileCtx {
  id: number;
  organizationId: number | null;
}

export async function aggregateDocuments(profile: ProfileCtx) {
  const docs: {
    id: string;
    category: string;
    title: string;
    fileName: string | null;
    expiresAt: string | null;
    status: string;
    sourceTable: string;
    sourceId: number;
    href?: string;
    version: number;
  }[] = [];

  const [w9] = await db.select().from(w9SubmissionsTable).where(eq(w9SubmissionsTable.profileId, profile.id));
  if (w9) {
    docs.push({
      id: `w9-${w9.id}`,
      category: "w9",
      title: "W-9 Tax Form",
      fileName: w9.legalName,
      expiresAt: null,
      status: w9.status,
      sourceTable: "w9_submissions",
      sourceId: w9.id,
      href: "/account",
      version: 1,
    });
  }

  const [insurance] = await db.select().from(insuranceSubmissionsTable).where(eq(insuranceSubmissionsTable.profileId, profile.id));
  if (insurance) {
    docs.push({
      id: `ins-${insurance.id}`,
      category: "insurance",
      title: "Insurance Certificate",
      fileName: null,
      expiresAt: insurance.glExpirationDate?.toISOString() ?? null,
      status: insurance.status,
      sourceTable: "insurance_submissions",
      sourceId: insurance.id,
      href: "/account",
      version: 1,
    });
  }

  const driverDocs = await db.select()
    .from(driverDocumentsTable)
    .where(eq(driverDocumentsTable.profileId, profile.id));

  for (const d of driverDocs) {
    const cat = mapDocType(d.docType);
    docs.push({
      id: `dd-${d.id}`,
      category: cat,
      title: d.docType.replace(/_/g, " "),
      fileName: d.fileName,
      expiresAt: d.expiry?.toISOString() ?? null,
      status: d.status,
      sourceTable: "driver_documents",
      sourceId: d.id,
      href: "/account",
      version: 1,
    });
  }

  const jobScope = profile.organizationId
    ? eq(jobsTable.customerId, profile.id)
    : eq(jobsTable.customerId, profile.id);

  const evidence = await db.select({
    id: deliveryEvidenceTable.id,
    jobId: deliveryEvidenceTable.jobId,
    photoCaption: deliveryEvidenceTable.photoCaption,
    photoUrl: deliveryEvidenceTable.photoUrl,
    uploadedAt: deliveryEvidenceTable.uploadedAt,
  })
    .from(deliveryEvidenceTable)
    .innerJoin(jobsTable, eq(deliveryEvidenceTable.jobId, jobsTable.id))
    .where(jobScope)
    .orderBy(desc(deliveryEvidenceTable.uploadedAt))
    .limit(50);

  for (const e of evidence) {
    docs.push({
      id: `ev-${e.id}`,
      category: "photo",
      title: e.photoCaption ?? `Delivery proof — Job #${e.jobId}`,
      fileName: e.photoUrl,
      expiresAt: null,
      status: "uploaded",
      sourceTable: "delivery_evidence",
      sourceId: e.id,
      href: `/jobs/${e.jobId}`,
      version: 1,
    });
  }

  const registry = await db.select()
    .from(enterpriseDocumentsTable)
    .where(eq(enterpriseDocumentsTable.profileId, profile.id))
    .orderBy(desc(enterpriseDocumentsTable.updatedAt));

  for (const r of registry) {
    docs.push({
      id: `ed-${r.id}`,
      category: r.category,
      title: r.title,
      fileName: r.fileName,
      expiresAt: r.expiresAt?.toISOString() ?? null,
      status: "registered",
      sourceTable: r.sourceTable ?? "enterprise_documents",
      sourceId: r.id,
      version: r.version,
    });
  }

  return docs;
}

function mapDocType(docType: string): string {
  if (docType.includes("cdl") || docType.includes("dl_")) return "cdl";
  if (docType.includes("medical")) return "medical";
  if (docType.includes("coi")) return "coi";
  if (docType.includes("w9")) return "w9";
  if (docType.includes("registration")) return "registration";
  if (docType.includes("inspection")) return "inspection";
  return "other";
}

export async function searchDocuments(profileId: number, query: string) {
  const all = await aggregateDocuments({ id: profileId, organizationId: null });
  const q = query.toLowerCase();
  if (!q) return all;
  return all.filter((d) =>
    d.title.toLowerCase().includes(q) ||
    d.category.includes(q) ||
    (d.fileName?.toLowerCase().includes(q) ?? false),
  );
}

export async function getExpiringDocuments(profileId: number, withinDays = 30) {
  const all = await aggregateDocuments({ id: profileId, organizationId: null });
  const cutoff = new Date(Date.now() + withinDays * 86400000);
  return all.filter((d) => d.expiresAt && new Date(d.expiresAt) <= cutoff);
}

export async function registerDocument(
  profile: ProfileCtx,
  input: {
    category: typeof enterpriseDocumentsTable.$inferInsert.category;
    title: string;
    objectPath?: string;
    fileName?: string;
    expiresAt?: Date;
  },
) {
  const [row] = await db.insert(enterpriseDocumentsTable).values({
    organizationId: profile.organizationId,
    profileId: profile.id,
    category: input.category,
    title: input.title,
    objectPath: input.objectPath,
    fileName: input.fileName,
    expiresAt: input.expiresAt,
  }).returning();
  return row!;
}
