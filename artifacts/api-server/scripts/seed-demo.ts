/**
 * Seed realistic nationwide demo data for HaulBrokr: customers, providers,
 * drivers, trucks, open loads (requests), bids, awarded/active jobs, job routes
 * with coordinates, and live truck GPS locations across ~10 US metros.
 *
 * This gives providers a populated load board, gives the admin dispatcher map
 * live jobs + trucks, and gives tracking endpoints real routes + GPS.
 *
 * Idempotent: all demo rows are namespaced (clerk ids `demo_*`, org invite
 * codes `DEMO*`) and removed before re-seeding, so it is safe to run repeatedly
 * against the same database (local dev or a hosted Neon instance).
 *
 * Usage (DATABASE_URL must be set, e.g. via repo-root .env):
 *   pnpm --filter @workspace/api-server run seed-demo
 */
import "../src/load-env.js";
import { and, eq, inArray, like, or } from "drizzle-orm";
import {
  db,
  pool,
  profilesTable,
  organizationsTable,
  trucksTable,
  requestsTable,
  bidsTable,
  jobsTable,
  jobRoutesTable,
  truckLocationsTable,
  tripLocationHistoryTable,
} from "@workspace/db";

type Metro = {
  city: string;
  state: string;
  lat: number;
  lng: number;
  material: "dirt" | "gravel" | "sand" | "concrete" | "asphalt" | "fill" | "topsoil";
};

const METROS: Metro[] = [
  { city: "Los Angeles", state: "CA", lat: 34.0522, lng: -118.2437, material: "concrete" },
  { city: "Houston", state: "TX", lat: 29.7604, lng: -95.3698, material: "dirt" },
  { city: "Phoenix", state: "AZ", lat: 33.4484, lng: -112.074, material: "gravel" },
  { city: "Dallas", state: "TX", lat: 32.7767, lng: -96.797, material: "sand" },
  { city: "Chicago", state: "IL", lat: 41.8781, lng: -87.6298, material: "asphalt" },
  { city: "Denver", state: "CO", lat: 39.7392, lng: -104.9903, material: "fill" },
  { city: "Atlanta", state: "GA", lat: 33.749, lng: -84.388, material: "topsoil" },
  { city: "Miami", state: "FL", lat: 25.7617, lng: -80.1918, material: "sand" },
  { city: "Seattle", state: "WA", lat: 47.6062, lng: -122.3321, material: "gravel" },
  { city: "New York", state: "NY", lat: 40.7128, lng: -74.006, material: "concrete" },
];

const TRUCK_TYPES = [
  "dump_truck", "end_dump", "side_dump", "super_10", "transfer", "belly_dump",
] as const;

// Small deterministic jitter so pins/addresses spread around each metro center.
function jitter(base: number, seed: number, spread = 0.15): number {
  const r = Math.sin(seed * 12.9898) * 43758.5453;
  const frac = r - Math.floor(r);
  return Number((base + (frac - 0.5) * spread).toFixed(6));
}

function money(n: number): string {
  return n.toFixed(2);
}

async function clearDemoData(): Promise<void> {
  const demoProfiles = await db
    .select({ id: profilesTable.id })
    .from(profilesTable)
    .where(like(profilesTable.clerkId, "demo\\_%"));
  const ids = demoProfiles.map((p) => p.id);
  if (ids.length > 0) {
    // Delete in FK-dependency order (jobs reference profiles without cascade).
    await db.delete(tripLocationHistoryTable).where(inArray(tripLocationHistoryTable.driverProfileId, ids));
    await db.delete(truckLocationsTable).where(inArray(truckLocationsTable.driverProfileId, ids));
    const demoJobs = await db
      .select({ id: jobsTable.id })
      .from(jobsTable)
      .where(or(inArray(jobsTable.customerId, ids), inArray(jobsTable.providerId, ids)));
    const jobIds = demoJobs.map((j) => j.id);
    if (jobIds.length > 0) {
      await db.delete(jobRoutesTable).where(inArray(jobRoutesTable.jobId, jobIds));
      await db.delete(jobsTable).where(inArray(jobsTable.id, jobIds));
    }
    await db.delete(bidsTable).where(inArray(bidsTable.providerId, ids));
    await db.delete(requestsTable).where(inArray(requestsTable.customerId, ids));
    await db.delete(trucksTable).where(inArray(trucksTable.ownerId, ids));
    await db.delete(profilesTable).where(inArray(profilesTable.id, ids));
  }
  await db.delete(organizationsTable).where(like(organizationsTable.inviteCode, "DEMO%"));
}

