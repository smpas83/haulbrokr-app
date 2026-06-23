import { describe, it, expect, beforeEach, vi } from "vitest";
import express, { type Express } from "express";
import request from "supertest";

/**
 * Shared, mutable test state for the (hoisted) `vi.mock` factories.
 */
const h = vi.hoisted(() => ({
  /** Base row merged into every `db.update().set(...).returning()` result. */
  updateBase: {} as Record<string, unknown>,
  /** Every payload passed to `db.update().set(...)`, in call order. */
  updates: [] as Record<string, unknown>[],
  /** Every payload passed to `db.insert().values(...)`, in call order. */
  inserts: [] as Record<string, unknown>[],
  /** Rows returned by `db.select()...` (used by the stuck-payouts list). */
  selectRows: [] as Record<string, unknown>[],
  /** Stuck-payout jobs returned by findStuckPayoutJobs(). */
  stuckJobs: [] as any[],
  /** Result returned by retryStuckPayout(). */
  retryResult: { jobId: 0, outcome: "released", message: "ok" } as any,
  /** Authenticated profile injected by the requireProfile mock. */
  profile: { id: 1 } as Record<string, unknown>,
}));

vi.mock("@workspace/db", () => {
  const makeTable = (name: string) =>
    new Proxy({}, { get: (_t, p) => `${name}.${String(p)}` });
  const db = {
    update: () => ({
      set: (vals: Record<string, unknown>) => {
        h.updates.push(vals);
        return {
          where: () => ({
            returning: () => Promise.resolve([{ ...h.updateBase, ...vals }]),
          }),
        };
      },
    }),
    insert: () => ({
      values: (vals: Record<string, unknown>) => {
        h.inserts.push(vals);
        return Promise.resolve(undefined);
      },
    }),
    select: () => {
      // A thenable that resolves to h.selectRows and is also chainable with
      // .where()/.leftJoin()/.innerJoin()/.orderBy(). The overview endpoint
      // awaits `.from()` directly (no .where()), so `from()` is itself awaitable.
      const makeChain = (): any => {
        const p: any = Promise.resolve(h.selectRows);
        p.where = () => makeChain();
        p.leftJoin = () => makeChain();
        p.innerJoin = () => makeChain();
        p.orderBy = () => Promise.resolve(h.selectRows);
        return p;
      };
      return { from: () => makeChain() };
    },
  };
  return {
    db,
    dotCdlTable: makeTable("dotCdl"),
    creditApplicationsTable: makeTable("creditApplications"),
    profilesTable: makeTable("profiles"),
    activityTable: makeTable("activity"),
    jobsTable: makeTable("jobs"),
    binOrders: makeTable("binOrders"),
    w9SubmissionsTable: makeTable("w9Submissions"),
    insuranceSubmissionsTable: makeTable("insuranceSubmissions"),
    driverDocumentsTable: makeTable("driverDocuments"),
    payoutAccountsTable: makeTable("payoutAccounts"),
  };
});

vi.mock("../lib/payoutRetry", () => ({
  findStuckPayoutJobs: async () => h.stuckJobs,
  retryStuckPayout: async () => h.retryResult,
}));

// Inject an authenticated admin profile (id 1) without Clerk. requireAdmin
// itself grants access outside production when no allowlist is configured.
vi.mock("../middlewares/staffAuth", () => ({
  attachStaffSession: (_req: any, _res: any, next: any) => next(),
  requireStaffOrProfile: (req: any, _res: any, next: any) => {
    req.profile = { ...h.profile };
    next();
  },
}));

vi.mock("../middlewares/requireAuth", () => ({
  attachClerkProfileIfPresent: (req: any, _res: any, next: any) => {
    req.profile = { ...h.profile };
    next();
  },
  requireAuth: (_req: any, _res: any, next: any) => next(),
  requireProfile: (req: any, _res: any, next: any) => {
    req.profile = { ...h.profile };
    next();
  },
  getRequestProfile: (req: any) => req.profile,
}));

