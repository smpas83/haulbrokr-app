import { describe, it, expect, beforeEach, vi } from "vitest";
import express, { type Express } from "express";
import request from "supertest";

/**
 * Shared, mutable test state for the (hoisted) `vi.mock` factories.
 */
const h = vi.hoisted(() => ({
  /** Clerk user id reported by the mocked getAuth() — null means unauthenticated. */
  userId: "user_1" as string | null,
  /** Rows returned by `db.select().from(binOrders)...` (list + cancel/status lookup). */
  rows: [] as Record<string, unknown>[],
  /** Rows returned by `db.select().from(profilesTable)...` (customer profile lookup). */
  profileRows: [] as Record<string, unknown>[],
  /** Base row merged into every `db.update().set(...).returning()` result. */
  updateBase: {} as Record<string, unknown>,
  /** Every payload passed to `db.insert(binOrders).values(...)`, in call order. */
  inserts: [] as Record<string, unknown>[],
  /** Every payload passed to `db.insert(activityTable).values(...)`, in call order. */
  activityInserts: [] as Record<string, unknown>[],
  /** Every payload passed to `db.update().set(...)`, in call order. */
  updates: [] as Record<string, unknown>[],
}));

vi.mock("@workspace/db", () => {
  const makeTable = (name: string) =>
    new Proxy({}, { get: (_t, p) => `${name}.${String(p)}` });
  const profilesTable = makeTable("profiles");
  const activityTable = makeTable("activity");
  const db = {
    select: () => ({
      // The table proxy stringifies any property access to `<name>.<prop>`, so we
      // branch the lookup source on whether it targets profiles or bin orders.
      // (The route imports tables from @workspace/db/schema — a different proxy
      // than this mock's locals — so we match on name, not object identity.)
      from: (table: unknown) => {
        const isProfiles = String((table as any).name).startsWith("profiles");
        const source = () => (isProfiles ? h.profileRows : h.rows);
        return {
          // `where()` is awaited directly (cancel / status / profile lookup) AND
          // chained with `orderBy()` (list), so it must be a thenable that also
          // exposes orderBy.
          where: () => {
            const p: any = Promise.resolve(source());
            p.orderBy = () => Promise.resolve(source());
            return p;
          },
        };
      },
    }),
    insert: (table: unknown) => ({
      values: (vals: Record<string, unknown>) => {
        if (table === activityTable) h.activityInserts.push(vals);
        else h.inserts.push(vals);
        return {
          returning: () =>
            Promise.resolve([
              { id: "bin_1", createdAt: new Date(), updatedAt: new Date(), ...vals },
            ]),
        };
      },
    }),
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
  };
  return { db, profilesTable, activityTable };
});

vi.mock("@workspace/db/schema", () => {
  const makeTable = (name: string) =>
    new Proxy({}, { get: (_t, p) => `${name}.${String(p)}` });
  return {
    binOrders: makeTable("binOrders"),
    profilesTable: makeTable("profiles"),
    activityTable: makeTable("activity"),
  };
});

// Drive the REAL requireAuth middleware via a controllable Clerk auth.
vi.mock("@clerk/express", () => ({
  getAuth: () => ({ userId: h.userId }),
}));

import binOrdersRouter, { BIN_CATALOG } from "./bin-orders";

const USER_ID = "user_1";

function makeApp(): Express {
  const app = express();
  app.use(express.json());
  app.use(binOrdersRouter);
  return app;
}

function baseOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: "bin_existing",
    customerId: USER_ID,
    serviceType: "temporary",
    binSize: "10_yard",
    binType: "roll_off",
    quantity: 1,
    deliveryAddress: "1 Pit Rd",
    deliveryDate: new Date("2026-07-01T00:00:00Z"),
    pickupDate: null,
    wasteType: "construction",
    preferredProvider: "any",
    status: "pending",
    estimatedCostCents: 33000,
    notes: null,
    createdAt: new Date("2026-06-01T00:00:00Z"),
    updatedAt: new Date("2026-06-01T00:00:00Z"),
    ...overrides,
  };
}

function validOrderBody(overrides: Record<string, unknown> = {}) {
  return {
    serviceType: "temporary",
    binSize: "10_yard",
    binType: "roll_off",
    deliveryAddress: "1 Pit Rd",
    deliveryDate: "2026-07-01T00:00:00Z",
    wasteType: "construction",
    ...overrides,
  };
}

