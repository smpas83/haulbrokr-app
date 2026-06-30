import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import { z } from "zod/v4";
import {
  complianceDocumentsTable,
  complianceDocumentVersionsTable,
  db,
  trucksTable,
} from "@workspace/db";
import { getRequestProfile, requireProfile } from "../middlewares/requireAuth";
import { isAdmin } from "../middlewares/requireAdmin";
import {
  appendDocumentVersion,
  buildComplianceSummary,
  canManageComplianceDocument,
  createComplianceEvent,
  dashboardCounts,
  documentsForProfile,
  documentsForTruckIds,
  expiredDocuments,
  expiringDocuments,
  recordComplianceAudit,
  REQUIRED_DRIVER_DOCUMENTS,
  REQUIRED_TRUCK_DOCUMENTS,
  REQUIRED_VENDOR_DOCUMENTS,
  serializeComplianceDocument,
} from "../lib/complianceDocuments";

const router: IRouter = Router();

const DocumentType = z.enum([
  "w9",
  "coi",
  "dot_authority",
  "mc_number",
  "usdot_number",
  "business_registration",
  "driver_license",
  "cdl",
  "medical_certificate",
  "insurance",
  "dot_document",
  "endorsement",
  "vehicle_registration",
  "truck_insurance",
  "truck_registration",
  "inspection",
  "additional",
]);

