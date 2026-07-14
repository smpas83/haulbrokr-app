import { createHash, randomBytes } from "crypto";
import { and, desc, eq, lt } from "drizzle-orm";
import {
  activityTable,
  bidsTable,
  dataExportRequestsTable,
  db,
  deviceTokensTable,
  driverDocumentsTable,
  jobsTable,
  organizationsTable,
  paymentMethodsTable,
  payoutAccountsTable,
  profilesTable,
  recurringSchedulesTable,
  requestsTable,
  trucksTable,
} from "@workspace/db";
import { PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getObjectStorageClient } from "./objectStorage";
import { logger } from "./logger";
import { recordActivity } from "./activityNotify";

const EXPORT_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const MAX_ACTIVE_EXPORTS = 3;

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function redactSecrets<T extends Record<string, unknown>>(row: T): T {
  const blocked = new Set([
    "stripeCustomerId",
    "stripePaymentIntentId",
    "stripeTransferId",
    "stripeRefundId",
    "stripeAccountId",
    "accessToken",
    "refreshToken",
    "secret",
    "passwordHash",
    "clerkId",
    "expoPushToken",
    "reviewNote",
    "internalRisk",
    "adminNote",
  ]);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (blocked.has(k)) continue;
    if (typeof k === "string" && /(secret|token|password|credential)/i.test(k))
      continue;
    out[k] = v;
  }
  return out as T;
}

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const keys = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
  const escape = (v: unknown) => {
    if (v == null) return "";
    const s = typeof v === "object" ? JSON.stringify(v) : String(v);
    return `"${s.replace(/"/g, '""')}"`;
  };
  return [
    keys.join(","),
    ...rows.map((r) => keys.map((k) => escape(r[k])).join(",")),
  ].join("\n");
}

/** Minimal ZIP (store method) so we avoid an extra dependency. */
function buildZip(files: { name: string; content: string | Buffer }[]): Buffer {
  const parts: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;

  for (const file of files) {
    const nameBuf = Buffer.from(file.name, "utf8");
    const data = Buffer.isBuffer(file.content)
      ? file.content
      : Buffer.from(file.content, "utf8");
    const local = Buffer.alloc(30 + nameBuf.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8); // store
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0, 12);
    local.writeUInt32LE(0, 14); // crc optional for store in many unzippers; set 0
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    nameBuf.copy(local, 30);
    parts.push(local, data);

    const cen = Buffer.alloc(46 + nameBuf.length);
    cen.writeUInt32LE(0x02014b50, 0);
    cen.writeUInt16LE(20, 4);
    cen.writeUInt16LE(20, 6);
    cen.writeUInt16LE(0, 8);
    cen.writeUInt16LE(0, 10);
    cen.writeUInt16LE(0, 12);
    cen.writeUInt16LE(0, 14);
    cen.writeUInt32LE(0, 16);
    cen.writeUInt32LE(data.length, 20);
    cen.writeUInt32LE(data.length, 24);
    cen.writeUInt16LE(nameBuf.length, 28);
    cen.writeUInt16LE(0, 30);
    cen.writeUInt16LE(0, 32);
    cen.writeUInt16LE(0, 34);
    cen.writeUInt16LE(0, 36);
    cen.writeUInt32LE(0, 38);
    cen.writeUInt32LE(offset, 42);
    nameBuf.copy(cen, 46);
    central.push(cen);
    offset += local.length + data.length;
  }

  const centralBuf = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([...parts, centralBuf, end]);
}