beforeEach(() => {
  h.userId = USER_ID;
  h.rows = [];
  h.profileRows = [{ id: 42, clerkId: USER_ID }];
  h.updateBase = baseOrder();
  h.inserts = [];
  h.activityInserts = [];
  h.updates = [];
});

describe("GET /bins", () => {
  it("returns the full bin catalog to an authenticated user", async () => {
    const res = await request(makeApp()).get("/bins");

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(BIN_CATALOG.length);
    // Each entry carries the API codes and the display fields the mobile UI renders.
    expect(res.body[0]).toMatchObject({
      id: expect.any(String),
      serviceType: expect.any(String),
      binSize: expect.any(String),
      size: expect.any(String),
      priceRange: expect.any(String),
    });
  });

  it("filters the catalog by ?serviceType=temporary", async () => {
    const res = await request(makeApp()).get("/bins?serviceType=temporary");

    expect(res.status).toBe(200);
    const expected = BIN_CATALOG.filter((b) => b.serviceType === "temporary");
    expect(res.body).toHaveLength(expected.length);
    expect(res.body.every((b: any) => b.serviceType === "temporary")).toBe(true);
  });

  it("filters the catalog by ?serviceType=permanent", async () => {
    const res = await request(makeApp()).get("/bins?serviceType=permanent");

    expect(res.status).toBe(200);
    const expected = BIN_CATALOG.filter((b) => b.serviceType === "permanent");
    expect(res.body).toHaveLength(expected.length);
    expect(res.body.every((b: any) => b.serviceType === "permanent")).toBe(true);
  });

  it("returns an empty list for an unknown serviceType filter", async () => {
    const res = await request(makeApp()).get("/bins?serviceType=nope");

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("is gated by requireAuth (401 when unauthenticated)", async () => {
    h.userId = null;

    const res = await request(makeApp()).get("/bins");

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Unauthorized");
  });
});

describe("GET /bin-orders", () => {
  it("returns the user's orders in the enriched shape", async () => {
    h.rows = [baseOrder()];

    const res = await request(makeApp()).get("/bin-orders");

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({
      binSizeLabel: "10-Yard",
      binTypeLabel: "Roll-Off",
      priceRange: "$280–380",
      priceUnit: "week",
      estimatedCost: "$280–380/wk",
      displayStatus: "pending",
    });
  });

  it("is gated by requireAuth (401 when unauthenticated)", async () => {
    h.userId = null;

    const res = await request(makeApp()).get("/bin-orders");

    expect(res.status).toBe(401);
  });
});

describe("GET /bin-orders/:id", () => {
  it("returns the order in the enriched shape when it belongs to the caller", async () => {
    h.rows = [baseOrder({ id: "bin_existing" })];

    const res = await request(makeApp()).get("/bin-orders/bin_existing");

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: "bin_existing",
      binSizeLabel: "10-Yard",
      binTypeLabel: "Roll-Off",
      priceRange: "$280–380",
      estimatedCost: "$280–380/wk",
      displayStatus: "pending",
    });
  });

  it("404s when the order belongs to another customer (no ownership leak)", async () => {
    h.rows = [baseOrder({ id: "bin_existing", customerId: "someone_else" })];

    const res = await request(makeApp()).get("/bin-orders/bin_existing");

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Order not found");
  });

  it("404s when the order does not exist", async () => {
    h.rows = [];

    const res = await request(makeApp()).get("/bin-orders/nope");

    expect(res.status).toBe(404);
  });

  it("is gated by requireAuth (401 when unauthenticated)", async () => {
    h.userId = null;

    const res = await request(makeApp()).get("/bin-orders/bin_existing");

    expect(res.status).toBe(401);
  });
});

