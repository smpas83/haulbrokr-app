/**
 * Dump onboarding traces for every live carrier.
 *
 * Usage:
 *   DATABASE_URL="postgresql://…" pnpm --filter @workspace/api-server exec tsx scripts/dump-onboarding-traces.ts
 */
import { listProviderOnboardingTraces } from "../src/lib/onboardingTrace";

async function main() {
  if (!process.env.DATABASE_URL?.trim()) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }

  const traces = await listProviderOnboardingTraces();
  console.log(`# HaulBrokr Carrier Onboarding Traces`);
  console.log(`Generated: ${new Date().toISOString()}`);
  console.log(`Carriers: ${traces.length}`);
  console.log("");

  for (const t of traces) {
    console.log(`Carrier: ${t.carrier}`);
    console.log(`Created: ${t.created}`);
    console.log(`Last Login: ${t.lastActivity}`);
    console.log(`Profile Complete: ${t.profileComplete}`);
    console.log(`Truck Added: ${t.truckAdded}`);
    console.log(`Insurance Uploaded: ${t.insuranceUploaded}`);
    console.log(`W9 Uploaded: ${t.w9Uploaded}`);
    console.log(`COI Uploaded: ${t.coiUploaded}`);
    console.log(`DOT Verified: ${t.dotVerified}`);
    console.log(`Storage File Exists: ${t.storageFileExists}`);
    console.log(`Database Record Exists: ${t.databaseRecordExists}`);
    console.log(`Admin Can See It: ${t.adminCanSeeIt}`);
    console.log(`Overall Status: ${t.overallStatus}`);
    console.log(`Reason Blocked: ${t.reasonBlocked ?? "—"}`);
    console.log(`Next Action: ${t.nextAction}`);
    console.log("---");
  }

  const stuck = traces.filter((t) => t.overallStatus.startsWith("STUCK_"));
  const awaiting = traces.filter((t) => t.overallStatus === "AWAITING_ADMIN_REVIEW");
  const ready = traces.filter((t) => t.overallStatus === "READY_TO_BID");
  console.log("");
  console.log(`Summary: stuck=${stuck.length} awaiting_review=${awaiting.length} ready=${ready.length}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