import adminRouter from "./admin";

const APPLICANT_ID = 42;

function makeApp(): Express {
  const app = express();
  app.use(express.json());
  app.use(adminRouter);
  return app;
}

beforeEach(() => {
  h.updateBase = { id: 1, profileId: APPLICANT_ID };
  h.updates = [];
  h.inserts = [];
  h.selectRows = [{ id: 1, companyName: "Acme Co" }];
  h.stuckJobs = [];
  h.retryResult = { jobId: 0, outcome: "released", message: "ok" };
  h.profile = { id: 1 };
  delete process.env.ADMIN_USER_IDS;
});

describe("PATCH /admin/compliance/:profileId", () => {
  it("approves DOT/CDL: clears the review note and notifies the carrier", async () => {
    const res = await request(makeApp())
      .patch(`/admin/compliance/${APPLICANT_ID}`)
      .send({ action: "approve" });

    expect(res.status).toBe(200);
    expect(h.updates[0]).toMatchObject({ status: "verified", reviewNote: null });
    expect(h.inserts).toHaveLength(1);
    expect(h.inserts[0]).toMatchObject({
      profileId: APPLICANT_ID,
      type: "application_approved",
      relatedId: null,
    });
  });

  it("rejects DOT/CDL: stores the reason and notifies the carrier with it", async () => {
    const res = await request(makeApp())
      .patch(`/admin/compliance/${APPLICANT_ID}`)
      .send({ action: "reject", note: "Insurance certificate expired." });

    expect(res.status).toBe(200);
    expect(h.updates[0]).toMatchObject({
      status: "rejected",
      reviewNote: "Insurance certificate expired.",
    });
    expect(h.inserts[0]).toMatchObject({
      profileId: APPLICANT_ID,
      type: "application_rejected",
    });
    expect(h.inserts[0].description).toContain("Insurance certificate expired.");
  });

  it("rejects an invalid action", async () => {
    const res = await request(makeApp())
      .patch(`/admin/compliance/${APPLICANT_ID}`)
      .send({ action: "maybe" });
    expect(res.status).toBe(400);
  });
});

describe("PATCH /admin/compliance/:profileId/w9", () => {
  it("approves a W-9 submission", async () => {
    const res = await request(makeApp())
      .patch(`/admin/compliance/${APPLICANT_ID}/w9`)
      .send({ action: "approve" });
    expect(res.status).toBe(200);
    expect(h.updates[0]).toMatchObject({ status: "verified", reviewNote: null });
    expect(h.inserts[0].description).toContain("W-9");
  });

  it("rejects a W-9 with a stored reason", async () => {
    const res = await request(makeApp())
      .patch(`/admin/compliance/${APPLICANT_ID}/w9`)
      .send({ action: "reject", note: "Name mismatch." });
    expect(res.status).toBe(200);
    expect(h.updates[0]).toMatchObject({ status: "rejected", reviewNote: "Name mismatch." });
  });
});

describe("PATCH /admin/compliance/:profileId/insurance", () => {
  it("approves an insurance submission", async () => {
    const res = await request(makeApp())
      .patch(`/admin/compliance/${APPLICANT_ID}/insurance`)
      .send({ action: "approve" });
    expect(res.status).toBe(200);
    expect(h.updates[0]).toMatchObject({ status: "verified" });
  });
});

describe("PATCH /admin/compliance/:profileId/documents/:docType", () => {
  it("approves an uploaded compliance document", async () => {
    const res = await request(makeApp())
      .patch(`/admin/compliance/${APPLICANT_ID}/documents/coi`)
      .send({ action: "approve" });
    expect(res.status).toBe(200);
    expect(h.updates[0]).toMatchObject({ status: "verified", reviewNote: null });
  });

  it("rejects an invalid doc type with 404", async () => {
    const res = await request(makeApp())
      .patch(`/admin/compliance/${APPLICANT_ID}/documents/not_a_real_type`)
      .send({ action: "approve" });
    expect(res.status).toBe(404);
  });
});

