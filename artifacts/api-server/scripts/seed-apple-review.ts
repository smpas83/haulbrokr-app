/**
 * Seed permanent Apple App Review demo account + marketplace data.
 *
 * Usage:
 *   CLERK_SECRET_KEY=sk_live_... DATABASE_URL=postgresql://... \
 *     pnpm --filter @workspace/api-server run seed-apple-review
 */
import "../src/load-env.js";
import { createClerkClient } from "@clerk/backend";
import { eq, sql } from "drizzle-orm";
import { db, profilesTable, requestsTable, trucksTable } from "@workspace/db";

const REVIEW_EMAIL = "apple-review@haulbrokr.com";
const REVIEW_PASSWORD = "Apple1demo123!";
const REVIEW_USERNAME = "apple-review";
const REVIEW_CLERK_MARKER = "apple-review-demo";

async function ensureClerkUser() {
  const secretKey = process.env.CLERK_SECRET_KEY?.trim();
  if (!secretKey) {
    throw new Error(
      "CLERK_SECRET_KEY is required to seed the Apple review Clerk user.",
    );
  }

  const clerk = createClerkClient({ secretKey });
  const existing = await clerk.users.getUserList({
    emailAddress: [REVIEW_EMAIL],
    limit: 1,
  });
  const found = existing.data[0];

  if (found) {
    await clerk.users.updateUser(found.id, {
      password: REVIEW_PASSWORD,
      username: REVIEW_USERNAME,
    });
    console.log(`Updated existing Clerk review user: ${found.id}`);
    return found.id;
  }

  const created = await clerk.users.createUser({
    emailAddress: [REVIEW_EMAIL],
    username: REVIEW_USERNAME,
    password: REVIEW_PASSWORD,
    skipPasswordChecks: true,
    skipPasswordRequirement: false,
  });
  console.log(`Created Clerk review user: ${created.id}`);
  return created.id;
}

async function ensureReviewProfile(clerkId: string) {
  const existing = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.clerkId, clerkId))
    .limit(1);

  if (existing[0]) {
    console.log(`Review profile already exists (#${existing[0].id}).`);
    return existing[0];
  }

  const legacy = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.clerkId, REVIEW_CLERK_MARKER))
    .limit(1);

  if (legacy[0]) {
    const [updated] = await db
      .update(profilesTable)
      .set({ clerkId, email: REVIEW_EMAIL, updatedAt: new Date() })
      .where(eq(profilesTable.id, legacy[0].id))
      .returning();
    console.log(`Linked legacy review profile #${updated.id} to Clerk user.`);
    return updated;
  }

  const [profile] = await db
    .insert(profilesTable)
    .values({
      clerkId,
      role: "provider",
      companyName: "Apple Review Demo Carrier",
      contactName: "App Review",
      email: REVIEW_EMAIL,
      city: "Dallas",
      state: "TX",
      phone: "+1-214-555-0100",
    })
    .returning();

  console.log(`Created review profile #${profile.id}.`);
  return profile;
}

async function seedReviewMarketplaceData(profileId: number) {
  const truckCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(trucksTable)
    .where(eq(trucksTable.ownerId, profileId));
  if (Number(truckCount[0]?.count ?? 0) < 2) {
    await db.insert(trucksTable).values([
      {
        ownerId: profileId,
        truckNumber: "Review Unit 01",
        truckType: "end_dump",
        licensePlate: "APPL-001",
        capacityTons: "25.00",
        ratePerHour: "125.00",
        isAvailable: true,
      },
      {
        ownerId: profileId,
        truckNumber: "Review Unit 02",
        truckType: "super_10",
        licensePlate: "APPL-002",
        capacityTons: "18.00",
        ratePerHour: "140.00",
        isAvailable: false,
      },
    ]);
    console.log("Seeded review fleet trucks.");
  }

  const requestCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(requestsTable)
    .where(eq(requestsTable.customerId, profileId));
  if (Number(requestCount[0]?.count ?? 0) === 0) {
    await db.insert(requestsTable).values({
      customerId: profileId,
      materialType: "gravel",
      truckType: "end_dump",
      status: "open",
      quantityTons: "500.00",
      pickupAddress: "1200 Commerce St, Dallas, TX",
      deliveryAddress: "4500 Industrial Blvd, Fort Worth, TX",
      scheduledDate: new Date(),
      startTime: "08:00",
      estimatedHours: "8.00",
      budgetPerHour: "125.00",
      trucksNeeded: 2,
      notes: "Apple review demo load — safe to explore all tabs.",
    });
    console.log("Seeded open review request.");
  }
}

async function main() {
  if (!process.env.DATABASE_URL?.trim()) {
    throw new Error("DATABASE_URL is required.");
  }

  console.log("Seeding Apple App Review account...");
  const clerkId = await ensureClerkUser();
  const profile = await ensureReviewProfile(clerkId);
  await seedReviewMarketplaceData(profile.id);

  console.log("\nApple review credentials:");
  console.log(`  Email:    ${REVIEW_EMAIL}`);
  console.log(`  Password: ${REVIEW_PASSWORD}`);
  console.log(`  Username: ${REVIEW_USERNAME}`);
  console.log(`  Profile:  #${profile.id} (${profile.role})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
