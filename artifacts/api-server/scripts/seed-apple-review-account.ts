/**
 * Permanent Apple App Store review account + rich demo marketplace data.
 *
 * Credentials (never rotated by this script):
 *   Email:    apple-review@haulbrokr.com
 *   Password: Apple1demo
 *   Username: Apple1demo
 *
 * Usage:
 *   CLERK_SECRET_KEY=sk_live_... DATABASE_URL=postgresql://... \
 *     pnpm --filter @workspace/api-server run seed-apple-review
 */
import "../src/load-env.js";
import { eq } from "drizzle-orm";
import {
  activityTable,
  bidsTable,
  db,
  jobsTable,
  organizationsTable,
  profilesTable,
  requestsTable,
  trucksTable,
} from "@workspace/db";

const REVIEW_EMAIL = "apple-review@haulbrokr.com";
const REVIEW_PASSWORD = "Apple1demo";
const REVIEW_USERNAME = "Apple1demo";
const REVIEW_CLERK_MARKER = "apple-review-permanent";
const REVIEW_COMPANY = "Apple Review Hauling Co";

type ClerkUser = {
  id: string;
  email_addresses?: Array<{ id: string; email_address: string }>;
};

async function clerkFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const secret = process.env.CLERK_SECRET_KEY?.trim();
  if (!secret) throw new Error("CLERK_SECRET_KEY is required.");
  const res = await fetch(`https://api.clerk.com/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new Error(`Clerk API ${path} failed (${res.status}): ${text}`);
  }
  return body as T;
}

async function findClerkUserByEmail(email: string): Promise<ClerkUser | null> {
  const data = await clerkFetch<{ data: ClerkUser[] }>(
    `/users?email_address=${encodeURIComponent(email)}&limit=1`,
  );
  return data.data?.[0] ?? null;
}

async function ensureClerkReviewUser(): Promise<string> {
  let user = await findClerkUserByEmail(REVIEW_EMAIL);

  if (!user) {
    user = await clerkFetch<ClerkUser>("/users", {
      method: "POST",
      body: JSON.stringify({
        email_address: [REVIEW_EMAIL],
        username: REVIEW_USERNAME,
        password: REVIEW_PASSWORD,
        first_name: "Apple",
        last_name: "Review",
        skip_password_checks: true,
        skip_password_requirement: true,
        public_metadata: {
          appleReviewAccount: true,
          permanent: true,
        },
      }),
    });
    console.log(`Created Clerk user ${user.id}`);
  } else {
    await clerkFetch(`/users/${user.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        username: REVIEW_USERNAME,
        password: REVIEW_PASSWORD,
        first_name: "Apple",
        last_name: "Review",
        skip_password_checks: true,
        skip_password_requirement: true,
        public_metadata: {
          appleReviewAccount: true,
          permanent: true,
        },
      }),
    });
    console.log(`Updated Clerk user ${user.id}`);
  }

  const emailId = user.email_addresses?.find(
    (item) => item.email_address === REVIEW_EMAIL,
  )?.id;
  if (emailId) {
    await clerkFetch(`/email_addresses/${emailId}`, {
      method: "PATCH",
      body: JSON.stringify({ verified: true }),
    });
    console.log("Marked review email as verified.");
  }

  return user.id;
}

function daysFromNow(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

async function ensureReviewProfile(clerkId: string) {
  const [existing] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.clerkId, clerkId));
  if (existing) {
    console.log(`Review profile already exists (id=${existing.id}).`);
    return existing;
  }

  const [profile] = await db
    .insert(profilesTable)
    .values({
      clerkId,
      role: "provider",
      companyName: REVIEW_COMPANY,
      contactName: "Apple Reviewer",
      email: REVIEW_EMAIL,
      phone: "+1-555-0100",
      city: "Dallas",
      state: "TX",
      mcNumber: "MC-REVIEW-001",
      hourlyRate: "125",
      minimumHours: "4",
      equipmentTypes: "dump_truck,end_dump,super_10",
    })
    .returning();

  const [org] = await db
    .insert(organizationsTable)
    .values({
      name: REVIEW_COMPANY,
      type: "provider",
      ownerProfileId: profile.id,
      inviteCode: "APPLER",
    })
    .returning();

  await db
    .update(profilesTable)
    .set({ organizationId: org.id, orgRole: "owner" })
    .where(eq(profilesTable.id, profile.id));

  console.log(
    `Created review profile id=${profile.id} with organization id=${org.id}`,
  );
  return { ...profile, organizationId: org.id };
}