describe("GET /admin/bin-orders", () => {
  it("returns all customers' orders in the enriched shape", async () => {
    h.rows = [
      baseOrder({ id: "bin_a", customerId: "user_1" }),
      baseOrder({ id: "bin_b", customerId: "someone_else", status: "delivered" }),
    ];

    const res = await request(makeApp()).get("/admin/bin-orders");

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    // Orders from other customers are included, not just the caller's own.
    expect(res.body.map((o: any) => o.customerId)).toEqual(["user_1", "someone_else"]);
    expect(res.body[0]).toMatchObject({
      binSizeLabel: "10-Yard",
      binTypeLabel: "Roll-Off",
      priceRange: "$280–380",
      estimatedCost: "$280–380/wk",
      displayStatus: "pending",
    });
    expect(res.body[1].displayStatus).toBe("active");
  });

  it("filters by a valid ?status=", async () => {
    h.rows = [baseOrder({ id: "bin_b", customerId: "someone_else", status: "delivered" })];

    const res = await request(makeApp()).get("/admin/bin-orders?status=delivered");

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].status).toBe("delivered");
    expect(res.body[0].displayStatus).toBe("active");
  });

  it("rejects an unknown ?status= filter (400)", async () => {
    const res = await request(makeApp()).get("/admin/bin-orders?status=shipped");

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Invalid status");
  });

  it("is gated by requireAuth (401 when unauthenticated)", async () => {
    h.userId = null;

    const res = await request(makeApp()).get("/admin/bin-orders");

    expect(res.status).toBe(401);
  });

  it("is gated by requireAdmin (403 for a non-staff user)", async () => {
    // Allowlist that excludes the caller disables the dev-superadmin fallback,
    // and the staff-role lookup misses, so the request is rejected.
    process.env.ADMIN_USER_IDS = "someone-else";
    h.rows = [];

    try {
      const res = await request(makeApp()).get("/admin/bin-orders");

      expect(res.status).toBe(403);
    } finally {
      delete process.env.ADMIN_USER_IDS;
    }
  });

  it.each(["accounting", "cfo"])(
    "requires the bins permission: finance role %s (no bins) is denied (403)",
    async (role) => {
      // Allowlist excludes the caller, so gating is driven by the profile's role.
      // Accounting and CFO are finance-only — neither holds operational bins.
      process.env.ADMIN_USER_IDS = "someone-else";
      h.profileRows = [{ id: 42, clerkId: USER_ID, staffRole: role }];
      h.rows = [];

      try {
        const res = await request(makeApp()).get("/admin/bin-orders");
        expect(res.status).toBe(403);
      } finally {
        delete process.env.ADMIN_USER_IDS;
      }
    },
  );

  it("allows roles that hold the bins permission (CEO)", async () => {
    process.env.ADMIN_USER_IDS = "someone-else";
    h.profileRows = [{ id: 42, clerkId: USER_ID, staffRole: "ceo" }];
    h.rows = [baseOrder({ id: "bin_a", customerId: "user_1" })];

    try {
      const res = await request(makeApp()).get("/admin/bin-orders");
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
    } finally {
      delete process.env.ADMIN_USER_IDS;
    }
  });
});