describe("PATCH /admin/credit-applications/:profileId", () => {
  it("approves: clears the review note and notifies the customer", async () => {
    const res = await request(makeApp())
      .patch(`/admin/credit-applications/${APPLICANT_ID}`)
      .send({ action: "approve" });

    expect(res.status).toBe(200);
    expect(h.updates[0]).toMatchObject({ status: "approved", reviewNote: null });
    expect(h.inserts[0]).toMatchObject({
      profileId: APPLICANT_ID,
      type: "application_approved",
    });
  });

  it("rejects: stores the reason and notifies the customer with it", async () => {
    const res = await request(makeApp())
      .patch(`/admin/credit-applications/${APPLICANT_ID}`)
      .send({ action: "reject", note: "Insufficient trade references." });

    expect(res.status).toBe(200);
    expect(h.updates[0]).toMatchObject({
      status: "rejected",
      reviewNote: "Insufficient trade references.",
    });
    expect(h.inserts[0]).toMatchObject({
      profileId: APPLICANT_ID,
      type: "application_rejected",
    });
    expect(h.inserts[0].description).toContain("Insufficient trade references.");
  });
});

describe("GET /admin/stuck-payouts", () => {
  it("returns enriched stuck-payout items", async () => {
    h.stuckJobs = [
      {
        id: 99,
        materialType: "Concrete",
        customerId: 2,
        providerId: 3,
        providerNetAmount: "850.00",
        customerTotalAmount: "1000.00",
        paymentAttempts: 1,
        payoutRetryFailures: 2,
        payoutAlertSentAt: "2026-06-16T01:00:00.000Z",
        completedAt: null,
        createdAt: "2026-06-16T00:00:00.000Z",
      },
    ];
    const res = await request(makeApp()).get("/admin/stuck-payouts");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({
      id: 99,
      materialType: "Concrete",
      customerCompany: "Acme Co",
      providerCompany: "Acme Co",
      providerNetAmount: 850,
      customerTotalAmount: 1000,
      paymentAttempts: 1,
      payoutRetryFailures: 2,
      payoutAlertSentAt: "2026-06-16T01:00:00.000Z",
    });
  });

  it("defaults a missing failure count to 0", async () => {
    h.stuckJobs = [
      {
        id: 5,
        materialType: "Gravel",
        customerId: 2,
        providerId: 3,
        providerNetAmount: null,
        customerTotalAmount: null,
        paymentAttempts: 0,
        payoutRetryFailures: null,
        payoutAlertSentAt: null,
        completedAt: null,
        createdAt: "2026-06-16T00:00:00.000Z",
      },
    ];
    const res = await request(makeApp()).get("/admin/stuck-payouts");
    expect(res.status).toBe(200);
    expect(res.body[0].payoutRetryFailures).toBe(0);
    expect(res.body[0].payoutAlertSentAt).toBeNull();
  });

  it("sorts the most-failed payouts first", async () => {
    h.stuckJobs = [
      { id: 1, materialType: "A", customerId: 2, providerId: 3, paymentAttempts: 1, payoutRetryFailures: 1, payoutAlertSentAt: null, completedAt: null, createdAt: "2026-06-16T00:00:00.000Z" },
      { id: 2, materialType: "B", customerId: 2, providerId: 3, paymentAttempts: 1, payoutRetryFailures: 5, payoutAlertSentAt: null, completedAt: null, createdAt: "2026-06-16T00:00:00.000Z" },
      { id: 3, materialType: "C", customerId: 2, providerId: 3, paymentAttempts: 1, payoutRetryFailures: 3, payoutAlertSentAt: null, completedAt: null, createdAt: "2026-06-16T00:00:00.000Z" },
    ];
    const res = await request(makeApp()).get("/admin/stuck-payouts");
    expect(res.status).toBe(200);
    expect(res.body.map((j: { id: number }) => j.id)).toEqual([2, 3, 1]);
  });

  it("returns an empty list when nothing is stuck", async () => {
    h.stuckJobs = [];
    const res = await request(makeApp()).get("/admin/stuck-payouts");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

describe("POST /admin/stuck-payouts/:id/retry", () => {
  it("returns 200 with the released outcome on success", async () => {
    h.selectRows = [{ id: 7 }];
    h.retryResult = { jobId: 7, outcome: "released", message: "Provider payout released." };
    const res = await request(makeApp()).post("/admin/stuck-payouts/7/retry");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ jobId: 7, outcome: "released" });
  });

  it("returns 200 with a skipped outcome when not eligible", async () => {
    h.selectRows = [{ id: 7 }];
    h.retryResult = { jobId: 7, outcome: "skipped", message: "Customer charge has not succeeded yet." };
    const res = await request(makeApp()).post("/admin/stuck-payouts/7/retry");
    expect(res.status).toBe(200);
    expect(res.body.outcome).toBe("skipped");
  });

  it("returns 502 when the transfer fails", async () => {
    h.selectRows = [{ id: 7 }];
    h.retryResult = { jobId: 7, outcome: "failed", message: "transfer boom" };
    const res = await request(makeApp()).post("/admin/stuck-payouts/7/retry");
    expect(res.status).toBe(502);
    expect(res.body.outcome).toBe("failed");
  });

  it("returns 404 when the job does not exist", async () => {
    h.selectRows = [];
    const res = await request(makeApp()).post("/admin/stuck-payouts/123/retry");
    expect(res.status).toBe(404);
  });
});

describe("POST /admin/stuck-payouts/:id/reset-failures", () => {
  it("zeroes the failure count and clears the alert flag", async () => {
    h.selectRows = [{ id: 7, payoutRetryFailures: 4, payoutAlertSentAt: "2026-06-16T01:00:00.000Z" }];
    const res = await request(makeApp()).post("/admin/stuck-payouts/7/reset-failures");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: 7, payoutRetryFailures: 0, payoutAlertSentAt: null });
    expect(h.updates[0]).toMatchObject({ payoutRetryFailures: 0, payoutAlertSentAt: null });
  });

  it("returns 404 when the job does not exist", async () => {
    h.selectRows = [];
    const res = await request(makeApp()).post("/admin/stuck-payouts/123/reset-failures");
    expect(res.status).toBe(404);
    expect(h.updates).toHaveLength(0);
  });

  it("returns 400 for a non-numeric id", async () => {
    const res = await request(makeApp()).post("/admin/stuck-payouts/abc/reset-failures");
    expect(res.status).toBe(400);
  });
});

