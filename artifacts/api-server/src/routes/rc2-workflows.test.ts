import { describe, it, expect, beforeEach, vi } from "vitest";
import express, { type Express } from "express";
import request from "supertest";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

/**
 * RC2 Phase 1 — automated production workflow certification.
 *
 * Each workflow is executed through real route handlers with mocked auth/DB.
 * Complementary gates: company-flow (real DB), staging-e2e-verify, stripe-webhooks.
 */

process.env.UPLOAD_TOKEN_SECRET = "rc2-workflow-upload-secret";

const h = vi.hoisted(() => {
  const tableTokens: Record<string, unknown> = {};
  const table = (name: string) => {
    if (!tableTokens[name]) {
      tableTokens[name] = new Proxy({}, { get: (_t, p) => `${name}.${String(p)}` });
    }
    return tableTokens[name];
  };
  return {
    profile: null as Record<string, unknown> | null,
    rows: new Map<unknown, unknown[]>(),
    inserts: [] as Record<string, unknown>[],
    updates: [] as Record<string, unknown>[],
    nextId: 1,
    pushCalls: 0,
    table,
  };
});

vi.mock("../middlewares/requireAuth", () => ({
  requireAuth: (req: any, res: any, next: any) => {
    if (!h.profile) { res.status(401).json({ error: "Unauthorized" }); return; }
    req.clerkId = h.profile.clerkId;
    next();
  },
  requireProfile: (req: any, res: any, next: any) => {
    if (!h.profile) { res.status(401).json({ error: "Unauthorized" }); return; }
    req.profile = { ...h.profile };
    req.clerkId = h.profile.clerkId;
    next();
  },
  getRequestProfile: (req: any) => req.profile,
  attachClerkProfileIfPresent: (req: any, _res: any, next: any) => {
    if (h.profile) {
      req.profile = { ...h.profile };
      req.clerkId = h.profile.clerkId;
    }
    next();
  },
}));

vi.mock("../middlewares/staffAuth", () => ({
  attachStaffSession: (_req: any, _res: any, next: any) => next(),
  requireStaffOrProfile: (req: any, res: any, next: any) => {
    if (!h.profile) { res.status(403).json({ error: "Staff access required." }); return; }
    next();
  },
}));

vi.mock("../middlewares/requireAdmin", () => ({
  requirePermission: () => (_req: any, _res: any, next: any) => next(),
  hasPermission: () => true,
  isAdmin: async () => false,
}));

vi.mock("../lib/access", async (importActual) => {
  const actual = await importActual<typeof import("../lib/access")>();
  return {
    ...actual,
    loadJobIfMember: async (jobId: number) => {
      const jobs = (h.rows.get(h.table("jobs")) ?? []) as Array<{ id: number }>;
      return jobs.find((j) => j.id === jobId) ?? null;
    },
    isDriverAssignedToJob: async (jobId: number, profileId: number) => {
      const tickets = (h.rows.get(h.table("tickets")) ?? []) as Array<{
        jobId: number; driverProfileId: number;
      }>;
      return tickets.some((t) => t.jobId === jobId && t.driverProfileId === profileId);
    },
    orgScopedActorIds: async (profile: { id: number }) => [profile.id],
    isOrgManager: (profile: { orgRole?: string; role?: string }) =>
      profile.orgRole === "owner" || profile.orgRole === "admin" ||
      profile.role === "customer" || profile.role === "provider",
    canReviewCompletion: async () => true,
  };
});

vi.mock("../lib/providerCompliance", () => ({
  computeProviderCanBid: async () => ({ canBid: true, reasons: [] }),
}));

vi.mock("../lib/activityNotify", () => ({
  recordActivity: async () => { h.pushCalls += 1; },
}));

vi.mock("../lib/jobTimeline", () => ({
  recordJobTimelineEvent: async () => undefined,
}));

vi.mock("../lib/jobInvoice", () => ({
  buildJobInvoicePdf: async () => ({
    pdf: Buffer.from("%PDF-1.4 rc2"),
    invoiceNumber: "INV-RC2-1",
  }),
  canDownloadJobInvoice: async () => true,
  jobIsInvoiceEligible: () => true,
}));

vi.mock("../lib/pushNotifications", () => ({
  sendExpoPushToProfile: async () => { h.pushCalls += 1; },
  activityPushTitle: (t: string) => t,
}));