describe("POST /bin-orders", () => {
  it("persists a new order for the authenticated user and returns the enriched shape", async () => {
    const res = await request(makeApp())
      .post("/bin-orders")
      .send(validOrderBody({ quantity: 2, notes: "leave by the gate" }));

    expect(res.status).toBe(201);

    // The order is persisted against the authenticated customer with sane defaults.
    expect(h.inserts).toHaveLength(1);
    const inserted = h.inserts[0];
    expect(inserted.customerId).toBe(USER_ID);
    expect(inserted.serviceType).toBe("temporary");
    expect(inserted.binSize).toBe("10_yard");
    expect(inserted.quantity).toBe(2);
    expect(inserted.status).toBe("pending");
    expect(inserted.preferredProvider).toBe("any");
    expect(inserted.deliveryDate).toBeInstanceOf(Date);
    // Estimate is server-derived from the catalog (33000/unit) × quantity.
    expect(inserted.estimatedCostCents).toBe(66000);

    // The response carries the display fields the mobile Bins tab renders.
    expect(res.body).toMatchObject({
      binSizeLabel: "10-Yard",
      binTypeLabel: "Roll-Off",
      priceRange: "$280–380",
      priceUnit: "week",
      estimatedCost: "$280–380/wk",
      displayStatus: "pending",
    });
  });

  it("defaults quantity to 1 when omitted", async () => {
    const res = await request(makeApp()).post("/bin-orders").send(validOrderBody());

    expect(res.status).toBe(201);
    expect(h.inserts[0].quantity).toBe(1);
    expect(h.inserts[0].estimatedCostCents).toBe(33000);
  });

  it("enriches a permanent order with a monthly price suffix", async () => {
    const res = await request(makeApp())
      .post("/bin-orders")
      .send(
        validOrderBody({ serviceType: "permanent", binSize: "4_yard", binType: "front_load" }),
      );

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      binSizeLabel: "4-Yard",
      binTypeLabel: "Front-Load",
      priceRange: "$160–240",
      priceUnit: "mo",
      estimatedCost: "$160–240/mo",
    });
  });

  it("falls back to a prettified label and the stored estimate for an unknown bin size", async () => {
    const res = await request(makeApp())
      .post("/bin-orders")
      .send(validOrderBody({ binSize: "99_yard", binType: "mystery_box" }));

    expect(res.status).toBe(201);
    // No catalog match → default 35000 cents estimate is stored…
    expect(h.inserts[0].estimatedCostCents).toBe(35000);
    // …and the response prettifies the raw codes with a null priceRange.
    expect(res.body).toMatchObject({
      binSizeLabel: "99 Yard",
      binTypeLabel: "Mystery Box",
      priceRange: null,
      priceUnit: null,
      estimatedCost: "$350/wk",
    });
  });

  it("rejects a request that is missing required fields (400)", async () => {
    const { binType, ...withoutBinType } = validOrderBody();

    const res = await request(makeApp()).post("/bin-orders").send(withoutBinType);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Missing required fields");
    expect(h.inserts).toHaveLength(0);
  });

  it("rejects an invalid serviceType (400)", async () => {
    const res = await request(makeApp())
      .post("/bin-orders")
      .send(validOrderBody({ serviceType: "annual" }));

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Invalid serviceType");
    expect(h.inserts).toHaveLength(0);
  });

  it("is gated by requireAuth (401 when unauthenticated)", async () => {
    h.userId = null;

    const res = await request(makeApp()).post("/bin-orders").send(validOrderBody());

    expect(res.status).toBe(401);
    expect(h.inserts).toHaveLength(0);
  });
});

describe("PATCH /bin-orders/:id/cancel", () => {
  it("transitions a pending order to cancelled and returns the enriched shape", async () => {
    h.rows = [baseOrder()];
    h.updateBase = baseOrder();

    const res = await request(makeApp()).patch("/bin-orders/bin_existing/cancel");

    expect(res.status).toBe(200);
    expect(h.updates).toHaveLength(1);
    expect(h.updates[0].status).toBe("cancelled");
    expect(h.updates[0].updatedAt).toBeInstanceOf(Date);
    expect(res.body.status).toBe("cancelled");
    expect(res.body.displayStatus).toBe("cancelled");
  });

  it("notifies the customer in-app, linking back to the cancelled order", async () => {
    h.rows = [baseOrder()];
    h.updateBase = baseOrder({ status: "cancelled" });

    await request(makeApp()).patch("/bin-orders/bin_existing/cancel");

    expect(h.inserts).toHaveLength(1);
    const activity = h.inserts[0];
    expect(activity.profileId).toBe(42);
    expect(activity.type).toBe("bin_cancelled");
    expect(activity.relatedId).toBe(null);
    expect(activity.relatedBinOrderId).toBe("bin_existing");
    expect(activity.description).toContain("cancelled");
  });

  it("returns 404 when the order does not exist", async () => {
    h.rows = [];

    const res = await request(makeApp()).patch("/bin-orders/missing/cancel");

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Order not found");
    expect(h.updates).toHaveLength(0);
  });

  it("returns 404 when the order belongs to another customer", async () => {
    h.rows = [baseOrder({ customerId: "someone_else" })];

    const res = await request(makeApp()).patch("/bin-orders/bin_existing/cancel");

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Order not found");
    expect(h.updates).toHaveLength(0);
  });

  it("refuses to cancel a delivered order (400)", async () => {
    h.rows = [baseOrder({ status: "delivered" })];

    const res = await request(makeApp()).patch("/bin-orders/bin_existing/cancel");

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Cannot cancel a delivered order");
    expect(h.updates).toHaveLength(0);
  });

  it("is gated by requireAuth (401 when unauthenticated)", async () => {
    h.userId = null;

    const res = await request(makeApp()).patch("/bin-orders/bin_existing/cancel");

    expect(res.status).toBe(401);
    expect(h.updates).toHaveLength(0);
  });
});

