import { Router, type IRouter, type Request } from "express";
import { and, eq, lte, gt, desc, isNotNull } from "drizzle-orm";
import {
  db,
  complianceDocumentsTable,
  complianceDocumentHistoryTable,
  trucksTable,
  type ComplianceDocument,
  type ComplianceOwnerType,
  COMPLIANCE_OWNER_TYPES,
} from "@workspace/db";
import { requireProfile, getRequestProfile } from "../middlewares/requireAuth";
import {
  attachStaffSession,
  requireStaffOrProfile,
} from "../middlewares/staffAuth";
import { attachClerkProfileIfPresent } from "../middlewares/requireAuth";
import { requirePermission } from "../middlewares/requireAdmin";
import {
  summarizeCompliance,
  isValidDocTypeForOwner,
  isExpired,
  isExpiringWithin,
  effectiveStatus,
  driverCanAcceptJobs,
  vendorCanReceiveDispatch,
  truckCanBeAssigned,
} from "../lib/complianceDocuments";
import { safeNotify } from "../lib/notifications";

const router: IRouter = Router();

const VALID_DAYS_DEFAULT = 30;

function isStaff(req: Request): boolean {
  return !!req.staffUser;
}

/** Record an immutable audit-log entry for a document state change. */
async function recordHistory(input: {
  documentId: number;
  action: string;
  fromStatus: string | null;
  toStatus: string | null;
  actorProfileId: number | null;
  version: number | null;
  note: string | null;
}): Promise<void> {
  await db.insert(complianceDocumentHistoryTable).values({
    documentId: input.documentId,
    action: input.action,
    fromStatus: input.fromStatus,
    toStatus: input.toStatus,
    actorProfileId: input.actorProfileId,
    version: input.version,
    note: input.note,
  });
}

async function loadCurrentForProfile(
  profileId: number,
): Promise<ComplianceDocument[]> {
  return db
    .select()
    .from(complianceDocumentsTable)
    .where(
      and(
        eq(complianceDocumentsTable.profileId, profileId),
        eq(complianceDocumentsTable.isCurrent, true),
      ),
    );
}

async function loadCurrentForTruck(
  truckId: number,
): Promise<ComplianceDocument[]> {
  return db
    .select()
    .from(complianceDocumentsTable)
    .where(
      and(
        eq(complianceDocumentsTable.truckId, truckId),
        eq(complianceDocumentsTable.isCurrent, true),
      ),
    );
}

function parseId(raw: unknown): number | null {
  const v = Array.isArray(raw) ? raw[0] : raw;
  const n = parseInt(String(v), 10);
  return Number.isNaN(n) || n <= 0 ? null : n;
}

// ---- Summaries -----------------------------------------------------------

async function profileSummaryHandler(
  ownerType: Extract<ComplianceOwnerType, "vendor" | "driver">,
  req: Request,
  res: Parameters<Parameters<IRouter["get"]>[1]>[1],
): Promise<void> {
  const profileId = parseId(req.params.profileId);
  if (profileId === null) {
    res.status(400).json({ error: "Invalid profile id" });
    return;
  }
  const profile = req.profile;
  if (!isStaff(req) && profile?.id !== profileId) {
    res.status(403).json({ error: "Access denied" });
    return;
  }
  const docs = await loadCurrentForProfile(profileId);
  const summary = summarizeCompliance(ownerType, docs);
  const gate =
    ownerType === "driver"
      ? driverCanAcceptJobs(docs)
      : vendorCanReceiveDispatch(docs);
  res.json({
    ...summary,
    profileId,
    canAcceptJobs: ownerType === "driver" ? gate.allowed : undefined,
    canReceiveDispatch: ownerType === "vendor" ? gate.allowed : undefined,
    blockers: gate.blockers,
  });
}

router.get(
  "/compliance/vendors/:profileId/summary",
  requireProfile,
  (req, res) => {
    void profileSummaryHandler("vendor", req, res);
  },
);

router.get(
  "/compliance/drivers/:profileId/summary",
  requireProfile,
  (req, res) => {
    void profileSummaryHandler("driver", req, res);
  },
);

