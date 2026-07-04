/**
 * Seed realistic open load requests (and optional active jobs) for staging/production.
 *
 * Usage:
 *   DATABASE_URL="postgresql://..." pnpm --filter @workspace/api-server run seed-demo-loads
 *
 * In production, set SEED_DEMO_LOADS_FORCE=1 to confirm intentional seeding.
 * Idempotent: skips when >= MIN_OPEN_REQUESTS open loads already exist.
 */
import "../src/load-env.js";
import { sql, eq, or, and, inArray } from "drizzle-orm";
import {
  db,
  profilesTable,
  requestsTable,
  bidsTable,
  jobsTable,
} from "@workspace/db";
import { buildDemoLoads } from "../src/lib/demoMarketplace";

const MIN_OPEN_REQUESTS = 10;
const OPEN_STATUSES = ["open", "bid_received", "bidding"] as const;
const MATERIALS = ["dirt", "gravel", "concrete", "asphalt", "demolition", "sand", "topsoil", "fill", "other"] as const;
const TRUCK_TYPES = ["dump_truck", "end_dump", "belly_dump", "super_10", "transfer"] as const;
type MaterialType = (typeof MATERIALS)[number];
type TruckType = (typeof TRUCK_TYPES)[number];

async function countOpenRequests(): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(requestsTable)
    .where(or(
      eq(requestsTable.status, "open"),
      eq(requestsTable.status, "bid_received"),
      eq(requestsTable.status, "bidding"),
    ));
  return Number(row?.count ?? 0);
}

async function ensureSeedCustomer(): Promise<{ id: number; companyName: string }> {
  const marker = "demo-load-customer";
  const [existing] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.clerkId, marker));
  if (existing) return { id: existing.id, companyName: existing.companyName };

  const [created] = await db
    .insert(profilesTable)
    .values({
      clerkId: marker,
      role: "customer",
      companyName: "RC2 Demo Construction LLC",
      contactName: "Demo PM",
      email: "demo-loads@haulbrokr-seed.local",
      city: "Dallas",
      state: "TX",
    })
    .returning();
  console.log(`Created seed customer profile id=${created.id}`);
  return { id: created.id, companyName: created.companyName };
}

async function ensureSeedProvider(): Promise<{ id: number; companyName: string }> {
  const marker = "demo-load-provider";
  const [existing] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.clerkId, marker));
  if (existing) return { id: existing.id, companyName: existing.companyName };

  const [created] = await db
    .insert(profilesTable)
    .values({
      clerkId: marker,
      role: "provider",
      companyName: "RC2 Demo Hauling LLC",
      contactName: "Demo Dispatcher",
      email: "demo-hauler@haulbrokr-seed.local",
      city: "Dallas",
      state: "TX",
    })
    .returning();
  console.log(`Created seed provider profile id=${created.id}`);
  return { id: created.id, companyName: created.companyName };
}

/** Prefer real RC2 / onboarded profiles when present. */
async function resolveCustomer(): Promise<{ id: number; companyName: string }> {
  const customers = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.role, "customer"))
    .limit(1);
  if (customers[0]) return { id: customers[0].id, companyName: customers[0].companyName };
  return ensureSeedCustomer();
}

async function resolveProvider(): Promise<{ id: number; companyName: string }> {
  const [rc2] = await db
    .select()
    .from(profilesTable)
    .where(sql`${profilesTable.role} = 'provider'`)
    .limit(1);
  if (rc2) return { id: rc2.id, companyName: rc2.companyName };
  return ensureSeedProvider();
}

async function seedOpenRequests(customerId: number, count: number): Promise<number> {
  const demoLoads = buildDemoLoads(count).filter((l) =>
    ["open", "bidding", "bid_received"].includes(l.status),
  );

  let inserted = 0;
  for (let i = 0; i < demoLoads.length; i++) {
    const load = demoLoads[i];
    const status = load.status as typeof OPEN_STATUSES[number];
    const scheduled = new Date(load.scheduledDate);
    const materialType = (MATERIALS.includes(load.material as MaterialType) ? load.material : "dirt") as MaterialType;
    await db.insert(requestsTable).values({
      customerId,
      materialType,
      truckType: TRUCK_TYPES[i % TRUCK_TYPES.length] as TruckType,
      quantityTons: String(60 + (i % 80)),
      pickupAddress: load.pickupAddress,
      deliveryAddress: load.deliveryAddress,
      scheduledDate: scheduled,
      startTime: i % 2 === 0 ? "07:00" : "08:30",
      estimatedHours: String(6 + (i % 4)),
      status,
      trucksNeeded: load.trucksNeeded,
      budgetPerHour: String(load.budgetPerHour),
      notes: "Demo load — seeded for staging QA. Safe to award or bid in test mode.",
    });
    inserted++;
  }
  return inserted;
}

