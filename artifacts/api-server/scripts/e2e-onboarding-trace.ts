/**
 * End-to-end onboarding verification against local Postgres + in-memory R2 mock.
 *
 * Proves: profile → document upsert → admin list → staff document view ACL → admin approve
 *
 * Usage:
 *   DATABASE_URL=postgres://... pnpm --filter @workspace/api-server exec tsx scripts/e2e-onboarding-trace.ts
 */
import { eq } from "drizzle-orm";
import {
  db,
  profilesTable,
  driverDocumentsTable,
  staffUsersTable,
  w9SubmissionsTable,
  insuranceSubmissionsTable,
  trucksTable,
} from "@workspace/db";
import {
  buildCarrierOnboardingTrace,
  listProviderOnboardingTraces,
  syncFormPendingFromFileUpload,
  countPendingComplianceWork,
} from "../src/lib/onboardingTrace";
import { reviewProviderUploadedDoc } from "../src/lib/adminComplianceBundle";
import { contentTypesCompatible } from "../src/routes/storage";
import { hashStaffPassword } from "../src/lib/staffPassword";
import { hasPermission } from "../src/middlewares/requireAdmin";
import type { Request } from "express";

async function assert(cond: unknown, msg: string): Promise<void> {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`  PASS: ${msg}`);
}