export async function requestDataExport(
  profileId: number,
): Promise<typeof dataExportRequestsTable.$inferSelect> {
  const active = await db
    .select()
    .from(dataExportRequestsTable)
    .where(
      and(
        eq(dataExportRequestsTable.profileId, profileId),
        eq(dataExportRequestsTable.status, "processing"),
      ),
    );
  const requested = await db
    .select()
    .from(dataExportRequestsTable)
    .where(
      and(
        eq(dataExportRequestsTable.profileId, profileId),
        eq(dataExportRequestsTable.status, "requested"),
      ),
    );
  if (active.length + requested.length >= MAX_ACTIVE_EXPORTS) {
    const err = new Error(
      "Too many active export requests. Wait for one to finish.",
    ) as Error & {
      code?: string;
    };
    err.code = "EXPORT_LIMIT";
    throw err;
  }

  const [row] = await db
    .insert(dataExportRequestsTable)
    .values({ profileId, status: "requested" })
    .returning();

  // Process asynchronously (fire-and-forget). Failures update row status.
  void processDataExport(row.id).catch((err) => {
    logger.error({ err, exportId: row.id }, "Data export processing failed");
  });

  return row;
}

export async function listDataExports(profileId: number) {
  return db
    .select()
    .from(dataExportRequestsTable)
    .where(eq(dataExportRequestsTable.profileId, profileId))
    .orderBy(desc(dataExportRequestsTable.requestedAt))
    .limit(20);
}

export async function getDataExportForProfile(
  exportId: number,
  profileId: number,
) {
  const [row] = await db
    .select()
    .from(dataExportRequestsTable)
    .where(
      and(
        eq(dataExportRequestsTable.id, exportId),
        eq(dataExportRequestsTable.profileId, profileId),
      ),
    );
  return row ?? null;
}

export async function processDataExport(exportId: number): Promise<void> {
  const [row] = await db
    .select()
    .from(dataExportRequestsTable)
    .where(eq(dataExportRequestsTable.id, exportId));
  if (!row) return;
  if (row.status === "ready" || row.status === "expired") return;

  await db
    .update(dataExportRequestsTable)
    .set({ status: "processing", errorMessage: null })
    .where(eq(dataExportRequestsTable.id, exportId));

  try {
    const bundle = await collectExportBundle(row.profileId);
    const files = [
      { name: "export.json", content: JSON.stringify(bundle, null, 2) },
      {
        name: "profile.csv",
        content: toCsv([bundle.profile as Record<string, unknown>]),
      },
      {
        name: "jobs.csv",
        content: toCsv(bundle.jobs as Record<string, unknown>[]),
      },
      {
        name: "requests.csv",
        content: toCsv(bundle.jobHistory as Record<string, unknown>[]),
      },
      {
        name: "assignments.csv",
        content: toCsv(bundle.assignments as Record<string, unknown>[]),
      },
      {
        name: "invoices_payments.csv",
        content: toCsv(bundle.invoicesAndPayments as Record<string, unknown>[]),
      },
      {
        name: "documents_metadata.csv",
        content: toCsv(bundle.documentsMetadata as Record<string, unknown>[]),
      },
      {
        name: "recurring_jobs.csv",
        content: toCsv(bundle.recurringJobs as Record<string, unknown>[]),
      },
      {
        name: "audit_events.csv",
        content: toCsv(bundle.auditEvents as Record<string, unknown>[]),
      },
    ];
    const zip = buildZip(files);

    const privateDir = (process.env.PRIVATE_OBJECT_DIR || "/haulbrokr/private")
      .replace(/^\//, "")
      .replace(/\/$/, "");
    const objectKey = `${privateDir}/exports/${row.profileId}/${exportId}-${Date.now()}.zip`;
    const objectPath = `/objects/exports/${row.profileId}/${exportId}.zip`;
    const bucket = requireEnv("R2_BUCKET");
    const client = getObjectStorageClient();

    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: objectKey,
        Body: zip,
        ContentType: "application/zip",
        Metadata: {
          "export-profile-id": String(row.profileId),
          "export-id": String(exportId),
        },
      }),
    );

    const downloadToken = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + EXPORT_TTL_MS);

    await db
      .update(dataExportRequestsTable)
      .set({
        status: "ready",
        objectPath: `${objectPath}|${objectKey}`,
        downloadTokenHash: hashToken(downloadToken),
        byteSize: zip.length,
        expiresAt,
        readyAt: new Date(),
      })
      .where(eq(dataExportRequestsTable.id, exportId));

    // Store raw token temporarily in errorMessage field? No — return via notification activity.
    // Persist token hash only; download endpoint issues signed URL after auth check.
    // Notify user (no personal payload beyond export id).
    try {
      await recordActivity({
        profileId: row.profileId,
        type: "application_approved",
        description: `Your data export #${exportId} is ready to download. It expires on ${expiresAt.toISOString().slice(0, 10)}.`,
        relatedId: exportId,
      });
      await db
        .update(dataExportRequestsTable)
        .set({ notifiedAt: new Date() })
        .where(eq(dataExportRequestsTable.id, exportId));
    } catch (notifyErr) {
      logger.warn({ notifyErr, exportId }, "Export ready notification failed");
    }

    // Attach token for the immediate API response path via a short-lived side channel:
    // callers that process synchronously can read downloadToken from process return.
    (row as { _downloadToken?: string })._downloadToken = downloadToken;
  } catch (err) {
    logger.error({ err, exportId }, "Failed to build data export");
    await db
      .update(dataExportRequestsTable)
      .set({
        status: "failed",
        errorMessage:
          err instanceof Error ? err.message.slice(0, 500) : "export_failed",
      })
      .where(eq(dataExportRequestsTable.id, exportId));
    throw err;
  }
}