router.get(
  "/compliance/fleet/:truckId/summary",
  requireProfile,
  async (req, res): Promise<void> => {
    const truckId = parseId(req.params.truckId);
    if (truckId === null) {
      res.status(400).json({ error: "Invalid truck id" });
      return;
    }
    const [truck] = await db
      .select()
      .from(trucksTable)
      .where(eq(trucksTable.id, truckId));
    if (!truck) {
      res.status(404).json({ error: "Truck not found" });
      return;
    }
    const profile = req.profile;
    if (!isStaff(req) && profile?.id !== truck.ownerId) {
      res.status(403).json({ error: "Access denied" });
      return;
    }
    const docs = await loadCurrentForTruck(truckId);
    const summary = summarizeCompliance("fleet", docs);
    const gate = truckCanBeAssigned(docs);
    res.json({
      ...summary,
      truckId,
      canBeAssigned: gate.allowed,
      blockers: gate.blockers,
    });
  },
);

// ---- Upload / replace ----------------------------------------------------

interface UploadBody {
  ownerType?: string;
  docType?: string;
  profileId?: number;
  truckId?: number;
  objectPath?: string;
  fileName?: string;
  mimeType?: string;
  docNumber?: string;
  issuedAt?: string;
  expiresAt?: string;
}

function parseDate(value: string | undefined): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

router.post(
  "/compliance/documents",
  requireProfile,
  async (req, res): Promise<void> => {
    const profile = getRequestProfile(req);
    const body = (req.body ?? {}) as UploadBody;
    const ownerType = body.ownerType as ComplianceOwnerType;
    if (!COMPLIANCE_OWNER_TYPES.includes(ownerType)) {
      res.status(400).json({ error: "Invalid ownerType" });
      return;
    }
    if (!body.docType || !isValidDocTypeForOwner(ownerType, body.docType)) {
      res.status(400).json({ error: "Invalid docType for ownerType" });
      return;
    }

    let subjectProfileId: number | null = null;
    let truckId: number | null = null;

    if (ownerType === "fleet") {
      truckId = body.truckId ?? null;
      if (truckId === null) {
        res.status(400).json({ error: "truckId is required for fleet documents" });
        return;
      }
      const [truck] = await db
        .select()
        .from(trucksTable)
        .where(eq(trucksTable.id, truckId));
      if (!truck) {
        res.status(404).json({ error: "Truck not found" });
        return;
      }
      subjectProfileId = truck.ownerId;
      if (!isStaff(req) && profile.id !== truck.ownerId) {
        res.status(403).json({ error: "Access denied" });
        return;
      }
    } else {
      subjectProfileId = body.profileId ?? profile.id;
      if (!isStaff(req) && profile.id !== subjectProfileId) {
        res.status(403).json({ error: "Access denied" });
        return;
      }
    }

    const expiresAt = parseDate(body.expiresAt);
    const issuedAt = parseDate(body.issuedAt);

    // Supersede a current row of the same (subject, docType): bumps version.
    const existing = await currentDocFor(ownerType, subjectProfileId, truckId, body.docType);
    const version = existing ? (existing.version ?? 1) + 1 : 1;
    if (existing) {
      await db
        .update(complianceDocumentsTable)
        .set({ isCurrent: false })
        .where(eq(complianceDocumentsTable.id, existing.id));
    }

    const [created] = await db
      .insert(complianceDocumentsTable)
      .values({
        ownerType,
        profileId: subjectProfileId,
        truckId,
        docType: body.docType,
        status: "pending",
        version,
        isCurrent: true,
        objectPath: body.objectPath ?? null,
        fileName: body.fileName ?? null,
        mimeType: body.mimeType ?? null,
        docNumber: body.docNumber ?? null,
        issuedAt: issuedAt ?? null,
        expiresAt: expiresAt ?? null,
        uploadedByProfileId: profile.id,
      })
      .returning();

    await recordHistory({
      documentId: created.id,
      action: existing ? "replaced" : "uploaded",
      fromStatus: existing ? (existing.status ?? null) : null,
      toStatus: "pending",
      actorProfileId: profile.id,
      version,
      note: null,
    });

    res.status(201).json(created);
  },
);