async function seedDemoCustomers() {
  const customers = [];
  for (let i = 1; i <= 3; i++) {
    const clerkId = `${REVIEW_CLERK_MARKER}-customer-${i}`;
    const [existing] = await db
      .select()
      .from(profilesTable)
      .where(eq(profilesTable.clerkId, clerkId));
    if (existing) {
      customers.push(existing);
      continue;
    }
    const [row] = await db
      .insert(profilesTable)
      .values({
        clerkId,
        role: "customer",
        companyName: `Review Customer ${i}`,
        contactName: `PM ${i}`,
        email: `review-customer-${i}@haulbrokr-seed.local`,
        city: "Dallas",
        state: "TX",
      })
      .returning();
    customers.push(row);
  }
  return customers;
}

async function seedFleet(providerId: number) {
  const [countRow] = await db
    .select()
    .from(trucksTable)
    .where(eq(trucksTable.ownerId, providerId));
  if (countRow) {
    console.log("Fleet already seeded for review provider.");
    return;
  }

  await db.insert(trucksTable).values([
    {
      ownerId: providerId,
      truckNumber: "AR-101",
      truckType: "dump_truck",
      capacityTons: "18",
      ratePerHour: "110",
      isAvailable: true,
      make: "Kenworth",
      model: "T880",
      year: 2021,
    },
    {
      ownerId: providerId,
      truckNumber: "AR-102",
      truckType: "end_dump",
      capacityTons: "22",
      ratePerHour: "125",
      isAvailable: true,
      make: "Peterbilt",
      model: "567",
      year: 2020,
    },
    {
      ownerId: providerId,
      truckNumber: "AR-103",
      truckType: "super_10",
      capacityTons: "16",
      ratePerHour: "105",
      isAvailable: false,
      make: "Freightliner",
      model: "122SD",
      year: 2019,
    },
    {
      ownerId: providerId,
      truckNumber: "AR-104",
      truckType: "belly_dump",
      capacityTons: "24",
      ratePerHour: "130",
      isAvailable: true,
      make: "Mack",
      model: "Granite",
      year: 2022,
    },
  ]);
  console.log("Seeded 4 fleet trucks.");
}