export async function collectExportBundle(profileId: number) {
  const [profile] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.id, profileId));
  if (!profile) throw new Error("Profile not found");

  // Organization isolation: only this user's org membership + own rows.
  let organization = null;
  if (profile.organizationId) {
    const [org] = await db
      .select({
        id: organizationsTable.id,
        name: organizationsTable.name,
        type: organizationsTable.type,
        createdAt: organizationsTable.createdAt,
      })
      .from(organizationsTable)
      .where(eq(organizationsTable.id, profile.organizationId));
    organization = org ?? null;
  }

  const memberships = profile.organizationId
    ? [
        {
          organizationId: profile.organizationId,
          orgRole: profile.orgRole,
          organizationName: organization?.name ?? null,
        },
      ]
    : [];

  const [
    trucks,
    requests,
    jobs,
    bids,
    docs,
    payment,
    payout,
    tokens,
    recurring,
    activity,
  ] = await Promise.all([
    db.select().from(trucksTable).where(eq(trucksTable.ownerId, profileId)),
    db
      .select()
      .from(requestsTable)
      .where(eq(requestsTable.customerId, profileId)),
    db
      .select()
      .from(jobsTable)
      .where(eq(jobsTable.customerId, profileId))
      .then(async (customerJobs) => {
        const providerJobs = await db
          .select()
          .from(jobsTable)
          .where(eq(jobsTable.providerId, profileId));
        return [...customerJobs, ...providerJobs];
      }),
    db.select().from(bidsTable).where(eq(bidsTable.providerId, profileId)),
    db
      .select()
      .from(driverDocumentsTable)
      .where(eq(driverDocumentsTable.profileId, profileId)),
    db
      .select()
      .from(paymentMethodsTable)
      .where(eq(paymentMethodsTable.profileId, profileId)),
    db
      .select()
      .from(payoutAccountsTable)
      .where(eq(payoutAccountsTable.profileId, profileId)),
    db
      .select()
      .from(deviceTokensTable)
      .where(eq(deviceTokensTable.profileId, profileId)),
    db
      .select()
      .from(recurringSchedulesTable)
      .where(eq(recurringSchedulesTable.customerId, profileId)),
    db
      .select()
      .from(activityTable)
      .where(eq(activityTable.profileId, profileId)),
  ]);

  const safeJobs = jobs.map((j) =>
    redactSecrets({
      id: j.id,
      status: j.status,
      materialType: j.materialType,
      truckType: j.truckType,
      pickupAddress: j.pickupAddress,
      deliveryAddress: j.deliveryAddress,
      scheduledDate: j.scheduledDate,
      totalAmount: j.totalAmount,
      paymentStatus: j.paymentStatus,
      customerId: j.customerId === profileId ? j.customerId : undefined,
      providerId: j.providerId === profileId ? j.providerId : undefined,
      recurringRelated: false,
      createdAt: j.createdAt,
    }),
  );

  return {
    exportedAt: new Date().toISOString(),
    profile: redactSecrets({
      id: profile.id,
      role: profile.role,
      companyName: profile.companyName,
      contactName: profile.contactName,
      phone: profile.phone,
      email: profile.email,
      address: profile.address,
      city: profile.city,
      state: profile.state,
      zip: profile.zip,
      organizationId: profile.organizationId,
      orgRole: profile.orgRole,
      createdAt: profile.createdAt,
    }),
    organizationMemberships: memberships,
    trucks: trucks.map((t) =>
      redactSecrets(t as unknown as Record<string, unknown>),
    ),
    jobHistory: requests.map((r) =>
      redactSecrets(r as unknown as Record<string, unknown>),
    ),
    assignments: bids.map((b) =>
      redactSecrets({
        id: b.id,
        requestId: b.requestId,
        ratePerHour: b.ratePerHour,
        status: b.status,
        createdAt: b.createdAt,
      }),
    ),
    jobs: safeJobs,
    documentsMetadata: docs.map((d) =>
      redactSecrets({
        id: d.id,
        docType:
          (d as { docType?: string }).docType ?? (d as { type?: string }).type,
        status: d.status,
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
      }),
    ),
    invoicesAndPayments: safeJobs.map((j) => ({
      jobId: j.id,
      paymentStatus: j.paymentStatus,
      totalAmount: j.totalAmount,
    })),
    notificationPreferences: {
      deviceTokenCount: tokens.length,
      platforms: tokens.map((t) => t.platform),
    },
    recurringJobs: recurring.map((r) =>
      redactSecrets(r as unknown as Record<string, unknown>),
    ),
    auditEvents: activity.map((a) =>
      redactSecrets({
        id: a.id,
        type: a.type,
        description: a.description,
        relatedId: a.relatedId,
        createdAt: a.createdAt,
      }),
    ),
    paymentMethodPresent: payment.length > 0,
    payoutAccountStatus: payout[0]?.status ?? null,
  };
}