describe("PATCH /bin-orders/:id", () => {
  it("reschedules the delivery date of a pending order", async () => {
    h.rows = [baseOrder()];
    h.updateBase = baseOrder();

    const res = await request(makeApp())
      .patch("/bin-orders/bin_existing")
      .send({ deliveryDate: "2026-08-15" });

    expect(res.status).toBe(200);
    expect(h.updates).toHaveLength(1);
    expect(h.updates[0].deliveryDate).toBeInstanceOf(Date);
    expect((h.updates[0].deliveryDate as Date).toISOString()).toContain("2026-08-15");
    expect(h.updates[0].updatedAt).toBeInstanceOf(Date);
  });

  it("updates waste type and address together", async () => {
    h.rows = [baseOrder()];
    h.updateBase = baseOrder();

    const res = await request(makeApp())
      .patch("/bin-orders/bin_existing")
      .send({ wasteType: "Scrap Metal", deliveryAddress: "2 New Ave" });

    expect(res.status).toBe(200);
    expect(h.updates[0].wasteType).toBe("Scrap Metal");
    expect(h.updates[0].deliveryAddress).toBe("2 New Ave");
  });

  it("404s when the order belongs to another customer", async () => {
    h.rows = [baseOrder({ customerId: "someone_else" })];

    const res = await request(makeApp())
      .patch("/bin-orders/bin_existing")
      .send({ deliveryDate: "2026-08-15" });

    expect(res.status).toBe(404);
    expect(h.updates).toHaveLength(0);
  });

  it("404s when the order does not exist", async () => {
    h.rows = [];

    const res = await request(makeApp())
      .patch("/bin-orders/bin_existing")
      .send({ deliveryDate: "2026-08-15" });

    expect(res.status).toBe(404);
  });

  it.each(["delivered", "picked_up", "cancelled"])(
    "rejects editing a %s order",
    async (status) => {
      h.rows = [baseOrder({ status })];

      const res = await request(makeApp())
        .patch("/bin-orders/bin_existing")
        .send({ deliveryDate: "2026-08-15" });

      expect(res.status).toBe(400);
      expect(h.updates).toHaveLength(0);
    }
  );

  it("rejects an invalid delivery date", async () => {
    h.rows = [baseOrder()];

    const res = await request(makeApp())
      .patch("/bin-orders/bin_existing")
      .send({ deliveryDate: "not-a-date" });

    expect(res.status).toBe(400);
    expect(h.updates).toHaveLength(0);
  });

  it("rejects a blank waste type", async () => {
    h.rows = [baseOrder()];

    const res = await request(makeApp())
      .patch("/bin-orders/bin_existing")
      .send({ wasteType: "   " });

    expect(res.status).toBe(400);
    expect(h.updates).toHaveLength(0);
  });

  it("rejects when no editable fields are provided", async () => {
    h.rows = [baseOrder()];

    const res = await request(makeApp())
      .patch("/bin-orders/bin_existing")
      .send({});

    expect(res.status).toBe(400);
    expect(h.updates).toHaveLength(0);
  });

  it("is gated by requireAuth (401 when unauthenticated)", async () => {
    h.userId = null;

    const res = await request(makeApp())
      .patch("/bin-orders/bin_existing")
      .send({ deliveryDate: "2026-08-15" });

    expect(res.status).toBe(401);
    expect(h.updates).toHaveLength(0);
  });
});