async function seed(): Promise<void> {
  console.log("Clearing prior demo data…");
  await clearDemoData();

  let loads = 0;
  let jobs = 0;
  let trucks = 0;
  let gpsPoints = 0;

  console.log(`Seeding ${METROS.length} metros…`);
  for (let i = 0; i < METROS.length; i++) {
    const m = METROS[i];
    const now = new Date();

    // --- Customer org + owner ---
    const [custOrg] = await db
      .insert(organizationsTable)
      .values({ name: `[DEMO] ${m.city} Builders`, type: "customer", inviteCode: `DEMOC${i}` })
      .returning();
    const [customer] = await db
      .insert(profilesTable)
      .values({
        clerkId: `demo_cust_${i}`,
        role: "customer",
        companyName: `${m.city} Builders`,
        contactName: "Casey Customer",
        email: `customer${i}@demo.haulbrokr.com`,
        city: m.city,
        state: m.state,
        organizationId: custOrg.id,
        orgRole: "owner",
      })
      .returning();
    await db.update(organizationsTable).set({ ownerProfileId: customer.id }).where(eq(organizationsTable.id, custOrg.id));

    // --- Provider org + owner + drivers + trucks ---
    const [provOrg] = await db
      .insert(organizationsTable)
      .values({ name: `[DEMO] ${m.city} Hauling`, type: "provider", inviteCode: `DEMOP${i}` })
      .returning();
    const [provider] = await db
      .insert(profilesTable)
      .values({
        clerkId: `demo_prov_${i}`,
        role: "provider",
        companyName: `${m.city} Hauling Co`,
        contactName: "Pat Provider",
        email: `provider${i}@demo.haulbrokr.com`,
        city: m.city,
        state: m.state,
        organizationId: provOrg.id,
        orgRole: "owner",
        capacityTons: "18.00",
        hourlyRate: "145.00",
      })
      .returning();
    await db.update(organizationsTable).set({ ownerProfileId: provider.id }).where(eq(organizationsTable.id, provOrg.id));

    const drivers = [];
    for (let d = 0; d < 2; d++) {
      const [driver] = await db
        .insert(profilesTable)
        .values({
          clerkId: `demo_drv_${i}_${d}`,
          role: "driver",
          companyName: `${m.city} Hauling Co`,
          contactName: `Driver ${d + 1}`,
          email: `driver${i}_${d}@demo.haulbrokr.com`,
          city: m.city,
          state: m.state,
          organizationId: provOrg.id,
          orgRole: "member",
        })
        .returning();
      drivers.push(driver);
    }

    const truckRows = [];
    for (let t = 0; t < 2; t++) {
      const [truck] = await db
        .insert(trucksTable)
        .values({
          ownerId: provider.id,
          truckNumber: `${m.state}-${100 + i * 10 + t}`,
          vin: `DEMOVIN${i}${t}${"0".repeat(6)}`.slice(0, 17),
          truckType: TRUCK_TYPES[(i + t) % TRUCK_TYPES.length],
          capacityTons: "18.00",
          ratePerHour: "145.00",
          licensePlate: `${m.state}${1000 + i * 10 + t}`,
          coiStatus: "active",
          assignedDriverId: drivers[t]?.id ?? null,
          isAvailable: true,
        })
        .returning();
      truckRows.push(truck);
      trucks++;
    }

    // --- Open loads (requests) — the provider load board ---
    const statuses: Array<"open" | "bid_received" | "bidding"> = ["open", "open", "bid_received"];
    const requestRows = [];
    for (let r = 0; r < statuses.length; r++) {
      const [request] = await db
        .insert(requestsTable)
        .values({
          customerId: customer.id,
          materialType: m.material,
          truckType: TRUCK_TYPES[(i + r) % TRUCK_TYPES.length],
          quantityTons: money(200 + r * 50),
          pickupAddress: `${1000 + r * 25} Quarry Rd, ${m.city}, ${m.state}`,
          deliveryAddress: `${500 + r * 30} Jobsite Ave, ${m.city}, ${m.state}`,
          scheduledDate: new Date(now.getTime() + (r + 1) * 24 * 60 * 60 * 1000),
          startTime: "08:00",
          estimatedHours: money(8),
          status: statuses[r],
          trucksNeeded: 1 + (r % 2),
          budgetPerHour: money(150 + r * 10),
          notes: `${m.material} haul in the ${m.city} metro`,
        })
        .returning();
      requestRows.push(request);
      loads++;
    }

    // --- One awarded/active job with route + live GPS, per metro ---
    const jobRequest = requestRows[requestRows.length - 1];
    await db.update(requestsTable).set({ status: "accepted" }).where(eq(requestsTable.id, jobRequest.id));
    const [bid] = await db
      .insert(bidsTable)
      .values({
        requestId: jobRequest.id,
        providerId: provider.id,
        ratePerHour: "145.00",
        trucksOffered: 1,
        estimatedHours: "8.00",
        message: "Ready to roll.",
        status: "accepted",
      })
      .returning();

    const pickupLat = jitter(m.lat, i * 7 + 1, 0.08);
    const pickupLng = jitter(m.lng, i * 7 + 2, 0.08);
    const dropoffLat = jitter(m.lat, i * 7 + 3, 0.2);
    const dropoffLng = jitter(m.lng, i * 7 + 4, 0.2);

    const [job] = await db
      .insert(jobsTable)
      .values({
        requestId: jobRequest.id,
        bidId: bid.id,
        customerId: customer.id,
        providerId: provider.id,
        ratePerHour: "145.00",
        trucksAssigned: 1,
        status: "in_progress",
        materialType: m.material,
        truckType: truckRows[0].truckType,
        pickupAddress: jobRequest.pickupAddress,
        deliveryAddress: jobRequest.deliveryAddress,
        scheduledDate: jobRequest.scheduledDate,
        startTime: "08:00",
        estimatedHours: "8.00",
        startedAt: new Date(now.getTime() - 60 * 60 * 1000),
      })
      .returning();
    jobs++;

    await db.insert(jobRoutesTable).values({
      jobId: job.id,
      pickupLat: String(pickupLat),
      pickupLng: String(pickupLng),
      dropoffLat: String(dropoffLat),
      dropoffLng: String(dropoffLng),
      routeDistanceMeters: 18500,
      routeDurationSeconds: 1500,
      trafficDurationSeconds: 1800,
      etaAt: new Date(now.getTime() + 30 * 60 * 1000),
      lastCalculatedAt: now,
      routeStatus: "calculated",
    });

    // Live GPS for the active job's driver + a recent breadcrumb trail.
    const driver = drivers[0];
    const truck = truckRows[0];
    const curLat = jitter((pickupLat + dropoffLat) / 2, i * 7 + 5, 0.04);
    const curLng = jitter((pickupLng + dropoffLng) / 2, i * 7 + 6, 0.04);
    await db.insert(truckLocationsTable).values({
      truckId: truck.id,
      driverProfileId: driver.id,
      jobId: job.id,
      lat: String(curLat),
      lng: String(curLng),
      heading: "90.00",
      speedMps: "13.400",
      accuracyMeters: "5.00",
      recordedAt: now,
      isStale: 0,
      offRouteStatus: "on_route",
    });
    gpsPoints++;
    for (let h = 0; h < 5; h++) {
      const t = h / 5;
      await db.insert(tripLocationHistoryTable).values({
        jobId: job.id,
        truckId: truck.id,
        driverProfileId: driver.id,
        lat: String(Number((pickupLat + (curLat - pickupLat) * t).toFixed(6))),
        lng: String(Number((pickupLng + (curLng - pickupLng) * t).toFixed(6))),
        heading: "90.00",
        speedMps: "12.000",
        recordedAt: new Date(now.getTime() - (5 - h) * 5 * 60 * 1000),
        offRouteStatus: "on_route",
      });
      gpsPoints++;
    }

    // A second, idle truck reporting position near the metro (for fleet/nearby maps).
    const [driver2, truck2] = [drivers[1], truckRows[1]];
    if (driver2 && truck2) {
      await db.insert(truckLocationsTable).values({
        truckId: truck2.id,
        driverProfileId: driver2.id,
        lat: String(jitter(m.lat, i * 7 + 8, 0.1)),
        lng: String(jitter(m.lng, i * 7 + 9, 0.1)),
        heading: "0.00",
        speedMps: "0.000",
        accuracyMeters: "6.00",
        recordedAt: now,
        isStale: 0,
        offRouteStatus: "unknown",
      });
      gpsPoints++;
    }

    console.log(`  ${m.city}, ${m.state}: loads + 1 active job + ${truckRows.length} trucks + GPS`);
  }

  console.log(
    `\nDone. Seeded ${loads} open loads, ${jobs} active jobs, ${trucks} trucks, ${gpsPoints} GPS points across ${METROS.length} metros.`,
  );
}

seed()
  .then(async () => {
    await pool.end();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error(err);
    await pool.end();
    process.exit(1);
  });
