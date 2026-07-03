/**
 * Seed production marketplace with nationwide demo data:
 * - dump sites directory
 * - 50 provider (vendor) profiles
 * - 30 customer profiles
 * - 250 open load requests
 * - 150 fleet trucks
 *
 * Usage (Render shell or local with Neon DATABASE_URL):
 *   DATABASE_URL="postgresql://..." pnpm --filter @workspace/api-server run seed-marketplace
 */
import "../src/load-env.js";
import { sql, eq } from "drizzle-orm";
import {
  db,
  dumpSitesTable,
  profilesTable,
  requestsTable,
  trucksTable,
} from "@workspace/db";
import { buildDemoLoads, buildDemoTrucks } from "../src/lib/demoMarketplace";

const MATERIALS = ["dirt", "gravel", "concrete", "asphalt", "demolition", "sand", "topsoil", "fill"] as const;
const TRUCK_TYPES = ["dump_truck", "end_dump", "belly_dump", "super_10", "transfer"] as const;

async function seedDumpSitesIfEmpty() {
  const existing = await db.select({ count: sql<number>`count(*)` }).from(dumpSitesTable);
  if (Number(existing[0]?.count ?? 0) > 0) {
    console.log("Dump sites already seeded — skipping.");
    return;
  }
  console.log("Dump sites empty — run: pnpm --filter @workspace/api-server exec tsx src/seed/dump-sites.ts");
}

async function seedProfiles() {
  const marker = "demo-seed-marketplace";
  const existing = await db
    .select({ count: sql<number>`count(*)` })
    .from(profilesTable)
    .where(sql`${profilesTable.clerkId} like ${marker + '%'}`);
  if (Number(existing[0]?.count ?? 0) >= 80) {
    console.log("Marketplace seed profiles already exist — skipping profile creation.");
    const providers = await db.select().from(profilesTable).where(sql`${profilesTable.clerkId} like ${'demo-seed-provider-%'}`);
    const customers = await db.select().from(profilesTable).where(sql`${profilesTable.clerkId} like ${'demo-seed-customer-%'}`);
    return { providers, customers };
  }

  const providers = [];
  for (let i = 1; i <= 50; i++) {
    const [row] = await db.insert(profilesTable).values({
      clerkId: `demo-seed-provider-${i}`,
      role: "provider",
      companyName: `Demo Carrier ${i}`,
      contactName: `Owner ${i}`,
      city: "Dallas",
      state: "TX",
      email: `demo-carrier-${i}@haulbrokr-seed.local`,
    }).onConflictDoNothing().returning();
    if (row) providers.push(row);
  }

  const customers = [];
  for (let i = 1; i <= 30; i++) {
    const [row] = await db.insert(profilesTable).values({
      clerkId: `demo-seed-customer-${i}`,
      role: "customer",
      companyName: `Demo Contractor ${i}`,
      contactName: `PM ${i}`,
      city: "Dallas",
      state: "TX",
      email: `demo-customer-${i}@haulbrokr-seed.local`,
    }).onConflictDoNothing().returning();
    if (row) customers.push(row);
  }

  const allProviders = providers.length
    ? providers
    : await db.select().from(profilesTable).where(sql`${profilesTable.clerkId} like ${'demo-seed-provider-%'}`);
  const allCustomers = customers.length
    ? customers
    : await db.select().from(profilesTable).where(sql`${profilesTable.clerkId} like ${'demo-seed-customer-%'}`);

  console.log(`Profiles ready: ${allProviders.length} providers, ${allCustomers.length} customers.`);
  return { providers: allProviders, customers: allCustomers };
}

async function seedRequests(customers: { id: number }[]) {
  const existing = await db.select({ count: sql<number>`count(*)` }).from(requestsTable);
  if (Number(existing[0]?.count ?? 0) >= 250) {
    console.log("Requests already seeded — skipping.");
    return;
  }

  const demoLoads = buildDemoLoads(250);
  const batchSize = 50;
  for (let i = 0; i < demoLoads.length; i += batchSize) {
    const batch = demoLoads.slice(i, i + batchSize);
    await db.insert(requestsTable).values(
      batch.map((load, idx) => {
        const customer = customers[(i + idx) % customers.length];
        return {
          customerId: customer.id,
          materialType: load.material as typeof MATERIALS[number],
          truckType: TRUCK_TYPES[(i + idx) % TRUCK_TYPES.length],
          quantityTons: String(80 + ((i + idx) % 120)),
          pickupAddress: load.pickupAddress,
          deliveryAddress: load.deliveryAddress,
          scheduledDate: new Date(load.scheduledDate),
          startTime: "07:00",
          estimatedHours: "8",
          status: load.status === "in_progress" || load.status === "accepted" ? "open" : load.status as "open" | "bidding" | "bid_received",
          trucksNeeded: load.trucksNeeded,
          budgetPerHour: String(load.budgetPerHour),
        };
      }),
    );
    console.log(`  Inserted requests batch ${Math.floor(i / batchSize) + 1}`);
  }
  console.log("Done seeding 250 load requests.");
}

async function seedTrucks(providers: { id: number }[]) {
  const existing = await db.select({ count: sql<number>`count(*)` }).from(trucksTable);
  if (Number(existing[0]?.count ?? 0) >= 150) {
    console.log("Trucks already seeded — skipping.");
    return;
  }

  const demoTrucks = buildDemoTrucks(150);
  await db.insert(trucksTable).values(
    demoTrucks.map((t, i) => ({
      ownerId: providers[i % providers.length].id,
      truckNumber: t.label,
      truckType: t.truckType as typeof TRUCK_TYPES[number],
      capacityTons: String(18 + (i % 12)),
      ratePerHour: String(95 + (i % 40)),
      isAvailable: t.status === "available",
      make: "Kenworth",
      model: "T880",
      year: 2019 + (i % 5),
    })),
  );
  console.log("Done seeding 150 trucks.");
}

async function main() {
  if (!process.env.DATABASE_URL?.trim()) {
    throw new Error("DATABASE_URL is required.");
  }
  console.log("Seeding HaulBrokr marketplace demo data...");
  await seedDumpSitesIfEmpty();
  const { providers, customers } = await seedProfiles();
  if (!providers.length || !customers.length) {
    throw new Error("Could not create or find seed profiles.");
  }
  await seedRequests(customers);
  await seedTrucks(providers);
  console.log("Marketplace seed complete.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