// When an allowlist is configured but the caller isn't on it, access is driven
// purely by the profile's staffRole — exactly the per-role gating we want to
// verify. (With no allowlist, dev-fallback would grant superadmin to everyone.)
describe("per-role permission gating", () => {
  beforeEach(() => {
    process.env.ADMIN_USER_IDS = "someone-else";
  });

  it("Accounting gets the full review scope + overview, no staff management", async () => {
    h.profile = { id: 1, staffRole: "accounting" };
    const res = await request(makeApp()).get("/admin/access");
    expect(res.status).toBe(200);
    expect(res.body.isAdmin).toBe(true);
    expect(res.body.staffRole).toBe("accounting");
    expect(res.body.permissions.sort()).toEqual(["compliance", "credit", "overview", "payouts"]);
  });

  it("legacy AP resolves to the Accounting scope (all review areas + overview)", async () => {
    h.profile = { id: 1, staffRole: "ap" };
    const res = await request(makeApp()).get("/admin/access");
    expect(res.status).toBe(200);
    expect(res.body.staffRole).toBe("ap");
    expect(res.body.permissions.sort()).toEqual(["compliance", "credit", "overview", "payouts"]);
  });

  it("legacy AR resolves to the Accounting scope (all review areas + overview)", async () => {
    h.profile = { id: 1, staffRole: "ar" };
    const res = await request(makeApp()).get("/admin/access");
    expect(res.status).toBe(200);
    expect(res.body.staffRole).toBe("ar");
    expect(res.body.permissions.sort()).toEqual(["compliance", "credit", "overview", "payouts"]);
  });

  it("CEO sees overview + all review areas + view-only staff, no manage_staff", async () => {
    h.profile = { id: 1, staffRole: "ceo" };
    const res = await request(makeApp()).get("/admin/access");
    expect(res.status).toBe(200);
    expect(res.body.permissions.sort()).toEqual([
      "bins", "compliance", "credit", "overview", "payouts", "view_staff",
    ]);
  });

  it("CTO / IT get full superadmin (review + bins + view + manage staff)", async () => {
    for (const role of ["cto", "it"]) {
      h.profile = { id: 1, staffRole: role };
      const res = await request(makeApp()).get("/admin/access");
      expect(res.status).toBe(200);
      expect(res.body.permissions.sort()).toEqual([
        "bins", "compliance", "credit", "manage_staff", "overview", "payouts", "view_staff",
      ]);
    }
  });

  it("CFO gets finance review + staff management but NOT operational bins", async () => {
    h.profile = { id: 1, staffRole: "cfo" };
    const res = await request(makeApp()).get("/admin/access");
    expect(res.status).toBe(200);
    expect(res.body.permissions.sort()).toEqual([
      "compliance", "credit", "manage_staff", "overview", "payouts", "view_staff",
    ]);
    expect(res.body.permissions).not.toContain("bins");
  });

  it("GET /admin/access reports no access for a non-staff profile", async () => {
    h.profile = { id: 1, staffRole: null };
    const res = await request(makeApp()).get("/admin/access");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ isAdmin: false, staffRole: null, permissions: [] });
  });

  it("Accounting can review compliance, credit, and payouts", async () => {
    h.profile = { id: 1, staffRole: "accounting" };
    const compliance = await request(makeApp())
      .patch(`/admin/compliance/${APPLICANT_ID}`)
      .send({ action: "approve" });
    expect(compliance.status).toBe(200);

    const credit = await request(makeApp())
      .patch(`/admin/credit-applications/${APPLICANT_ID}`)
      .send({ action: "approve" });
    expect(credit.status).toBe(200);

    const payouts = await request(makeApp()).get("/admin/stuck-payouts");
    expect(payouts.status).toBe(200);
  });

  it("Accounting cannot view or manage the staff roster", async () => {
    h.profile = { id: 1, staffRole: "accounting" };
    const list = await request(makeApp()).get("/admin/staff");
    expect(list.status).toBe(403);
    const assign = await request(makeApp())
      .patch("/admin/staff/9")
      .send({ staffRole: "accounting" });
    expect(assign.status).toBe(403);
  });

  it("a non-staff profile is denied every admin action", async () => {
    h.profile = { id: 1, staffRole: null };
    const overview = await request(makeApp()).get("/admin/overview");
    expect(overview.status).toBe(403);
    const compliance = await request(makeApp()).get("/admin/compliance");
    expect(compliance.status).toBe(403);
    const credit = await request(makeApp()).get("/admin/credit-applications");
    expect(credit.status).toBe(403);
    const payouts = await request(makeApp()).get("/admin/stuck-payouts");
    expect(payouts.status).toBe(403);
    const staff = await request(makeApp()).get("/admin/staff");
    expect(staff.status).toBe(403);
  });
});