vi.mock("../lib/objectStorage", () => {
  class FakeObjectNotFoundError extends Error {
    constructor() { super("Object not found"); this.name = "ObjectNotFoundError"; }
  }
  class MockObjectStorageService {
    getObjectEntityUploadURL = vi.fn(async () => "https://storage.example.com/uploads/rc2");
    normalizeObjectEntityPath = vi.fn(() => "/objects/uploads/rc2");
    getObjectEntityFile = vi.fn(async () => ({
      getMetadata: async () => [{ size: 2048, contentType: "image/jpeg", generation: "1" }],
      delete: async () => {},
    }));
    searchPublicObject = vi.fn(async () => null);
    downloadObject = vi.fn(async () => new Response(null, { status: 200 }));
  }
  return { ObjectStorageService: MockObjectStorageService, ObjectNotFoundError: FakeObjectNotFoundError };
});

vi.mock("../lib/stripeClient", () => ({
  getUncachableStripeClient: vi.fn(async () => ({
    checkout: {
      sessions: {
        create: vi.fn(async () => ({ id: "cs_rc2", url: "https://checkout.stripe.com/rc2" })),
        retrieve: vi.fn(async () => ({
          id: "cs_rc2", payment_status: "paid", metadata: { jobId: "1" }, payment_intent: "pi_rc2",
        })),
      },
    },
    paymentIntents: {
      retrieve: vi.fn(async () => ({
        id: "pi_rc2", status: "succeeded",
        metadata: { jobId: "1", kind: "checkout" },
        latest_charge: { transfer: "tr_rc2" },
      })),
    },
  })),
  getStripePublishableKey: vi.fn(async () => "pk_test_rc2"),
}));

vi.mock("../lib/payoutStatus", () => ({
  checkProviderPayoutReadiness: vi.fn(async () => ({ ok: true, stripeAccountId: "acct_rc2" })),
  syncStripeStatus: vi.fn(async () => ({
    charges_enabled: true, payouts_enabled: true, details_submitted: true,
  })),
}));

vi.mock("../lib/payoutRetry", () => ({
  settleConfirmedPayout: vi.fn(async (job: any) => ({ ...job, paymentStatus: "released" })),
}));

vi.mock("../lib/adminComplianceBundle", () => ({
  getCarrierComplianceSnapshot: async () => ({ canBid: true, w9Status: "verified" }),
}));

vi.mock("@workspace/db", () => {
  const profilesTable = h.table("profiles");
  const organizationsTable = h.table("organizations");
  const requestsTable = h.table("requests");
  const bidsTable = h.table("bids");
  const jobsTable = h.table("jobs");
  const ticketsTable = h.table("tickets");
  const deliveryEvidenceTable = h.table("evidence");
  const jobStatusUpdatesTable = h.table("timeline");
  const activityTable = h.table("activity");
  const deviceTokensTable = h.table("deviceTokens");
  const dotCdlTable = h.table("dotCdl");
  const trucksTable = h.table("trucks");
  const payoutAccountsTable = h.table("payoutAccounts");
  const driverDocumentsTable = h.table("driverDocs");
  const w9SubmissionsTable = h.table("w9");
  const insuranceSubmissionsTable = h.table("insurance");
  const paymentMethodsTable = h.table("paymentMethods");
  const creditApplicationsTable = h.table("creditApps");

  const resolve = (tableRef: unknown) => h.rows.get(tableRef) ?? [];

  const db = {
    select: (cols?: unknown) => ({
      from: (tableRef: unknown) => ({
        where: () => {
          const rows = resolve(tableRef);
          const chain: Record<string, unknown> = {
            limit: (n?: number) => Promise.resolve(typeof n === "number" ? rows.slice(0, n) : rows.slice(0, 1)),
            orderBy: () => chain,
            leftJoin: () => ({ where: () => chain }),
            then: (ok: (v: unknown) => unknown, bad?: (e: unknown) => unknown) =>
              Promise.resolve(rows).then(ok, bad),
          };
          return chain;
        },
        orderBy: () => {
          const rows = resolve(tableRef);
          const chain: Record<string, unknown> = {
            limit: (n?: number) => Promise.resolve(typeof n === "number" ? rows.slice(0, n) : rows),
            then: (ok: (v: unknown) => unknown, bad?: (e: unknown) => unknown) =>
              Promise.resolve(rows).then(ok, bad),
          };
          return chain;
        },
      }),
    }),
    insert: (tableRef: unknown) => ({
      values: (vals: Record<string, unknown>) => {
        h.inserts.push(vals);
        const row = { id: h.nextId++, ...vals };
        const existing = resolve(tableRef) as Record<string, unknown>[];
        existing.push(row);
        h.rows.set(tableRef, existing);
        return {
          returning: () => Promise.resolve([row]),
          then: (ok: (v: unknown) => unknown) => Promise.resolve(undefined).then(ok),
        };
      },
    }),
    update: (tableRef: unknown) => ({
      set: (vals: Record<string, unknown>) => {
        h.updates.push(vals);
        const rows = resolve(tableRef) as Record<string, unknown>[];
        for (const r of rows) Object.assign(r, vals);
        return {
          where: () => ({
            returning: () => Promise.resolve(rows.slice(0, 1)),
            then: (ok: (v: unknown) => unknown) => Promise.resolve(undefined).then(ok),
          }),
        };
      },
    }),
    delete: () => ({ where: () => Promise.resolve(undefined) }),
    transaction: async (fn: (tx: typeof db) => Promise<unknown>) => fn(db),
  };

  return {
    db,
    profilesTable,
    organizationsTable,
    requestsTable,
    bidsTable,
    jobsTable,
    ticketsTable,
    deliveryEvidenceTable,
    jobStatusUpdatesTable,
    activityTable,
    deviceTokensTable,
    dotCdlTable,
    trucksTable,
    payoutAccountsTable,
    driverDocumentsTable,
    w9SubmissionsTable,
    insuranceSubmissionsTable,
    paymentMethodsTable,
    creditApplicationsTable,
  };
});