async function currentDocFor(
  ownerType: ComplianceOwnerType,
  profileId: number | null,
  truckId: number | null,
  docType: string,
): Promise<ComplianceDocument | undefined> {
  const conds = [
    eq(complianceDocumentsTable.docType, docType),
    eq(complianceDocumentsTable.isCurrent, true),
    eq(complianceDocumentsTable.ownerType, ownerType),
  ];
  if (ownerType === "fleet" && truckId !== null) {
    conds.push(eq(complianceDocumentsTable.truckId, truckId));
  } else if (profileId !== null) {
    conds.push(eq(complianceDocumentsTable.profileId, profileId));
  }
  const [row] = await db
    .select()
    .from(complianceDocumentsTable)
    .where(and(...conds));
  return row;
}

router.put(
  "/compliance/documents/:id/replace",
  requireProfile,
  async (req, res): Promise<void> => {
    const profile = getRequestProfile(req);
    const id = parseId(req.params.id);
    if (id === null) {
      res.status(400).json({ error: "Invalid document id" });
      return;
    }
    const [existing] = await db
      .select()
      .from(complianceDocumentsTable)
      .where(eq(complianceDocumentsTable.id, id));
    if (!existing) {
      res.status(404).json({ error: "Document not found" });
      return;
    }
    if (!isStaff(req) && profile.id !== existing.profileId) {
      res.status(403).json({ error: "Access denied" });
      return;
    }

    const body = (req.body ?? {}) as UploadBody;
    const expiresAt = parseDate(body.expiresAt);
    const issuedAt = parseDate(body.issuedAt);
    const version = (existing.version ?? 1) + 1;

    await db
      .update(complianceDocumentsTable)
      .set({ isCurrent: false })
      .where(eq(complianceDocumentsTable.id, existing.id));

    const [created] = await db
      .insert(complianceDocumentsTable)
      .values({
        ownerType: existing.ownerType,
        profileId: existing.profileId,
        truckId: existing.truckId,
        docType: existing.docType,
        status: "pending",
        version,
        isCurrent: true,
        objectPath: body.objectPath ?? existing.objectPath,
        fileName: body.fileName ?? existing.fileName,
        mimeType: body.mimeType ?? existing.mimeType,
        docNumber: body.docNumber ?? existing.docNumber,
        issuedAt: issuedAt === undefined ? existing.issuedAt : issuedAt,
        expiresAt: expiresAt === undefined ? existing.expiresAt : expiresAt,
        uploadedByProfileId: profile.id,
      })
      .returning();

    await recordHistory({
      documentId: created.id,
      action: "replaced",
      fromStatus: existing.status ?? null,
      toStatus: "pending",
      actorProfileId: profile.id,
      version,
      note: null,
    });

    res.status(201).json(created);
  },
);

router.get(
  "/compliance/documents/:id/history",
  requireProfile,
  async (req, res): Promise<void> => {
    const profile = getRequestProfile(req);
    const id = parseId(req.params.id);
    if (id === null) {
      res.status(400).json({ error: "Invalid document id" });
      return;
    }
    const [doc] = await db
      .select()
      .from(complianceDocumentsTable)
      .where(eq(complianceDocumentsTable.id, id));
    if (!doc) {
      res.status(404).json({ error: "Document not found" });
      return;
    }
    if (!isStaff(req) && profile.id !== doc.profileId) {
      res.status(403).json({ error: "Access denied" });
      return;
    }

    if (doc.ownerType !== "fleet" && doc.profileId == null) {
      res.status(400).json({ error: "Document is missing an owner profile" });
      return;
    }
    const subjectCond =
      doc.ownerType === "fleet" && doc.truckId
        ? eq(complianceDocumentsTable.truckId, doc.truckId)
        : eq(complianceDocumentsTable.profileId, doc.profileId!);
    const versions = await db
      .select()
      .from(complianceDocumentsTable)
      .where(
        and(
          eq(complianceDocumentsTable.ownerType, doc.ownerType),
          eq(complianceDocumentsTable.docType, doc.docType),
          subjectCond,
        ),
      )
      .orderBy(desc(complianceDocumentsTable.version));
    const auditLog = await db
      .select()
      .from(complianceDocumentHistoryTable)
      .where(eq(complianceDocumentHistoryTable.documentId, id))
      .orderBy(desc(complianceDocumentHistoryTable.createdAt));
    res.json({ documentId: id, versions, auditLog });
  },
);

// ---- Admin review + dashboards ------------------------------------------

const adminRouter: IRouter = Router();
adminRouter.use(attachStaffSession);
adminRouter.use(attachClerkProfileIfPresent);