const UploadBody = z.object({
  entityType: z.enum(["profile", "truck"]),
  profileId: z.number().int().positive().optional(),
  truckId: z.number().int().positive().optional(),
  documentType: DocumentType,
  objectPath: z.string().min(1).optional().nullable(),
  fileName: z.string().max(255).optional().nullable(),
  mimeType: z.string().max(255).optional().nullable(),
  documentNumber: z.string().max(255).optional().nullable(),
  issuingAuthority: z.string().max(255).optional().nullable(),
  expiresAt: z.string().datetime().optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

const ReplaceBody = UploadBody.omit({ entityType: true, profileId: true, truckId: true, documentType: true }).extend({
  expiresAt: z.string().datetime().optional().nullable(),
});

const ReviewBody = z.object({
  reason: z.string().max(1000).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

function parseDate(value: string | null | undefined): Date | null {
  return value ? new Date(value) : null;
}

async function loadDocument(id: number) {
  const [doc] = await db.select().from(complianceDocumentsTable).where(eq(complianceDocumentsTable.id, id));
  return doc ?? null;
}

async function requireDocumentAccess(req: any, res: any, doc: NonNullable<Awaited<ReturnType<typeof loadDocument>>>) {
  const profile = getRequestProfile(req);
  if (!(await canManageComplianceDocument(req, profile, doc))) {
    res.status(403).json({ error: "You do not have access to this compliance document." });
    return false;
  }
  return true;
}

router.get("/compliance/vendor/summary", requireProfile, async (req, res): Promise<void> => {
  const profile = getRequestProfile(req);
  if (profile.role !== "provider" && !(await isAdmin(req))) {
    res.status(403).json({ error: "Vendor compliance is available to providers and admins." });
    return;
  }
  const profileId = typeof req.query.profileId === "string" && await isAdmin(req) ? Number(req.query.profileId) : profile.id;
  const docs = await documentsForProfile(profileId);
  res.json(buildComplianceSummary(docs, REQUIRED_VENDOR_DOCUMENTS));
});

router.get("/compliance/driver/summary", requireProfile, async (req, res): Promise<void> => {
  const profile = getRequestProfile(req);
  const profileId = typeof req.query.profileId === "string" && await isAdmin(req) ? Number(req.query.profileId) : profile.id;
  if (profile.role !== "driver" && profile.id !== profileId && !(await isAdmin(req))) {
    res.status(403).json({ error: "Drivers only manage their own compliance documents." });
    return;
  }
  const docs = await documentsForProfile(profileId);
  res.json(buildComplianceSummary(docs, REQUIRED_DRIVER_DOCUMENTS));
});

router.get("/compliance/fleet/summary", requireProfile, async (req, res): Promise<void> => {
  const profile = getRequestProfile(req);
  if (profile.role !== "provider" && !(await isAdmin(req))) {
    res.status(403).json({ error: "Fleet compliance is available to fleet owners and admins." });
    return;
  }
  const ownerId = typeof req.query.ownerId === "string" && await isAdmin(req) ? Number(req.query.ownerId) : profile.id;
  const trucks = await db.select().from(trucksTable).where(eq(trucksTable.ownerId, ownerId));
  const docs = await documentsForTruckIds(trucks.map((truck) => truck.id));
  res.json({
    ownerId,
    trucks: trucks.map((truck) => ({
      id: truck.id,
      vin: truck.vin,
      licensePlate: truck.licensePlate,
      make: truck.make,
      model: truck.model,
      year: truck.year,
      equipmentStatus: truck.isAvailable ? "available" : "unavailable",
      compliance: buildComplianceSummary(docs.filter((doc) => doc.truckId === truck.id), REQUIRED_TRUCK_DOCUMENTS),
    })),
  });
});

router.post("/compliance/documents", requireProfile, async (req, res): Promise<void> => {
  const profile = getRequestProfile(req);
  const parsed = UploadBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const target = {
    entityType: parsed.data.entityType,
    profileId: parsed.data.entityType === "profile" ? parsed.data.profileId ?? profile.id : null,
    truckId: parsed.data.entityType === "truck" ? parsed.data.truckId ?? null : null,
  };
  if (target.entityType === "truck" && !target.truckId) {
    res.status(400).json({ error: "truckId is required for truck compliance documents." });
    return;
  }
  if (!(await canManageComplianceDocument(req, profile, target))) {
    res.status(403).json({ error: "You cannot manage this compliance document." });
    return;
  }

  const now = new Date();
  const [doc] = await db.insert(complianceDocumentsTable).values({
    ...target,
    documentType: parsed.data.documentType,
    objectPath: parsed.data.objectPath ?? null,
    fileName: parsed.data.fileName ?? null,
    mimeType: parsed.data.mimeType ?? null,
    documentNumber: parsed.data.documentNumber ?? null,
    issuingAuthority: parsed.data.issuingAuthority ?? null,
    expiresAt: parseDate(parsed.data.expiresAt),
    adminNotes: parsed.data.notes ?? null,
    uploadedByProfileId: profile.id,
    uploadedAt: now,
    status: "pending",
  }).returning();

  await appendDocumentVersion(doc, profile.id, 1);
  await recordComplianceAudit({ documentId: doc.id, action: "uploaded", actorProfileId: profile.id, nextStatus: "pending" });
  res.status(201).json(serializeComplianceDocument(doc));
});

router.patch("/compliance/documents/:id/replace", requireProfile, async (req, res): Promise<void> => {
  const profile = getRequestProfile(req);
  const id = Number(req.params.id);
  const doc = await loadDocument(id);
  if (!doc) { res.status(404).json({ error: "Document not found." }); return; }
  if (!(await requireDocumentAccess(req, res, doc))) return;
  const parsed = ReplaceBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [updated] = await db.update(complianceDocumentsTable).set({
    objectPath: parsed.data.objectPath ?? doc.objectPath,
    fileName: parsed.data.fileName ?? doc.fileName,
    mimeType: parsed.data.mimeType ?? doc.mimeType,
    documentNumber: parsed.data.documentNumber ?? doc.documentNumber,
    issuingAuthority: parsed.data.issuingAuthority ?? doc.issuingAuthority,
    expiresAt: parsed.data.expiresAt !== undefined ? parseDate(parsed.data.expiresAt) : doc.expiresAt,
    adminNotes: parsed.data.notes ?? doc.adminNotes,
    uploadedByProfileId: profile.id,
    uploadedAt: new Date(),
    status: "pending",
    rejectionReason: null,
    reviewedByProfileId: null,
    reviewedAt: null,
  }).where(eq(complianceDocumentsTable.id, id)).returning();

  await appendDocumentVersion(updated, profile.id);
  await recordComplianceAudit({ documentId: id, action: "replaced", actorProfileId: profile.id, previousStatus: doc.status, nextStatus: "pending" });
  res.json(serializeComplianceDocument(updated));
});

router.post("/compliance/documents/:id/approve", requireProfile, async (req, res): Promise<void> => {
  const profile = getRequestProfile(req);
  if (!(await isAdmin(req))) { res.status(403).json({ error: "Admin access required." }); return; }
  const id = Number(req.params.id);
  const doc = await loadDocument(id);
  if (!doc) { res.status(404).json({ error: "Document not found." }); return; }
  const parsed = ReviewBody.safeParse(req.body ?? {});
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [updated] = await db.update(complianceDocumentsTable).set({
    status: "approved",
    rejectionReason: null,
    adminNotes: parsed.data.notes ?? doc.adminNotes,
    reviewedByProfileId: profile.id,
    reviewedAt: new Date(),
  }).where(eq(complianceDocumentsTable.id, id)).returning();
  await recordComplianceAudit({ documentId: id, action: "approved", actorProfileId: profile.id, previousStatus: doc.status, nextStatus: "approved", notes: parsed.data.notes ?? null });
  await createComplianceEvent({ document: updated, eventType: "document_approved", message: `${updated.documentType} approved.` });
  res.json(serializeComplianceDocument(updated));
});

router.post("/compliance/documents/:id/reject", requireProfile, async (req, res): Promise<void> => {
  const profile = getRequestProfile(req);
  if (!(await isAdmin(req))) { res.status(403).json({ error: "Admin access required." }); return; }
  const id = Number(req.params.id);
  const doc = await loadDocument(id);
  if (!doc) { res.status(404).json({ error: "Document not found." }); return; }
  const parsed = ReviewBody.safeParse(req.body ?? {});
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const reason = parsed.data.reason ?? "Document rejected.";

  const [updated] = await db.update(complianceDocumentsTable).set({
    status: "rejected",
    rejectionReason: reason,
    adminNotes: parsed.data.notes ?? doc.adminNotes,
    reviewedByProfileId: profile.id,
    reviewedAt: new Date(),
  }).where(eq(complianceDocumentsTable.id, id)).returning();
  await recordComplianceAudit({ documentId: id, action: "rejected", actorProfileId: profile.id, previousStatus: doc.status, nextStatus: "rejected", reason, notes: parsed.data.notes ?? null });
  await createComplianceEvent({ document: updated, eventType: "document_rejected", message: `${updated.documentType} rejected: ${reason}` });
  res.json(serializeComplianceDocument(updated));
});

router.post("/compliance/documents/:id/request-update", requireProfile, async (req, res): Promise<void> => {
  const profile = getRequestProfile(req);
  if (!(await isAdmin(req))) { res.status(403).json({ error: "Admin access required." }); return; }
  const id = Number(req.params.id);
  const doc = await loadDocument(id);
  if (!doc) { res.status(404).json({ error: "Document not found." }); return; }
  const parsed = ReviewBody.safeParse(req.body ?? {});
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const reason = parsed.data.reason ?? "New upload requested.";
  const [updated] = await db.update(complianceDocumentsTable).set({
    status: "needs_update",
    rejectionReason: reason,
    adminNotes: parsed.data.notes ?? doc.adminNotes,
    reviewedByProfileId: profile.id,
    reviewedAt: new Date(),
  }).where(eq(complianceDocumentsTable.id, id)).returning();
  await recordComplianceAudit({ documentId: id, action: "requested_update", actorProfileId: profile.id, previousStatus: doc.status, nextStatus: "needs_update", reason });
  await createComplianceEvent({ document: updated, eventType: "document_needs_update", message: `${updated.documentType} needs a new upload: ${reason}` });
  res.json(serializeComplianceDocument(updated));
});

router.get("/admin/compliance/dashboard", requireProfile, async (req, res): Promise<void> => {
  if (!(await isAdmin(req))) { res.status(403).json({ error: "Admin access required." }); return; }
  res.json(await dashboardCounts());
});

router.get("/admin/compliance/expiring", requireProfile, async (req, res): Promise<void> => {
  if (!(await isAdmin(req))) { res.status(403).json({ error: "Admin access required." }); return; }
  const days = Number(req.query.days ?? 30);
  const safeDays = days <= 7 ? 7 : days <= 14 ? 14 : 30;
  const docs = await expiringDocuments(safeDays as 7 | 14 | 30);
  res.json({ documents: docs.map((doc) => serializeComplianceDocument(doc)) });
});

router.get("/admin/compliance/expired", requireProfile, async (req, res): Promise<void> => {
  if (!(await isAdmin(req))) { res.status(403).json({ error: "Admin access required." }); return; }
  const docs = await expiredDocuments();
  res.json({ documents: docs.map((doc) => serializeComplianceDocument(doc)) });
});

router.get("/compliance/vendors/:profileId/status", requireProfile, async (req, res): Promise<void> => {
  if (!(await isAdmin(req))) { res.status(403).json({ error: "Admin access required." }); return; }
  const profileId = Number(req.params.profileId);
  res.json(buildComplianceSummary(await documentsForProfile(profileId), REQUIRED_VENDOR_DOCUMENTS));
});

router.get("/compliance/drivers/:profileId/status", requireProfile, async (req, res): Promise<void> => {
  const profile = getRequestProfile(req);
  const profileId = Number(req.params.profileId);
  if (profile.id !== profileId && !(await isAdmin(req))) { res.status(403).json({ error: "Drivers only manage their own compliance documents." }); return; }
  res.json(buildComplianceSummary(await documentsForProfile(profileId), REQUIRED_DRIVER_DOCUMENTS));
});

router.get("/compliance/documents/:id/versions", requireProfile, async (req, res): Promise<void> => {
  const doc = await loadDocument(Number(req.params.id));
  if (!doc) { res.status(404).json({ error: "Document not found." }); return; }
  if (!(await requireDocumentAccess(req, res, doc))) return;
  const versions = await db.select().from(complianceDocumentVersionsTable).where(eq(complianceDocumentVersionsTable.documentId, doc.id));
  res.json({ versions });
});

export default router;