async function main() {
  if (!process.env.DATABASE_URL?.trim()) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }

  console.log("=== HaulBrokr E2E Onboarding Trace ===");
  console.log("DB:", process.env.DATABASE_URL.replace(/:[^:@/]+@/, ":***@"));
  console.log("");

  // Content-type regression (silent upload delete)
  await assert(contentTypesCompatible("image/jpeg", "application/octet-stream"), "octet-stream uploads are not rejected");
  await assert(!contentTypesCompatible("image/jpeg", "application/x-executable"), "true MIME mismatches still rejected");

  const clerkId = `e2e-onboarding-${Date.now()}`;
  const objectPath = `/objects/uploads/e2e-${Date.now()}`;

  // Clean any prior e2e residue
  await db.delete(profilesTable).where(eq(profilesTable.clerkId, clerkId));

  const [carrier] = await db.insert(profilesTable).values({
    clerkId,
    role: "provider",
    companyName: "E2E Forensic Hauling LLC",
    contactName: "Test Carrier",
    email: `e2e-carrier-${Date.now()}@haulbrokr-test.local`,
    phone: "555-0100",
    city: "Dallas",
    state: "TX",
    equipmentTypes: "dump_truck",
  }).returning();

  console.log(`Created carrier profile #${carrier.id}`);

  let trace = await buildCarrierOnboardingTrace(carrier);
  await assert(trace.overallStatus === "STUCK_AT_W9" || trace.overallStatus.startsWith("STUCK_"), `new carrier stuck: ${trace.overallStatus}`);
  await assert(trace.documentCount === 0, "new carrier has Documents (0)");
  await assert(!trace.canBid, "new carrier cannot bid");

  // Simulate completed upload → DB record (storage finalize already issued storageToken in real flow)
  const [doc] = await db.insert(driverDocumentsTable).values({
    profileId: carrier.id,
    docType: "w9",
    status: "uploaded",
    objectPath,
    fileName: "w9.pdf",
    mimeType: "application/pdf",
    uploadedAt: new Date(),
  }).returning();
  await assert(!!doc.id, "driver_documents row created");

  // Also upload COI
  await db.insert(driverDocumentsTable).values({
    profileId: carrier.id,
    docType: "coi",
    status: "uploaded",
    objectPath: `${objectPath}-coi`,
    fileName: "coi.pdf",
    mimeType: "application/pdf",
    uploadedAt: new Date(),
  });

  // Form stubs so sync + pendingCompliance can move
  await db.insert(w9SubmissionsTable).values({
    profileId: carrier.id,
    legalName: "E2E Forensic Hauling LLC",
    businessType: "multi_member_llc",
    taxIdType: "ein",
    taxIdLast4: "1234",
    address: "1 Test St",
    city: "Dallas",
    state: "TX",
    zip: "75001",
    signatureFullName: "Test Carrier",
    agreedToTerms: "true",
    status: "rejected",
  });
  await syncFormPendingFromFileUpload(carrier.id, "w9");
  const [w9After] = await db.select().from(w9SubmissionsTable).where(eq(w9SubmissionsTable.profileId, carrier.id));
  await assert(w9After.status === "pending", "W-9 form moved to pending after file upload sync");

  await db.insert(trucksTable).values({
    ownerId: carrier.id,
    truckNumber: "E2E-1",
    truckType: "dump_truck",
    capacityTons: "20",
    ratePerHour: "150",
  });
  console.log("  PASS: truck added");

  const counts = await countPendingComplianceWork();
  await assert(counts.documentsPending >= 2, `documentsPending includes uploads (got ${counts.documentsPending})`);
  await assert(counts.totalPending >= counts.documentsPending, "pendingCompliance includes uploaded files");

  const refreshed = await db.select().from(profilesTable).where(eq(profilesTable.id, carrier.id)).then((r) => r[0]);
  trace = await buildCarrierOnboardingTrace(refreshed);
  await assert(trace.documentCount >= 2, `admin sees documents (got ${trace.documentCount})`);
  await assert(trace.pendingDocumentCount >= 2, "pending document count > 0");
  await assert(trace.w9Uploaded === "pending", "W-9 file pending review");
  await assert(trace.databaseRecordExists, "Database Record Exists");
  await assert(trace.adminCanSeeIt, "Admin Can See It");
  await assert(trace.storageFileExists, "Storage File Exists (objectPath set)");

  // Admin approve W-9 upload
  const approved = await reviewProviderUploadedDoc(carrier.id, "w9", true, "E2E approved");
  await assert(approved?.status === "verified", "admin approval sets verified");

  const [w9Verified] = await db.select().from(w9SubmissionsTable).where(eq(w9SubmissionsTable.profileId, carrier.id));
  await assert(w9Verified.status === "verified", "approving W-9 file syncs form to verified");

  // Staff ACL simulation for document viewer
  const staffReq = {
    staffUser: { id: 1, username: "e2e", staffRole: "cto", displayName: "E2E" },
  } as unknown as Request;
  await assert(await hasPermission(staffReq, "compliance"), "staff CTO has compliance permission for document viewer");

  // Outside production with no ADMIN_USER_IDS, Clerk allowlist auto-grants CTO —
  // set an allowlist so anonymous requests are denied (mirrors production).
  process.env.ADMIN_USER_IDS = "user_not_this_one";
  const clerkOnlyReq = { clerkId: undefined, profile: undefined, staffUser: undefined } as unknown as Request;
  await assert(!(await hasPermission(clerkOnlyReq, "compliance")), "unauthenticated has no compliance permission");
  delete process.env.ADMIN_USER_IDS;

  // Ensure staff user can be seeded (for login path)
  const existingStaff = await db.select().from(staffUsersTable).limit(1);
  if (existingStaff.length === 0) {
    const passwordHash = await hashStaffPassword("E2eAdmin!pass");
    await db.insert(staffUsersTable).values({
      username: "e2eadmin",
      passwordHash,
      staffRole: "cto",
      displayName: "E2E Admin",
      active: true,
    });
    console.log("  PASS: seeded staff user e2eadmin");
  } else {
    console.log("  PASS: staff users already present");
  }

  const allTraces = await listProviderOnboardingTraces();
  const mine = allTraces.find((t) => t.profileId === carrier.id);
  await assert(!!mine, "carrier appears in /admin/onboarding-trace list");

  console.log("");
  console.log("--- Carrier Onboarding Trace ---");
  console.log(`Carrier: ${trace.carrier}`);
  console.log(`Created: ${trace.created}`);
  console.log(`Last Login/Activity: ${trace.lastActivity}`);
  console.log(`Profile Complete: ${trace.profileComplete}`);
  console.log(`Truck Added: ${trace.truckAdded}`);
  console.log(`Insurance Uploaded: ${trace.insuranceUploaded}`);
  console.log(`W9 Uploaded: ${trace.w9Uploaded}`);
  console.log(`COI Uploaded: ${trace.coiUploaded}`);
  console.log(`DOT Verified: ${trace.dotVerified}`);
  console.log(`Storage File Exists: ${trace.storageFileExists}`);
  console.log(`Database Record Exists: ${trace.databaseRecordExists}`);
  console.log(`Admin Can See It: ${trace.adminCanSeeIt}`);
  console.log(`Overall Status: ${mine?.overallStatus ?? trace.overallStatus}`);
  console.log(`Reason Blocked: ${mine?.reasonBlocked ?? trace.reasonBlocked}`);
  console.log("");

  // Cleanup
  await db.delete(driverDocumentsTable).where(eq(driverDocumentsTable.profileId, carrier.id));
  await db.delete(w9SubmissionsTable).where(eq(w9SubmissionsTable.profileId, carrier.id));
  await db.delete(insuranceSubmissionsTable).where(eq(insuranceSubmissionsTable.profileId, carrier.id));
  await db.delete(trucksTable).where(eq(trucksTable.ownerId, carrier.id));
  await db.delete(profilesTable).where(eq(profilesTable.id, carrier.id));

  console.log("=== E2E ONBOARDING: PASS ===");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