adminRouter.post(
  "/admin/compliance/documents/:id/approve",
  requireStaffOrProfile,
  requirePermission("compliance"),
  async (req, res): Promise<void> => {
    const id = parseId(req.params.id);
    if (id === null) {
      res.status(400).json({ error: "Invalid document id" });
      return;
    }
    const [doc] = await db
      .select()
      .from(complianceDocumentsTable)
      .where(eq(complianceDocumentsTable.id, id));
    if (!doc) {
      res.status(404).json({ error: "Document not found" });
      return;
    }
    const note = typeof req.body?.note === "string" ? req.body.note : null;
    const actorProfileId = req.profile?.id ?? null;
    const [updated] = await db
      .update(complianceDocumentsTable)
      .set({
        status: "approved",
        reviewedByProfileId: actorProfileId,
        reviewedAt: new Date(),
        reviewNote: note,
        rejectionReason: null,
      })
      .where(eq(complianceDocumentsTable.id, id))
      .returning();
    await recordHistory({
      documentId: id,
      action: "approved",
      fromStatus: doc.status ?? null,
      toStatus: "approved",
      actorProfileId,
      version: doc.version ?? null,
      note,
    });
    if (doc.profileId) {
      await safeNotify({
        recipientProfileId: doc.profileId,
        type: "compliance_approved",
        title: `${doc.docType} approved`,
        body: `Your ${doc.docType} document was approved.`,
        relatedType: "compliance_document",
        relatedId: id,
      });
    }
    res.json(updated);
  },
);

adminRouter.post(
  "/admin/compliance/documents/:id/reject",
  requireStaffOrProfile,
  requirePermission("compliance"),
  async (req, res): Promise<void> => {
    const id = parseId(req.params.id);
    if (id === null) {
      res.status(400).json({ error: "Invalid document id" });
      return;
    }
    const reason =
      typeof req.body?.reason === "string" ? req.body.reason.trim() : "";
    if (!reason) {
      res.status(400).json({ error: "A rejection reason is required" });
      return;
    }
    const [doc] = await db
      .select()
      .from(complianceDocumentsTable)
      .where(eq(complianceDocumentsTable.id, id));
    if (!doc) {
      res.status(404).json({ error: "Document not found" });
      return;
    }
    const actorProfileId = req.profile?.id ?? null;
    const [updated] = await db
      .update(complianceDocumentsTable)
      .set({
        status: "rejected",
        reviewedByProfileId: actorProfileId,
        reviewedAt: new Date(),
        rejectionReason: reason,
      })
      .where(eq(complianceDocumentsTable.id, id))
      .returning();
    await recordHistory({
      documentId: id,
      action: "rejected",
      fromStatus: doc.status ?? null,
      toStatus: "rejected",
      actorProfileId,
      version: doc.version ?? null,
      note: reason,
    });
    if (doc.profileId) {
      await safeNotify({
        recipientProfileId: doc.profileId,
        type: "compliance_rejected",
        title: `${doc.docType} needs attention`,
        body: `Your ${doc.docType} document was rejected: ${reason}`,
        relatedType: "compliance_document",
        relatedId: id,
      });
    }
    res.json(updated);
  },
);

adminRouter.post(
  "/admin/compliance/documents/:id/needs-update",
  requireStaffOrProfile,
  requirePermission("compliance"),
  async (req, res): Promise<void> => {
    const id = parseId(req.params.id);
    if (id === null) {
      res.status(400).json({ error: "Invalid document id" });
      return;
    }
    const note = typeof req.body?.note === "string" ? req.body.note.trim() : "";
    if (!note) {
      res.status(400).json({ error: "A note is required" });
      return;
    }
    const [doc] = await db
      .select()
      .from(complianceDocumentsTable)
      .where(eq(complianceDocumentsTable.id, id));
    if (!doc) {
      res.status(404).json({ error: "Document not found" });
      return;
    }
    const actorProfileId = req.profile?.id ?? null;
    const [updated] = await db
      .update(complianceDocumentsTable)
      .set({
        status: "needs_update",
        reviewedByProfileId: actorProfileId,
        reviewedAt: new Date(),
        reviewNote: note,
      })
      .where(eq(complianceDocumentsTable.id, id))
      .returning();
    await recordHistory({
      documentId: id,
      action: "needs_update",
      fromStatus: doc.status ?? null,
      toStatus: "needs_update",
      actorProfileId,
      version: doc.version ?? null,
      note,
    });
    if (doc.profileId) {
      await safeNotify({
        recipientProfileId: doc.profileId,
        type: "compliance_rejected",
        title: `${doc.docType} needs an update`,
        body: note,
        relatedType: "compliance_document",
        relatedId: id,
        channels: ["in_app", "email", "push", "realtime"],
      });
    }
    res.json(updated);
  },
);

