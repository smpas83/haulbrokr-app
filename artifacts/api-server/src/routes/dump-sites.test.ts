import express, { type Express } from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  sites: [] as Record<string, any>[],
  materials: [] as Record<string, any>[],
  pricing: [] as Record<string, any>[],
  analytics: [] as Record<string, any>[],
  preferences: [] as Record<string, any>[],
  jobs: [] as Record<string, any>[],
}));

vi.mock("@workspace/db", () => {
  const makeTable = (name: string) =>
    new Proxy({ __name: name }, { get: (target, prop) => prop === "__name" ? name : `${name}.${String(prop)}` });

  const dumpSitesTable = makeTable("dump_sites");
  const facilityMaterialsTable = makeTable("facility_materials");
  const facilityPricingTable = makeTable("facility_pricing");
  const facilityAnalyticsTable = makeTable("facility_analytics");
  const customerFacilityPreferencesTable = makeTable("customer_facility_preferences");
  const jobsTable = makeTable("jobs");

  function rowsFor(table: any) {
    if (table === dumpSitesTable) return h.sites;
    if (table === facilityMaterialsTable) return h.materials;
    if (table === facilityPricingTable) return h.pricing;
    if (table === facilityAnalyticsTable) return h.analytics;
    if (table === customerFacilityPreferencesTable) return h.preferences;
    if (table === jobsTable) return h.jobs;
    return [];
  }

  function result(rows: Record<string, any>[]) {
    return {
      where: () => result(rows),
      orderBy: () => Promise.resolve(rows),
      then: (resolve: (value: Record<string, any>[]) => unknown) => Promise.resolve(rows).then(resolve),
    };
  }

  const db = {
    select: () => ({
      from: (table: any) => result(rowsFor(table)),
    }),
    selectDistinct: () => ({
      from: () => ({
        where: () => ({
          orderBy: () => Promise.resolve([...new Set(h.sites.map((site) => site.state))].map((state) => ({ state }))),
        }),
      }),
    }),
  };

  return {
    db,
    dumpSitesTable,
    facilityMaterialsTable,
    facilityPricingTable,
    facilityAnalyticsTable,
    customerFacilityPreferencesTable,
    jobsTable,
  };
});

vi.mock("../middlewares/requireAuth", () => ({
  requireProfile: (_req: any, _res: any, next: any) => next(),
  getRequestProfile: () => ({ id: 42, role: "customer", companyName: "Broker Test", staffRole: "cto" }),
}));

vi.mock("../middlewares/requireAdmin", () => ({
  requireAdmin: (_req: any, _res: any, next: any) => next(),
}));

import dumpSitesRouter from "./dump-sites";

function makeApp(): Express {
  const app = express();
  app.use(express.json());
  app.use(dumpSitesRouter);
  return app;
}

