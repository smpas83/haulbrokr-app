/**
 * Audit production database for seeded/demo/synthetic marketplace records.
 *
 * Usage:
 *   DATABASE_URL="postgresql://..." pnpm --filter @workspace/api-server exec tsx scripts/audit-production-data.ts
 *
 * Read-only — does not delete anything. Prints a report to stdout.
 */
import "../src/load-env.js";
import { sql } from "drizzle-orm";
import {
  db,
  profilesTable,
  requestsTable,
  jobsTable,
  trucksTable,
} from "@workspace/db";

const DEMO_PROFILE_PATTERNS = [
  "demo-seed-%",
  "demo-seed-provider-%",
  "demo-seed-customer-%",
];

const SUSPICIOUS_TEXT = [
  "lorem ipsum",
  "acme",
  "demo carrier",
  "demo contractor",
  "test user",
  "sample load",
];

async function countWhere(
  table: typeof profilesTable,
  clause: ReturnType<typeof sql>,
) {
  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(table)
    .where(clause);
  return Number(row?.count ?? 0);
}

async function main() {
  if (!process.env.DATABASE_URL?.trim()) {
    console.error("DATABASE_URL is required to audit production data.");
    process.exit(1);
  }

  console.log("HaulBrokr production data audit");
  console.log("Generated:", new Date().toISOString());
  console.log("");

  const demoProfiles = await db
    .select({
      id: profilesTable.id,
      clerkId: profilesTable.clerkId,
      companyName: profilesTable.companyName,
      role: profilesTable.role,
    })
    .from(profilesTable)
    .where(
      sql`${profilesTable.clerkId} like 'demo-seed-%' OR ${profilesTable.email} like '%@haulbrokr-seed.local'`,
    );

  const suspiciousProfiles = await db
    .select({
      id: profilesTable.id,
      clerkId: profilesTable.clerkId,
      companyName: profilesTable.companyName,
      email: profilesTable.email,
    })
    .from(profilesTable)
    .where(
      sql`lower(${profilesTable.companyName}) like '%demo%' OR lower(${profilesTable.companyName}) like '%sample%' OR lower(${profilesTable.companyName}) like '%test%'`,
    );

  const openRequests = await db
    .select({
      id: requestsTable.id,
      pickupAddress: requestsTable.pickupAddress,
      customerId: requestsTable.customerId,
      status: requestsTable.status,
    })
    .from(requestsTable)
    .where(sql`${requestsTable.status} in ('open','bidding','bid_received')`)
    .limit(500);

  const demoCustomerIds = new Set(demoProfiles.map((p) => p.id));

  const seededOpenRequests = openRequests.filter((r) =>
    demoCustomerIds.has(r.customerId),
  );

  const trucks = await db
    .select({
      id: trucksTable.id,
      truckNumber: trucksTable.truckNumber,
      ownerId: trucksTable.ownerId,
    })
    .from(trucksTable)
    .limit(500);

  const demoOwnerIds = new Set(
    demoProfiles.filter((p) => p.role === "provider").map((p) => p.id),
  );
  const seededTrucks = trucks.filter((t) => demoOwnerIds.has(t.ownerId));

  console.log("=== Seeded demo marketplace profiles ===");
  console.log(`Count: ${demoProfiles.length}`);
  for (const p of demoProfiles.slice(0, 20)) {
    console.log(
      `  profile#${p.id} clerkId=${p.clerkId} company=${p.companyName ?? ""} role=${p.role}`,
    );
  }
  if (demoProfiles.length > 20)
    console.log(`  ... and ${demoProfiles.length - 20} more`);

  console.log("");
  console.log("=== Suspicious company names (manual review) ===");
  console.log(`Count: ${suspiciousProfiles.length}`);
  for (const p of suspiciousProfiles.slice(0, 20)) {
    console.log(
      `  profile#${p.id} company=${p.companyName ?? ""} email=${p.email ?? ""}`,
    );
  }

  console.log("");
  console.log("=== Open requests from seeded demo customers ===");
  console.log(`Count: ${seededOpenRequests.length}`);
  for (const r of seededOpenRequests.slice(0, 10)) {
    console.log(
      `  request#${r.id} status=${r.status} pickup=${r.pickupAddress}`,
    );
  }

  console.log("");
  console.log("=== Trucks owned by seeded demo providers ===");
  console.log(`Count: ${seededTrucks.length}`);
  for (const t of seededTrucks.slice(0, 10)) {
    console.log(
      `  truck#${t.id} number=${t.truckNumber ?? ""} ownerId=${t.ownerId}`,
    );
  }

  console.log("");
  console.log("=== Summary ===");
  console.log(`Demo-seed profiles: ${demoProfiles.length}`);
  console.log(
    `Open requests tied to demo customers: ${seededOpenRequests.length}`,
  );
  console.log(`Trucks tied to demo providers: ${seededTrucks.length}`);

  if (demoProfiles.length > 0 || seededOpenRequests.length > 0) {
    console.log("");
    console.log(
      "ACTION: If this is production, remove seeded marketplace rows created by seed-marketplace.ts.",
    );
    console.log(
      "Do not delete without confirming no real users depend on these records.",
    );
  } else {
    console.log("No seeded demo marketplace profiles detected.");
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("Audit failed:", err);
  process.exit(1);
});