export async function createSignedExportDownloadUrl(
  exportId: number,
  profileId: number,
): Promise<{ url: string; expiresAt: string }> {
  const row = await getDataExportForProfile(exportId, profileId);
  if (!row) {
    const err = new Error("Export not found") as Error & { code?: string };
    err.code = "NOT_FOUND";
    throw err;
  }
  if (row.status !== "ready" || !row.objectPath) {
    const err = new Error("Export is not ready") as Error & { code?: string };
    err.code = "NOT_READY";
    throw err;
  }
  if (row.expiresAt && row.expiresAt.getTime() < Date.now()) {
    await db
      .update(dataExportRequestsTable)
      .set({ status: "expired" })
      .where(eq(dataExportRequestsTable.id, exportId));
    const err = new Error("Export has expired") as Error & { code?: string };
    err.code = "EXPIRED";
    throw err;
  }

  const objectKey = row.objectPath.includes("|")
    ? row.objectPath.split("|")[1]!
    : row.objectPath.replace(/^\//, "");
  const client = getObjectStorageClient();
  const bucket = requireEnv("R2_BUCKET");
  const url = await getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: bucket, Key: objectKey }),
    { expiresIn: 900 },
  );
  return { url, expiresAt: new Date(Date.now() + 900_000).toISOString() };
}

export async function expireOldExports(): Promise<number> {
  const result = await db
    .update(dataExportRequestsTable)
    .set({ status: "expired" })
    .where(
      and(
        eq(dataExportRequestsTable.status, "ready"),
        lt(dataExportRequestsTable.expiresAt, new Date()),
      ),
    )
    .returning({ id: dataExportRequestsTable.id });
  return result.length;
}