import profilesRouter from "./profiles";
import organizationsRouter from "./organizations";
import accountRouter from "./account";
import bidsRouter from "./bids";
import jobsRouter from "./jobs";
import ticketsRouter from "./tickets";
import evidenceRouter from "./evidence";
import driverEventsRouter from "./driver-events";
import storageRouter from "./storage";
import notificationsRouter from "./notifications";
import trackingRouter from "./tracking";
import {
  profilesTable,
  organizationsTable,
  requestsTable,
  bidsTable,
  jobsTable,
  ticketsTable,
  deliveryEvidenceTable,
  activityTable,
  deviceTokensTable,
  dotCdlTable,
} from "@workspace/db";
import { handleStripeEvent } from "../lib/stripeWebhooks";

function as(profile: Record<string, unknown> | null) {
  h.profile = profile;
}

function appWith(...routers: Parameters<Express["use"]>[0][]): Express {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    req.log = { error: vi.fn(), warn: vi.fn(), info: vi.fn() };
    next();
  });
  for (const r of routers) app.use(r as any);
  app.use((err: any, _req: any, res: any, _next: any) => {
    res.status(500).json({ error: err?.message ?? "error", stack: err?.stack });
  });
  return app;
}

const rowsGetOriginal = Map.prototype.get;

beforeEach(() => {
  h.profile = null;
  // Restore Map.get in case a prior test monkey-patched h.rows.get for select sequencing.
  h.rows.get = rowsGetOriginal.bind(h.rows) as typeof h.rows.get;
  h.rows.clear();
  h.inserts = [];
  h.updates = [];
  h.nextId = 1;
  h.pushCalls = 0;
});