describe("GET /admin/overview", () => {
  beforeEach(() => {
    process.env.ADMIN_USER_IDS = "someone-else";
  });

  it("returns platform-wide KPIs for a staff member with overview access", async () => {
    h.profile = { id: 1, staffRole: "accounting" };
    // Every aggregate query in the endpoint reads row[0] of this result.
    h.selectRows = [{ totalJobs: 12, gmv: "9000.00", brokerFees: "1350.00", count: 4 }];
    h.stuckJobs = [{ id: 1 }, { id: 2 }];

    const res = await request(makeApp()).get("/admin/overview");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      totalJobs: 12,
      gmv: 9000,
      brokerFees: 1350,
      stuckPayouts: 2,
    });
    // The remaining KPIs are simple counts driven by the shared mock row.
    expect(res.body.activeJobs).toBe(4);
    expect(res.body.completedJobs).toBe(4);
    expect(res.body.newCarriers).toBe(4);
    expect(res.body.newCustomers).toBe(4);
    expect(res.body.pendingCompliance).toBe(12);
    expect(res.body.pendingCredit).toBe(4);
    expect(res.body.openBinOrders).toBe(4);
  });

  it("is denied for a non-staff profile", async () => {
    h.profile = { id: 1, staffRole: null };
    const res = await request(makeApp()).get("/admin/overview");
    expect(res.status).toBe(403);
  });
});