async function seedActiveJobs(customerId: number, providerId: number): Promise<number> {
  const [existing] = await db
    .select({ count: sql<number>`count(*)` })
    .from(jobsTable)
    .where(or(
      eq(jobsTable.status, "accepted"),
      eq(jobsTable.status, "in_progress"),
      eq(jobsTable.status, "awarded"),
      eq(jobsTable.status, "active"),
    ));
  if (Number(existing?.count ?? 0) >= 2) {
    console.log("Active jobs already exist — skipping job seed.");
    return 0;
  }

  const demoLoads = buildDemoLoads(3).filter((l) => ["accepted", "in_progress"].includes(l.status));
  let created = 0;

  for (let i = 0; i < demoLoads.length; i++) {
    const load = demoLoads[i];
    const jobStatus = load.status === "in_progress" ? "in_progress" as const : "accepted" as const;
    const scheduled = new Date(load.scheduledDate);

    const [request] = await db
      .insert(requestsTable)
      .values({
        customerId,
        materialType: "gravel",
        truckType: TRUCK_TYPES[i % TRUCK_TYPES.length],
        quantityTons: "90",
        pickupAddress: load.pickupAddress,
        deliveryAddress: load.deliveryAddress,
        scheduledDate: scheduled,
        startTime: "07:00",
        estimatedHours: "8",
        status: "accepted",
        trucksNeeded: 2,
        budgetPerHour: String(load.budgetPerHour),
        notes: "Demo active job — seeded for driver QA.",
      })
      .returning();

    const [bid] = await db
      .insert(bidsTable)
      .values({
        requestId: request.id,
        providerId,
        ratePerHour: String(load.budgetPerHour - 5),
        trucksOffered: 2,
        estimatedHours: "8",
        status: "accepted",
        message: "Demo bid — auto-accepted for staging.",
      })
      .returning();

    await db.insert(jobsTable).values({
      requestId: request.id,
      bidId: bid.id,
      customerId,
      providerId,
      ratePerHour: bid.ratePerHour,
      trucksAssigned: 2,
      status: jobStatus,
      materialType: "gravel",
      truckType: TRUCK_TYPES[i % TRUCK_TYPES.length],
      pickupAddress: load.pickupAddress,
      deliveryAddress: load.deliveryAddress,
      scheduledDate: scheduled,
      startTime: "07:00",
      estimatedHours: "8",
      notes: "Demo job for driver active-loads QA.",
    });
    created++;
  }
  return created;
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL?.trim()) {
    throw new Error("DATABASE_URL is required.");
  }
  if (process.env.NODE_ENV === "production" && process.env.SEED_DEMO_LOADS_FORCE !== "1") {
    console.error(
      "Refusing to seed demo loads in production without SEED_DEMO_LOADS_FORCE=1.\n" +
        "This inserts real rows into requests/jobs tables for staging QA.",
    );
    process.exit(1);
  }

  const openCount = await countOpenRequests();
  console.log(`Open load requests in database: ${openCount}`);

  const customer = await resolveCustomer();
  const provider = await resolveProvider();
  console.log(`Using customer id=${customer.id} (${customer.companyName})`);
  console.log(`Using provider id=${provider.id} (${provider.companyName})`);

  let requestsAdded = 0;
  if (openCount < MIN_OPEN_REQUESTS) {
    const toAdd = MIN_OPEN_REQUESTS - openCount;
    requestsAdded = await seedOpenRequests(customer.id, toAdd);
    console.log(`Inserted ${requestsAdded} open load requests.`);
  } else {
    console.log(`Already have ${openCount} open requests (>= ${MIN_OPEN_REQUESTS}) — skipping request seed.`);
  }

  const jobsAdded = await seedActiveJobs(customer.id, provider.id);
  if (jobsAdded > 0) {
    console.log(`Inserted ${jobsAdded} active demo jobs.`);
  }

  const finalOpen = await countOpenRequests();
  const [activeJobs] = await db
    .select({ count: sql<number>`count(*)` })
    .from(jobsTable)
    .where(inArray(jobsTable.status, ["active", "awarded", "accepted", "in_progress"]));

  console.log("\nSeed complete.");
  console.log(`  Open loads on Load Board: ${finalOpen}`);
  console.log(`  Active jobs for drivers:  ${Number(activeJobs?.count ?? 0)}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