beforeEach(() => {
  h.sites = [
    {
      id: 1,
      name: "Metro Gravel Pit",
      address: "100 Quarry Rd",
      city: "Dallas",
      state: "TX",
      zip: "75201",
      type: "gravel_pit",
      latitude: "32.7767000",
      longitude: "-96.7970000",
      phone: "555-0100",
      website: null,
      operatingHours: { monday: "06:00-18:00" },
      holidayHours: {},
      afterHoursContact: "555-0199",
      acceptedMaterials: ["gravel", "sand"],
      rejectedMaterials: ["contaminated_soil"],
      maxTruckSize: "end_dump",
      maxWeightTons: "80.00",
      scaleLocation: "north gate",
      scaleHours: "06:00-17:00",
      entranceInstructions: "Use Gate A",
      exitInstructions: "Exit Gate B",
      safetyRules: ["Stop at scale"],
      ppeRequirements: ["Hard hat"],
      truckRestrictions: ["No pups"],
      preferredRoutes: ["I-30"],
      photos: ["https://example.com/gate.jpg"],
      facilityNotes: "Public note",
      emergencyContact: "911",
      brokerNotes: "Contract margin note",
      driverNotes: "Unload at bay 2",
      status: "open",
      currentStatus: "light_traffic",
      estimatedWaitMinutes: 12,
      temporaryClosureReason: null,
      maintenanceNotes: null,
      capacityLoadsPerDay: 120,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      statusUpdatedAt: new Date(),
    },
    {
      id: 2,
      name: "Closed Transfer Station",
      address: "200 Transfer Rd",
      city: "Dallas",
      state: "TX",
      zip: "75202",
      type: "transfer_station",
      latitude: "33.7767000",
      longitude: "-97.7970000",
      phone: null,
      website: null,
      operatingHours: {},
      holidayHours: {},
      afterHoursContact: null,
      acceptedMaterials: ["mixed_waste"],
      rejectedMaterials: ["gravel"],
      maxTruckSize: null,
      maxWeightTons: null,
      scaleLocation: null,
      scaleHours: null,
      entranceInstructions: null,
      exitInstructions: null,
      safetyRules: [],
      ppeRequirements: [],
      truckRestrictions: [],
      preferredRoutes: [],
      photos: [],
      facilityNotes: null,
      emergencyContact: null,
      brokerNotes: null,
      driverNotes: null,
      status: "closed",
      currentStatus: "closed",
      estimatedWaitMinutes: null,
      temporaryClosureReason: null,
      maintenanceNotes: null,
      capacityLoadsPerDay: null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      statusUpdatedAt: new Date(),
    },
  ];
  h.materials = [
    { id: 1, dumpSiteId: 1, materialType: "gravel", disposition: "accepted", specialInstructions: "Screened only" },
  ];
  h.pricing = [
    { id: 1, dumpSiteId: 1, materialType: "gravel", priceType: "tipping_fee", amount: "24.50", currency: "USD", unit: "ton", notes: "Account", effectiveFrom: new Date(), effectiveTo: null, isActive: true },
  ];
  h.analytics = [
    { dumpSiteId: 1, loadsReceived: 90, averageWaitTimeMinutes: "10.00", averageUnloadTimeMinutes: "8.00", averageTons: "18.50", revenue: "5000.00", tippingFees: "1200.00", driverRatingAverage: "4.80", customerRatingAverage: "4.60", completionRate: "98.00", rejectedLoads: 1, peakHours: ["07:00"], utilization: "78.00" },
  ];
  h.preferences = [
    { customerId: 42, preferredFacilities: [1], preferredMaterials: ["gravel"], preferredRoutes: ["I-30"], backupFacilities: [], notes: null },
  ];
  h.jobs = [{ id: 9, notes: "Call foreman before unloading." }];
});

describe("smart facility dump-site routes", () => {
  it("returns paginated material-filtered facility search results", async () => {
    const res = await request(makeApp()).get("/dump-sites?material=gravel&latitude=32.77&longitude=-96.79&limit=10");

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.items[0]).toMatchObject({
      id: 1,
      name: "Metro Gravel Pit",
      currentStatus: "light_traffic",
      distanceMiles: expect.any(Number),
    });
  });

  it("returns ranked recommendations with broker approval required", async () => {
    const res = await request(makeApp()).get("/dump-sites/recommendations?material=gravel&customerId=42&latitude=32.77&longitude=-96.79");

    expect(res.status).toBe(200);
    expect(res.body.brokerApprovalRequired).toBe(true);
    expect(res.body.recommendations[0].facility.id).toBe(1);
    expect(res.body.recommendations[0].reasons).toContain("customer preferred facility");
  });

  it("redacts broker notes and pricing from the driver view", async () => {
    const res = await request(makeApp()).get("/dump-sites/1/driver-view?jobId=9");

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      name: "Metro Gravel Pit",
      gateInstructions: "Use Gate A",
      currentJobNotes: "Call foreman before unloading.",
    });
    expect(res.body.brokerNotes).toBeUndefined();
    expect(res.body.pricing).toBeUndefined();
  });
});