describe("staff team management (manage_staff)", () => {
  beforeEach(() => {
    process.env.ADMIN_USER_IDS = "someone-else";
  });

  it("CFO can list staff members", async () => {
    h.profile = { id: 1, staffRole: "cfo" };
    h.selectRows = [{ id: 9, companyName: "Ops Inc", role: "customer", staffRole: "accounting" }];
    const res = await request(makeApp()).get("/admin/staff");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({ id: 9, companyName: "Ops Inc", staffRole: "accounting" });
  });

  it("CEO can view the staff roster read-only but cannot edit", async () => {
    h.profile = { id: 1, staffRole: "ceo" };
    h.selectRows = [{ id: 9, companyName: "Ops Inc", role: "customer", staffRole: "accounting" }];
    const list = await request(makeApp()).get("/admin/staff");
    expect(list.status).toBe(200);
    expect(list.body[0]).toMatchObject({ id: 9, staffRole: "accounting" });

    const assign = await request(makeApp())
      .patch("/admin/staff/9")
      .send({ staffRole: "it" });
    expect(assign.status).toBe(403);
  });

  it("CTO can assign a named staff role", async () => {
    h.profile = { id: 1, staffRole: "cto" };
    h.updateBase = { id: 9, companyName: "Ops Inc", role: "customer" };
    const res = await request(makeApp())
      .patch("/admin/staff/9")
      .send({ staffRole: "accounting" });
    expect(res.status).toBe(200);
    expect(h.updates[0]).toMatchObject({ staffRole: "accounting" });
    expect(res.body).toMatchObject({ id: 9, staffRole: "accounting" });
  });

  it("CTO can clear a staff role with null", async () => {
    h.profile = { id: 1, staffRole: "cto" };
    h.updateBase = { id: 9, companyName: "Ops Inc", role: "customer" };
    const res = await request(makeApp())
      .patch("/admin/staff/9")
      .send({ staffRole: null });
    expect(res.status).toBe(200);
    expect(h.updates[0]).toMatchObject({ staffRole: null });
  });

  it("rejects an unknown staff role", async () => {
    h.profile = { id: 1, staffRole: "cto" };
    const res = await request(makeApp())
      .patch("/admin/staff/9")
      .send({ staffRole: "wizard" });
    expect(res.status).toBe(400);
  });

  it("rejects assigning a legacy non-assignable role (ap/ar)", async () => {
    h.profile = { id: 1, staffRole: "cto" };
    const res = await request(makeApp())
      .patch("/admin/staff/9")
      .send({ staffRole: "ap" });
    expect(res.status).toBe(400);
  });
});