describe("PATCH /bin-orders/:id/status", () => {
  it("advances a pending order to confirmed, returns the enriched shape, and notifies the customer", async () => {
    h.rows = [baseOrder({ status: "pending" })];
    h.updateBase = baseOrder({ status: "pending" });

    const res = await request(makeApp())
      .patch("/bin-orders/bin_existing/status")
      .send({ status: "confirmed" });

    expect(res.status).toBe(200);
    expect(h.updates).toHaveLength(1);
    expect(h.updates[0].status).toBe("confirmed");
    expect(h.updates[0].updatedAt).toBeInstanceOf(Date);
    expect(res.body.status).toBe("confirmed");
    expect(res.body.displayStatus).toBe("confirmed");

    // The customer is notified against their numeric profile id (resolved from
    // the order's Clerk customer id), mirroring the application-review pattern.
    // relatedBinOrderId links the entry back to the order.
    expect(h.inserts).toHaveLength(1);
    expect(h.inserts[0]).toMatchObject({
      profileId: 42,
      type: "bin_confirmed",
      relatedId: null,
      relatedBinOrderId: "bin_existing",
    });
    expect(h.inserts[0].description).toContain("10-Yard");
  });

  it("advances a confirmed order to delivered (displayStatus → active) and notifies the customer", async () => {
    h.rows = [baseOrder({ status: "confirmed" })];
    h.updateBase = baseOrder({ status: "confirmed" });

    const res = await request(makeApp())
      .patch("/bin-orders/bin_existing/status")
      .send({ status: "delivered" });

    expect(res.status).toBe(200);
    expect(h.updates[0].status).toBe("delivered");
    expect(h.updates[0].pickupDate).toBeUndefined();
    expect(res.body.displayStatus).toBe("active");

    expect(h.inserts).toHaveLength(1);
    expect(h.inserts[0]).toMatchObject({
      profileId: 42,
      type: "bin_delivered",
      relatedBinOrderId: "bin_existing",
    });
    expect(h.inserts[0].description).toContain("delivered");
  });

  it("advances a delivered order to picked_up, stamps the pickup date (displayStatus → completed), and notifies the customer", async () => {
    h.rows = [baseOrder({ status: "delivered", pickupDate: null })];
    h.updateBase = baseOrder({ status: "delivered", pickupDate: null });

    const res = await request(makeApp())
      .patch("/bin-orders/bin_existing/status")
      .send({ status: "picked_up" });

    expect(res.status).toBe(200);
    expect(h.updates[0].status).toBe("picked_up");
    expect(h.updates[0].pickupDate).toBeInstanceOf(Date);
    expect(res.body.displayStatus).toBe("completed");

    expect(h.inserts).toHaveLength(1);
    expect(h.inserts[0]).toMatchObject({
      profileId: 42,
      type: "bin_picked_up",
      relatedBinOrderId: "bin_existing",
    });
    expect(h.inserts[0].description).toContain("picked up");
  });

  it("does not notify the customer when the status move is rejected", async () => {
    h.rows = [baseOrder({ status: "pending" })];

    const res = await request(makeApp())
      .patch("/bin-orders/bin_existing/status")
      .send({ status: "delivered" });

    expect(res.status).toBe(400);
    expect(h.updates).toHaveLength(0);
    expect(h.inserts).toHaveLength(0);
  });

  it("still advances the order when the customer profile can't be found (best-effort notify)", async () => {
    h.rows = [baseOrder({ status: "pending" })];
    h.updateBase = baseOrder({ status: "pending" });
    h.profileRows = [];

    const res = await request(makeApp())
      .patch("/bin-orders/bin_existing/status")
      .send({ status: "confirmed" });

    expect(res.status).toBe(200);
    expect(h.updates[0].status).toBe("confirmed");
    // No profile → no notification, but the status update itself succeeds.
    expect(h.inserts).toHaveLength(0);
  });

  it("does not overwrite an existing pickup date when picking up", async () => {
    const existingPickup = new Date("2026-06-10T00:00:00Z");
    h.rows = [baseOrder({ status: "delivered", pickupDate: existingPickup })];
    h.updateBase = baseOrder({ status: "delivered" });

    const res = await request(makeApp())
      .patch("/bin-orders/bin_existing/status")
      .send({ status: "picked_up" });

    expect(res.status).toBe(200);
    expect(h.updates[0].pickupDate).toBeUndefined();
  });

  it("rejects an unknown target status (400) without updating or notifying", async () => {
    h.rows = [baseOrder({ status: "pending" })];

    const res = await request(makeApp())
      .patch("/bin-orders/bin_existing/status")
      .send({ status: "shipped" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Invalid status");
    expect(h.updates).toHaveLength(0);
    expect(h.activityInserts).toHaveLength(0);
  });

  it("rejects advancing to 'cancelled' via this endpoint (400)", async () => {
    h.rows = [baseOrder({ status: "pending" })];

    const res = await request(makeApp())
      .patch("/bin-orders/bin_existing/status")
      .send({ status: "cancelled" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Invalid status");
    expect(h.updates).toHaveLength(0);
    expect(h.activityInserts).toHaveLength(0);
  });

  it("rejects a non-adjacent jump (pending → delivered) (400)", async () => {
    h.rows = [baseOrder({ status: "pending" })];

    const res = await request(makeApp())
      .patch("/bin-orders/bin_existing/status")
      .send({ status: "delivered" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Cannot move a pending order to delivered");
    expect(h.updates).toHaveLength(0);
    expect(h.activityInserts).toHaveLength(0);
  });

  it("refuses to advance a cancelled order (400)", async () => {
    h.rows = [baseOrder({ status: "cancelled" })];

    const res = await request(makeApp())
      .patch("/bin-orders/bin_existing/status")
      .send({ status: "confirmed" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Cannot move a cancelled order to confirmed");
    expect(h.updates).toHaveLength(0);
    expect(h.activityInserts).toHaveLength(0);
  });

  it("refuses to advance a picked_up order (terminal) (400)", async () => {
    h.rows = [baseOrder({ status: "picked_up" })];

    const res = await request(makeApp())
      .patch("/bin-orders/bin_existing/status")
      .send({ status: "confirmed" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Cannot move a picked_up order to confirmed");
    expect(h.updates).toHaveLength(0);
    expect(h.activityInserts).toHaveLength(0);
  });

  it("returns 404 when the order does not exist", async () => {
    h.rows = [];

    const res = await request(makeApp())
      .patch("/bin-orders/missing/status")
      .send({ status: "confirmed" });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Order not found");
    expect(h.updates).toHaveLength(0);
    expect(h.activityInserts).toHaveLength(0);
  });

  it("is gated by requireAuth (401 when unauthenticated)", async () => {
    h.userId = null;

    const res = await request(makeApp())
      .patch("/bin-orders/bin_existing/status")
      .send({ status: "confirmed" });

    expect(res.status).toBe(401);
    expect(h.updates).toHaveLength(0);
    expect(h.activityInserts).toHaveLength(0);
  });

  it("is gated by requireAdmin (403 for a non-staff user)", async () => {
    // Configure an allowlist that excludes the authenticated user, so the
    // dev-superadmin fallback no longer applies and the staff lookup misses.
    process.env.ADMIN_USER_IDS = "someone-else";
    h.rows = [];

    try {
      const res = await request(makeApp())
        .patch("/bin-orders/bin_existing/status")
        .send({ status: "confirmed" });

      expect(res.status).toBe(403);
      expect(h.updates).toHaveLength(0);
      expect(h.activityInserts).toHaveLength(0);
    } finally {
      delete process.env.ADMIN_USER_IDS;
    }
  });

  it.each(["accounting", "cfo"])(
    "requires the bins permission: finance role %s cannot advance status (403)",
    async (role) => {
      process.env.ADMIN_USER_IDS = "someone-else";
      h.profileRows = [{ id: 42, clerkId: USER_ID, staffRole: role }];

      try {
        const res = await request(makeApp())
          .patch("/bin-orders/bin_existing/status")
          .send({ status: "confirmed" });

        expect(res.status).toBe(403);
        expect(h.updates).toHaveLength(0);
        expect(h.activityInserts).toHaveLength(0);
      } finally {
        delete process.env.ADMIN_USER_IDS;
      }
    },
  );

  it("allows a role with the bins permission (CTO) to advance status", async () => {
    process.env.ADMIN_USER_IDS = "someone-else";
    h.profileRows = [{ id: 42, clerkId: USER_ID, staffRole: "cto" }];
    h.rows = [baseOrder({ id: "bin_existing", status: "pending" })];

    try {
      const res = await request(makeApp())
        .patch("/bin-orders/bin_existing/status")
        .send({ status: "confirmed" });

      expect(res.status).toBe(200);
      expect(h.updates[0]).toMatchObject({ status: "confirmed" });
    } finally {
      delete process.env.ADMIN_USER_IDS;
    }
  });
});