async function seedJobsAndDispatches(
  providerId: number,
  customers: { id: number }[],
) {
  const [existingJob] = await db
    .select()
    .from(jobsTable)
    .where(eq(jobsTable.providerId, providerId))
    .limit(1);
  if (existingJob) {
    console.log("Jobs already seeded for review provider.");
    return;
  }

  const jobSpecs = [
    {
      status: "in_progress" as const,
      material: "gravel",
      days: 0,
      hours: "8",
      rate: "120",
    },
    { status: "active" as const, material: "dirt", days: 2, rate: "115" },
    { status: "completed" as const, material: "sand", days: -3, rate: "118" },
    {
      status: "completed" as const,
      material: "topsoil",
      days: -7,
      rate: "122",
    },
    { status: "accepted" as const, material: "fill", days: 4, rate: "125" },
  ];

  for (let i = 0; i < jobSpecs.length; i++) {
    const spec = jobSpecs[i];
    const customer = customers[i % customers.length];

    const [request] = await db
      .insert(requestsTable)
      .values({
        customerId: customer.id,
        materialType: spec.material as
          | "gravel"
          | "dirt"
          | "sand"
          | "topsoil"
          | "fill",
        truckType: "dump_truck",
        quantityTons: "120",
        pickupAddress: "1200 Industrial Blvd, Dallas, TX",
        deliveryAddress: "4500 Commerce St, Fort Worth, TX",
        scheduledDate: daysFromNow(spec.days),
        startTime: "07:00",
        estimatedHours: spec.hours ?? "8",
        status: spec.status === "completed" ? "completed" : "awarded",
        trucksNeeded: 2,
        budgetPerHour: spec.rate,
      })
      .returning();

    const [bid] = await db
      .insert(bidsTable)
      .values({
        requestId: request.id,
        providerId,
        ratePerHour: spec.rate,
        trucksOffered: 2,
        estimatedHours: spec.hours ?? "8",
        status: "accepted",
        message: "Apple review demo bid",
      })
      .returning();

    await db.insert(jobsTable).values({
      requestId: request.id,
      bidId: bid.id,
      customerId: customer.id,
      providerId,
      ratePerHour: spec.rate,
      trucksAssigned: 2,
      status: spec.status,
      materialType: spec.material,
      truckType: "dump_truck",
      pickupAddress: request.pickupAddress,
      deliveryAddress: request.deliveryAddress,
      scheduledDate: request.scheduledDate,
      startTime: request.startTime,
      estimatedHours: spec.hours ?? "8",
      totalHours: spec.status === "completed" ? "8" : undefined,
      totalAmount: spec.status === "completed" ? "960" : undefined,
      paymentStatus: spec.status === "completed" ? "paid" : "unpaid",
    });
  }

  console.log(`Seeded ${jobSpecs.length} jobs with requests/bids.`);
}

async function seedNotifications(providerId: number) {
  const [existing] = await db
    .select()
    .from(activityTable)
    .where(eq(activityTable.profileId, providerId))
    .limit(1);
  if (existing) {
    console.log("Notifications already seeded for review provider.");
    return;
  }

  const items = [
    {
      type: "bid_awarded" as const,
      description: "Your bid was awarded on Gravel Run #AR-2401",
    },
    {
      type: "job_accepted" as const,
      description: "Job accepted — 2 trucks scheduled for tomorrow",
    },
    {
      type: "job_started" as const,
      description: "Driver AR-101 checked in at pickup site",
    },
    {
      type: "job_completed" as const,
      description: "Sand haul completed — ticket uploaded",
    },
    {
      type: "request_posted" as const,
      description: "New open load near Dallas (12 mi)",
    },
    {
      type: "bid_placed" as const,
      description: "Competitor bid received on Fill Dirt #AR-2398",
    },
    {
      type: "payout_delayed" as const,
      description: "Payout processing — funds expected in 2 business days",
    },
    {
      type: "delivery_evidence_submitted" as const,
      description: "Delivery photo submitted for review",
    },
    {
      type: "job_started" as const,
      description: "Dispatch: Truck AR-103 en route to job site",
    },
    {
      type: "bid_accepted" as const,
      description: "Customer accepted your rate on Topsoil haul",
    },
  ];

  await db.insert(activityTable).values(
    items.map((item) => ({
      profileId: providerId,
      type: item.type,
      description: item.description,
    })),
  );
  console.log(`Seeded ${items.length} in-app notifications.`);
}

async function main() {
  if (!process.env.DATABASE_URL?.trim()) {
    throw new Error("DATABASE_URL is required.");
  }

  const clerkId = await ensureClerkReviewUser();
  const profile = await ensureReviewProfile(clerkId);
  const customers = await seedDemoCustomers();
  await seedFleet(profile.id);
  await seedJobsAndDispatches(profile.id, customers);
  await seedNotifications(profile.id);

  console.log("\nApple Review account ready:");
  console.log(`  Email:    ${REVIEW_EMAIL}`);
  console.log(`  Password: ${REVIEW_PASSWORD}`);
  console.log(`  Username: ${REVIEW_USERNAME}`);
  console.log(`  Clerk ID: ${clerkId}`);
  console.log(`  Profile:  ${profile.id} (${REVIEW_COMPANY})`);
  console.log("\nAdd these credentials to App Store Connect review notes.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