adminRouter.post(
  "/admin/compliance/documents/:id/notes",
  requireStaffOrProfile,
  requirePermission("compliance"),
  async (req, res): Promise<void> => {
    const id = parseId(req.params.id);
    if (id === null) {
      res.status(400).json({ error: "Invalid document id" });
      return;
    }
    const note = typeof req.body?.note === "string" ? req.body.note.trim() : "";
    if (!note) {
      res.status(400).json({ error: "A note is required" });
      return;
    }
    const [doc] = await db
      .select()
      .from(complianceDocumentsTable)
      .where(eq(complianceDocumentsTable.id, id));
    if (!doc) {
      res.status(404).json({ error: "Document not found" });
      return;
    }
    const actorProfileId = req.profile?.id ?? null;
    await db
      .update(complianceDocumentsTable)
      .set({ reviewNote: note })
      .where(eq(complianceDocumentsTable.id, id));
    await recordHistory({
      documentId: id,
      action: "note",
      fromStatus: doc.status ?? null,
      toStatus: doc.status ?? null,
      actorProfileId,
      version: doc.version ?? null,
      note,
    });
    res.json({ ok: true });
  },
);

adminRouter.get(
  "/admin/compliance/dashboard",
  requireStaffOrProfile,
  requirePermission("compliance"),
  async (_req, res): Promise<void> => {
    const docs = await db
      .select()
      .from(complianceDocumentsTable)
      .where(eq(complianceDocumentsTable.isCurrent, true));
    const now = new Date();
    const counts: Record<string, number> = {
      pending: 0,
      approved: 0,
      rejected: 0,
      expired: 0,
      needs_update: 0,
    };
    let expiringSoon = 0;
    for (const doc of docs) {
      const status = effectiveStatus(doc, now);
      counts[status] = (counts[status] ?? 0) + 1;
      if (isExpiringWithin(doc, VALID_DAYS_DEFAULT, now)) expiringSoon += 1;
    }
    res.json({
      totalCurrentDocuments: docs.length,
      byStatus: counts,
      pendingReview: counts.pending,
      expired: counts.expired,
      expiringSoon,
    });
  },
);

adminRouter.get(
  "/admin/compliance/expiring",
  requireStaffOrProfile,
  requirePermission("compliance"),
  async (req, res): Promise<void> => {
    const days = Math.max(
      1,
      Math.min(365, parseInt(String(req.query.days ?? VALID_DAYS_DEFAULT), 10) || VALID_DAYS_DEFAULT),
    );
    const now = new Date();
    const horizon = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    const docs = await db
      .select()
      .from(complianceDocumentsTable)
      .where(
        and(
          eq(complianceDocumentsTable.isCurrent, true),
          isNotNull(complianceDocumentsTable.expiresAt),
          gt(complianceDocumentsTable.expiresAt, now),
          lte(complianceDocumentsTable.expiresAt, horizon),
        ),
      )
      .orderBy(desc(complianceDocumentsTable.expiresAt));
    res.json({ days, documents: docs.filter((d) => isExpiringWithin(d, days, now)) });
  },
);

adminRouter.get(
  "/admin/compliance/expired",
  requireStaffOrProfile,
  requirePermission("compliance"),
  async (_req, res): Promise<void> => {
    const now = new Date();
    const docs = await db
      .select()
      .from(complianceDocumentsTable)
      .where(
        and(
          eq(complianceDocumentsTable.isCurrent, true),
          isNotNull(complianceDocumentsTable.expiresAt),
          lte(complianceDocumentsTable.expiresAt, now),
        ),
      )
      .orderBy(desc(complianceDocumentsTable.expiresAt));
    res.json({ documents: docs.filter((d) => isExpired(d, now)) });
  },
);

router.use(adminRouter);

export default router;