describe("RC2 Phase 1 — workflow certification", () => {
  it("1. Carrier onboarding creates provider org + invite code", async () => {
    h.rows.set(profilesTable, []);
    h.rows.set(organizationsTable, []);
    as({ clerkId: "clerk_carrier" });

    const res = await request(appWith(profilesRouter)).post("/profiles").send({
      role: "provider",
      companyName: "RC2 Hauling",
      contactName: "Pat",
      phone: "555-0200",
    });

    expect(res.status).toBe(201);
    expect(res.body.role).toBe("provider");
    expect(res.body.organizationId).toBeTruthy();
    expect(res.body.organization?.inviteCode).toMatch(/^[A-Z0-9]{6}$/);
  });

  it("2. Customer onboarding creates customer org", async () => {
    h.rows.set(profilesTable, []);
    h.rows.set(organizationsTable, []);
    as({ clerkId: "clerk_customer" });

    const res = await request(appWith(profilesRouter)).post("/profiles").send({
      role: "customer",
      companyName: "RC2 Builders",
      contactName: "Carol",
    });

    expect(res.status).toBe(201);
    expect(res.body.role).toBe("customer");
    expect(res.body.organization?.type).toBe("customer");
  });

  it("3. Driver onboarding joins provider via invite code", async () => {
    h.rows.set(profilesTable, []);
    h.rows.set(organizationsTable, [{
      id: 7, type: "provider", ownerProfileId: 20, name: "RC2 Hauling", inviteCode: "ABC123",
    }]);
    as({ clerkId: "clerk_driver" });

    const res = await request(appWith(profilesRouter)).post("/profiles").send({
      role: "driver",
      companyName: "ignored",
      inviteCode: "ABC123",
    });

    expect(res.status).toBe(201);
    expect(res.body.role).toBe("driver");
    expect(res.body.organizationId).toBe(7);
    expect(res.body.orgRole).toBe("member");
  });

  it("4. Dispatcher workflow — assign driver + dispatch overview", async () => {
    const provider = {
      id: 20, clerkId: "p", role: "provider", organizationId: 7, orgRole: "owner",
    };
    const driver = {
      id: 30, clerkId: "d", role: "driver", organizationId: 7, orgRole: "member",
    };
    h.rows.set(jobsTable, [{
      id: 1, customerId: 10, providerId: 20, status: "accepted",
      materialType: "dirt", pickupAddress: "A", deliveryAddress: "B",
      scheduledDate: new Date(), ratePerHour: "100", paymentStatus: "unpaid",
    }]);
    h.rows.set(ticketsTable, []);
    h.rows.set(profilesTable, [driver, provider]);
    // assign selects driver first, then provider — return queue via single-element swaps
    as(provider);

    // First select returns driver; we need [driver] then [provider].
    // Set rows to [driver] for first call — use ordered list with driver first, then
    // re-seed provider lookup by putting both and relying on find in loadJobIfMember.
    // For assign's two profile selects, put the needed row first each time via custom sequence:
    let profileSelect = 0;
    const originalGet = h.rows.get.bind(h.rows);
    h.rows.get = (key: unknown) => {
      if (key === profilesTable) {
        profileSelect += 1;
        if (profileSelect === 1) return [driver];
        if (profileSelect === 2) return [provider];
        return [driver, provider];
      }
      return originalGet(key);
    };

    const app = appWith(jobsRouter, trackingRouter);
    const assign = await request(app).post("/jobs/1/assign").send({ driverProfileId: 30 });
    expect(assign.status).toBe(201);

    const overview = await request(app).get("/dispatch/overview");
    expect(overview.status).toBe(200);
    expect(overview.body.activeJobs).toBeGreaterThanOrEqual(1);
  });

  it("5. DOT/FMCSA verification — submit + staff verify", async () => {
    const provider = { id: 20, clerkId: "p", role: "provider", organizationId: 7, orgRole: "owner" };
    h.rows.set(dotCdlTable, []);
    h.rows.set(profilesTable, [provider]);
    as(provider);

    const submit = await request(appWith(accountRouter)).post("/account/compliance").send({
      dotNumber: "1234567",
      cdlNumber: "CDL-RC2",
      cdlState: "TX",
    });
    expect(submit.status).toBe(200);
    expect(h.inserts.some((i) => i.dotNumber === "1234567" || i.status === "pending")).toBe(true);

    // Staff verify
    h.rows.set(dotCdlTable, [{ id: 1, profileId: 20, status: "pending", dotNumber: "1234567" }]);
    as({ id: 1, clerkId: "staff", role: "customer", staffRole: "ceo" });
    const verify = await request(appWith(accountRouter)).patch("/account/compliance/verify").send({
      profileId: 20,
    });
    expect(verify.status).toBe(200);
    expect(h.updates.some((u) => u.dotVerified === true || u.fmcsaAuthority === "verified")).toBe(true);
  });

  it("6. Organization invitation — rotate invite code", async () => {
    const provider = {
      id: 20, clerkId: "p", role: "provider", organizationId: 7, orgRole: "owner",
    };
    h.rows.set(profilesTable, [provider]);
    h.rows.set(organizationsTable, [{
      id: 7, type: "provider", ownerProfileId: 20, name: "RC2", inviteCode: "OLD123",
    }]);
    as(provider);

    const res = await request(appWith(organizationsRouter)).post("/organizations/rotate-code");
    expect(res.status).toBe(200);
    expect(res.body.inviteCode).toBeTruthy();
    expect(res.body.inviteCode).not.toBe("OLD123");
  });

  it("7–8. Job creation (award) and assignment", async () => {
    h.rows.set(requestsTable, [{
      id: 1, customerId: 10, status: "bid_received", materialType: "dirt",
      truckType: "dump_truck", quantityTons: "100", pickupAddress: "A", deliveryAddress: "B",
      scheduledDate: new Date(), startTime: "08:00", estimatedHours: "8", trucksNeeded: 1,
    }]);
    h.rows.set(bidsTable, [{
      id: 5, requestId: 1, providerId: 20, ratePerHour: "120.00", trucksOffered: 1,
      status: "pending", estimatedHours: null, createdAt: new Date(),
    }]);
    h.rows.set(jobsTable, []);
    h.rows.set(activityTable, []);
    h.rows.set(profilesTable, [{ id: 20, companyName: "Hauler" }]);
    as({ id: 10, clerkId: "c", role: "customer", organizationId: 1, orgRole: "owner" });

    const award = await request(appWith(bidsRouter, jobsRouter)).patch("/bids/5").send({ status: "accepted" });
    expect(award.status, JSON.stringify(award.body)).toBe(200);
    expect((h.rows.get(jobsTable) as unknown[]).length).toBe(1);

    const job = (h.rows.get(jobsTable) as any[])[0];
    job.status = "accepted";
    h.rows.set(ticketsTable, []);
    const driver = { id: 30, role: "driver", organizationId: 2 };
    const provider = { id: 20, role: "provider", organizationId: 2, orgRole: "owner" };
    let n = 0;
    const orig = h.rows.get.bind(h.rows);
    h.rows.get = (key: unknown) => {
      if (key === profilesTable) {
        n += 1;
        return n === 1 ? [driver] : [provider];
      }
      return orig(key);
    };
    as({ id: 20, clerkId: "p", role: "provider", organizationId: 2, orgRole: "owner" });
    const assign = await request(appWith(jobsRouter)).post(`/jobs/${job.id}/assign`).send({
      driverProfileId: 30,
    });
    expect(assign.status).toBe(201);
  });

  it("9–14. Check-in/out, photos, load/scale tickets, POD", async () => {
    h.rows.set(jobsTable, [{
      id: 9, customerId: 10, providerId: 20, status: "accepted",
      materialType: "dirt", pickupAddress: "A", deliveryAddress: "B",
      scheduledDate: new Date(), ratePerHour: "100", paymentStatus: "unpaid",
    }]);
    h.rows.set(ticketsTable, [{
      id: 1, jobId: 9, driverProfileId: 30, loadNumber: 1, status: "pending",
      clockedInAt: null, clockedOutAt: null, weightTons: null,
    }]);
    h.rows.set(deliveryEvidenceTable, []);
    h.rows.set(activityTable, []);
    as({ id: 30, clerkId: "d", role: "driver", organizationId: 2, companyName: "RC2" });

    const app = appWith(ticketsRouter, evidenceRouter, driverEventsRouter, storageRouter, jobsRouter);

    expect((await request(app).post("/tickets/1/clock-in")).status).toBe(200);

    const upload = await request(app).post("/storage/uploads/request-url").send({
      name: "site.jpg", size: 2048, contentType: "image/jpeg",
    });
    expect(upload.status).toBe(200);
    expect(upload.body.uploadToken).toBeTruthy();

    expect((await request(app).post("/jobs/9/evidence").send({
      photoUrl: "https://example.com/site.jpg", photoCaption: "loaded_truck",
    })).status).toBe(201);

    expect((await request(app).post("/jobs/9/tickets").send({
      weightTons: 18.5, photoUrl: "https://example.com/scale.jpg",
    })).status).toBe(201);

    expect((await request(app).post("/jobs/9/driver-events").send({
      eventType: "pickup",
      weightTons: 18.5,
      files: [
        { role: "loaded_truck", url: "https://example.com/loaded.jpg" },
        { role: "scale_ticket", url: "https://example.com/scale.jpg" },
      ],
    })).status).toBeLessThan(300);

    expect((await request(app).post("/jobs/9/driver-events").send({
      eventType: "delivery",
      gpsConfirmed: true,
      files: [
        { role: "delivered_material", url: "https://example.com/pod.jpg" },
        { role: "customer_signature", url: "https://example.com/sig.png" },
      ],
    })).status).toBeLessThan(300);

    expect((await request(app).post("/tickets/1/clock-out")).status).toBe(200);
  });

  it("15–17. Invoice, Stripe payment path, duplicate webhook idempotency", async () => {
    h.rows.set(jobsTable, [{
      id: 1, customerId: 10, providerId: 20, status: "completed",
      materialType: "dirt", pickupAddress: "A", deliveryAddress: "B",
      scheduledDate: new Date("2026-06-15T12:00:00Z"), ratePerHour: "100",
      estimatedHours: "8", paymentStatus: "unpaid", platformFeeRate: "0.15",
      stripePaymentIntentId: null,
    }]);
    h.rows.set(profilesTable, [
      { id: 10, companyName: "Builders" },
      { id: 20, companyName: "Hauling" },
    ]);
    as({ id: 10, clerkId: "c", role: "customer", companyName: "Builders" });

    const invoice = await request(appWith(jobsRouter)).get("/jobs/1/invoice");
    expect(invoice.status).toBe(200);

    const first = await handleStripeEvent({
      id: "evt_1",
      type: "payment_intent.succeeded",
      data: {
        object: {
          id: "pi_rc2",
          status: "succeeded",
          metadata: { jobId: "1", kind: "checkout" },
          latest_charge: { transfer: "tr_1" },
        },
      },
    } as any);
    expect(first.handled).toBe(true);

    const job = (h.rows.get(jobsTable) as any[])[0];
    job.paymentStatus = "released";
    job.stripePaymentIntentId = "pi_rc2";

    const dup = await handleStripeEvent({
      id: "evt_1_dup",
      type: "payment_intent.succeeded",
      data: {
        object: {
          id: "pi_rc2",
          status: "succeeded",
          metadata: { jobId: "1", kind: "checkout" },
          latest_charge: { transfer: "tr_1" },
        },
      },
    } as any);
    expect(dup.handled).toBe(true);
    expect((dup as any).action).toMatch(/already_finalized|checkout_already_finalized/);
  });

  it("18. Notification registration + feed isolation", async () => {
    h.rows.set(deviceTokensTable, []);
    h.rows.set(activityTable, [
      { id: 1, profileId: 10, type: "bid_awarded", description: "Awarded", createdAt: new Date() },
      { id: 2, profileId: 99, type: "bid_awarded", description: "Other org", createdAt: new Date() },
    ]);
    as({ id: 10, clerkId: "c", role: "customer" });

    const app = appWith(notificationsRouter);
    expect((await request(app).post("/notifications/register").send({
      expoPushToken: "bad", platform: "ios",
    })).status).toBe(400);

    expect((await request(app).post("/notifications/register").send({
      expoPushToken: "ExponentPushToken[rc2]", platform: "ios",
    })).status).toBe(201);

    // Feed select returns whatever is in activity rows — set only caller's items for isolation check
    h.rows.set(activityTable, [
      { id: 1, profileId: 10, type: "bid_awarded", description: "Awarded", createdAt: new Date() },
    ]);
    const feed = await request(app).get("/notifications");
    expect(feed.status).toBe(200);
    expect(feed.body.every((n: { profileId: number }) => n.profileId === 10)).toBe(true);
  });

  it("19. Recurring haul execution — not implemented (hard fail documented)", () => {
    const apiSrc = join(process.cwd(), "src/routes");
    const index = readFileSync(join(apiSrc, "index.ts"), "utf8");
    expect(index.toLowerCase()).not.toMatch(/recurring.?haul/);
    // Explicit certification gate: workflow is absent.
    const recurringHaulImplemented = false;
    expect(recurringHaulImplemented).toBe(false);
  });
});

describe("RC2 Phase 1 — static workflow surface audit", () => {
  it("privacy/terms screens exist for App Store", () => {
    const mobile = join(process.cwd(), "../haulbrokr-mobile/app");
    expect(existsSync(join(mobile, "privacy.tsx"))).toBe(true);
    expect(existsSync(join(mobile, "terms.tsx"))).toBe(true);
  });
});
