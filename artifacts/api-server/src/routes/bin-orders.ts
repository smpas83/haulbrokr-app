import { Router } from "express";
import { requireAuth } from "../middlewares/requireAuth";
import { requirePermission } from "../middlewares/requireAdmin";
import { db } from "@workspace/db";
import { binOrders, profilesTable, activityTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
import { logger } from "../lib/logger";

const router = Router();

// ── Bin catalog (server-side source of truth for sizes / pricing) ───────────
// Each entry carries both the API enum codes (serviceType / binSize / binType)
// used when persisting an order and the display fields the mobile UI renders.
export type BinCatalogItem = {
  id: string;
  serviceType: "temporary" | "permanent";
  binSize: string; // API code, also the BIN_ESTIMATES key
  binType: string; // API code
  size: string; // display label
  type: string; // display label
  description: string;
  priceRange: string;
  priceUnit: string; // "week" | "mo"
  bestFor: string;
  estimateCents: number; // per-unit estimate stored on an order
};

export const BIN_CATALOG: BinCatalogItem[] = [
  // Temporary roll-offs (weekly)
  { id: "temporary_10_yard", serviceType: "temporary", binSize: "10_yard", binType: "roll_off", size: "10-Yard", type: "Roll-Off", description: "10 cubic yards", priceRange: "$280–380", priceUnit: "week", bestFor: "Small cleanouts, bathroom remodels, deck removal", estimateCents: 33000 },
  { id: "temporary_20_yard", serviceType: "temporary", binSize: "20_yard", binType: "roll_off", size: "20-Yard", type: "Roll-Off", description: "20 cubic yards", priceRange: "$350–480", priceUnit: "week", bestFor: "Medium renovations, roofing, landscaping projects", estimateCents: 41500 },
  { id: "temporary_30_yard", serviceType: "temporary", binSize: "30_yard", binType: "roll_off", size: "30-Yard", type: "Roll-Off", description: "30 cubic yards", priceRange: "$420–570", priceUnit: "week", bestFor: "Large construction, home additions, commercial cleanouts", estimateCents: 49500 },
  { id: "temporary_40_yard", serviceType: "temporary", binSize: "40_yard", binType: "roll_off", size: "40-Yard", type: "Roll-Off", description: "40 cubic yards", priceRange: "$490–650", priceUnit: "week", bestFor: "Major demolitions, new construction, large commercial jobs", estimateCents: 57000 },
  // Permanent service (monthly)
  { id: "permanent_2_yard", serviceType: "permanent", binSize: "2_yard", binType: "front_load", size: "2-Yard", type: "Front-Load", description: "2 cubic yards", priceRange: "$120–180", priceUnit: "mo", bestFor: "Small businesses, restaurants, offices", estimateCents: 15000 },
  { id: "permanent_4_yard", serviceType: "permanent", binSize: "4_yard", binType: "front_load", size: "4-Yard", type: "Front-Load", description: "4 cubic yards", priceRange: "$160–240", priceUnit: "mo", bestFor: "Mid-size retail, apartment buildings", estimateCents: 20000 },
  { id: "permanent_6_yard", serviceType: "permanent", binSize: "6_yard", binType: "front_load", size: "6-Yard", type: "Front-Load", description: "6 cubic yards", priceRange: "$200–300", priceUnit: "mo", bestFor: "Large retail, multi-tenant buildings", estimateCents: 25000 },
  { id: "permanent_8_yard", serviceType: "permanent", binSize: "8_yard", binType: "front_load", size: "8-Yard", type: "Front-Load", description: "8 cubic yards", priceRange: "$250–360", priceUnit: "mo", bestFor: "High-volume commercial, grocery stores", estimateCents: 30500 },
  { id: "permanent_10_yard_perm", serviceType: "permanent", binSize: "10_yard_perm", binType: "open_top", size: "10-Yard", type: "Open-Top", description: "10 cubic yards", priceRange: "$310–450", priceUnit: "mo", bestFor: "Light industrial, warehouses", estimateCents: 38000 },
  { id: "permanent_20_yard_perm", serviceType: "permanent", binSize: "20_yard_perm", binType: "open_top", size: "20-Yard", type: "Open-Top", description: "20 cubic yards", priceRange: "$380–540", priceUnit: "mo", bestFor: "Manufacturing, distribution centers", estimateCents: 46000 },
  { id: "permanent_30_yard_perm", serviceType: "permanent", binSize: "30_yard_perm", binType: "open_top", size: "30-Yard", type: "Open-Top", description: "30 cubic yards", priceRange: "$460–640", priceUnit: "mo", bestFor: "Large industrial, construction companies", estimateCents: 55000 },
  { id: "permanent_40_yard_perm", serviceType: "permanent", binSize: "40_yard_perm", binType: "compactor", size: "40-Yard", type: "Compactor", description: "Compactor unit", priceRange: "$580–800", priceUnit: "mo", bestFor: "High-volume waste, large commercial operations", estimateCents: 69000 },
];

function findCatalogItem(serviceType: string, binSize: string): BinCatalogItem | undefined {
  return BIN_CATALOG.find((b) => b.serviceType === serviceType && b.binSize === binSize);
}

function estimateCost(serviceType: string, binSize: string, quantity: number): number {
  const base = findCatalogItem(serviceType, binSize)?.estimateCents ?? 35000;
  return base * quantity;
}

function prettifyCode(code: string): string {
  return code
    .replace(/_perm$/, "")
    .split("_")
    .map((p) => (p ? p[0].toUpperCase() + p.slice(1) : p))
    .join(" ");
}

// Map persisted lifecycle statuses to the badge vocabulary the mobile UI knows.
const STATUS_DISPLAY: Record<string, string> = {
  pending: "pending",
  confirmed: "confirmed",
  delivered: "active",
  picked_up: "completed",
  cancelled: "cancelled",
};

function enrichOrder(order: typeof binOrders.$inferSelect) {
  const item = findCatalogItem(order.serviceType, order.binSize);
  const unitSuffix = order.serviceType === "temporary" ? "/wk" : "/mo";
  const estimatedCost = item
    ? `${item.priceRange}${unitSuffix}`
    : `$${Math.round((order.estimatedCostCents ?? 0) / 100)}${unitSuffix}`;
  return {
    ...order,
    binSizeLabel: item?.size ?? prettifyCode(order.binSize),
    binTypeLabel: item?.type ?? prettifyCode(order.binType),
    priceRange: item?.priceRange ?? null,
    priceUnit: item?.priceUnit ?? null,
    estimatedCost,
    displayStatus: STATUS_DISPLAY[order.status] ?? order.status,
  };
}

// GET /bins — bin catalog (optionally filtered by ?serviceType=)
router.get("/bins", requireAuth, async (req, res) => {
  const serviceType = req.query.serviceType as string | undefined;
  const catalog = serviceType
    ? BIN_CATALOG.filter((b) => b.serviceType === serviceType)
    : BIN_CATALOG;
  res.json(catalog);
});

// GET /bin-orders — list user's bin orders
router.get("/bin-orders", requireAuth, async (req, res) => {
  const userId = req.clerkId as string;
  const orders = await db
    .select()
    .from(binOrders)
    .where(eq(binOrders.customerId, userId))
    .orderBy(desc(binOrders.createdAt));
  res.json(orders.map(enrichOrder));
});

// GET /bin-orders/:id — fetch a single bin order (owner-scoped). Backs the
// dedicated detail page that bin status notifications deep-link to. Returns the
// same enriched shape as the list endpoint. 404s for a missing order OR one that
// belongs to another customer, so ownership never leaks via a probe.
router.get("/bin-orders/:id", requireAuth, async (req, res) => {
  const userId = req.clerkId as string;
  const id = req.params.id as string;

  const [order] = await db.select().from(binOrders).where(eq(binOrders.id, id));

  if (!order || order.customerId !== userId) {
    res.status(404).json({ error: "Order not found" });
    return;
  }

  res.json(enrichOrder(order));
});

// The full set of persisted lifecycle statuses an admin may filter the queue by.
const BIN_ORDER_STATUSES = [
  "pending",
  "confirmed",
  "delivered",
  "picked_up",
  "cancelled",
] as const;

// GET /admin/bin-orders — list every customer's bin orders (optionally filtered
// by ?status=). Gated by the "bins" permission (CEO/CFO/CTO/IT — not Accounting):
// operations staff use this to work the fulfillment queue and see which orders
// need confirming, delivering, or picking up. Returns the same enriched shape as
// GET /bin-orders.
router.get("/admin/bin-orders", requireAuth, requirePermission("bins"), async (req, res) => {
  const status = req.query.status as string | undefined;

  if (status !== undefined && !BIN_ORDER_STATUSES.includes(status as any)) {
    res.status(400).json({ error: "Invalid status" });
    return;
  }

  const orders = await db
    .select()
    .from(binOrders)
    .where(status ? eq(binOrders.status, status) : undefined)
    .orderBy(desc(binOrders.createdAt));
  res.json(orders.map(enrichOrder));
});

// POST /bin-orders — create a new bin order
router.post("/bin-orders", requireAuth, async (req, res) => {
  const userId = req.clerkId as string;
  const body = req.body;

  const { serviceType, binSize, binType, deliveryAddress, deliveryDate, wasteType } = body;

  if (!serviceType || !binSize || !binType || !deliveryAddress || !deliveryDate || !wasteType) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  if (!["temporary", "permanent"].includes(serviceType)) {
    res.status(400).json({ error: "Invalid serviceType" });
    return;
  }

  const quantity = Number(body.quantity) || 1;

  const [order] = await db.insert(binOrders).values({
    customerId: userId,
    serviceType,
    binSize,
    binType,
    quantity,
    deliveryAddress,
    deliveryLat: body.deliveryLat ?? null,
    deliveryLng: body.deliveryLng ?? null,
    deliveryDate: new Date(deliveryDate),
    pickupDate: body.pickupDate ? new Date(body.pickupDate) : null,
    wasteType,
    preferredProvider: body.preferredProvider ?? "any",
    status: "pending",
    estimatedCostCents: estimateCost(serviceType, binSize, quantity),
    notes: body.notes ?? null,
  }).returning();

  res.status(201).json(enrichOrder(order));
});

// PATCH /bin-orders/:id — reschedule / edit a pending order
// Customers can change the delivery date, waste type, or delivery address of an
// order that hasn't been delivered or closed out yet.
router.patch("/bin-orders/:id", requireAuth, async (req, res) => {
  const userId = req.clerkId as string;
  const id = req.params.id as string;
  const body = req.body ?? {};

  const [existing] = await db.select().from(binOrders).where(eq(binOrders.id, id));

  if (!existing || existing.customerId !== userId) {
    res.status(404).json({ error: "Order not found" });
    return;
  }
  if (["delivered", "picked_up", "cancelled"].includes(existing.status)) {
    res.status(400).json({ error: "Cannot edit an order that's already been delivered or closed" });
    return;
  }

  const updates: Partial<typeof binOrders.$inferInsert> = {};

  if (body.deliveryDate !== undefined) {
    const parsed = new Date(body.deliveryDate);
    if (isNaN(parsed.getTime())) {
      res.status(400).json({ error: "Invalid deliveryDate" });
      return;
    }
    updates.deliveryDate = parsed;
  }

  if (body.wasteType !== undefined) {
    if (typeof body.wasteType !== "string" || !body.wasteType.trim()) {
      res.status(400).json({ error: "Invalid wasteType" });
      return;
    }
    updates.wasteType = body.wasteType;
  }

  if (body.deliveryAddress !== undefined) {
    if (typeof body.deliveryAddress !== "string" || !body.deliveryAddress.trim()) {
      res.status(400).json({ error: "Invalid deliveryAddress" });
      return;
    }
    updates.deliveryAddress = body.deliveryAddress;
  }

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "No editable fields provided" });
    return;
  }

  updates.updatedAt = new Date();

  const [updated] = await db
    .update(binOrders)
    .set(updates)
    .where(eq(binOrders.id, id))
    .returning();

  res.json(enrichOrder(updated));
});

// PATCH /bin-orders/:id/cancel
router.patch("/bin-orders/:id/cancel", requireAuth, async (req, res) => {
  const userId = req.clerkId as string;
  const id = req.params.id as string;

  const [existing] = await db.select().from(binOrders).where(eq(binOrders.id, id));

  if (!existing || existing.customerId !== userId) {
    res.status(404).json({ error: "Order not found" });
    return;
  }
  if (existing.status === "delivered") {
    res.status(400).json({ error: "Cannot cancel a delivered order" });
    return;
  }

  const [updated] = await db
    .update(binOrders)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(eq(binOrders.id, id))
    .returning();

  // Tell the customer their order was cancelled. Best-effort; never blocks.
  const enriched = enrichOrder(updated);
  await notifyBinOrderStatusChanged(updated, "cancelled", enriched.binSizeLabel);

  res.json(enriched);
});

// Valid forward moves through the fulfillment lifecycle. Each status maps to the
// statuses an admin/staff member may advance it to. `cancelled` and `picked_up`
// are terminal (no outgoing moves), so any attempt to advance them is rejected.
const ADVANCE_TRANSITIONS: Record<string, string[]> = {
  pending: ["confirmed"],
  confirmed: ["delivered"],
  delivered: ["picked_up"],
};

// Customer-facing copy + activity type for each lifecycle milestone a bin order
// can reach. confirmed/delivered/picked_up are admin-driven advances; cancelled
// is customer-driven via the cancel endpoint. Mirrors the carrier/credit
// application review pattern in admin.ts (notifyApplicationReviewed).
const BIN_STATUS_NOTIFICATIONS: Record<
  "confirmed" | "delivered" | "picked_up" | "cancelled",
  {
    type: "bin_confirmed" | "bin_delivered" | "bin_picked_up" | "bin_cancelled";
    describe: (bin: string) => string;
  }
> = {
  confirmed: {
    type: "bin_confirmed",
    describe: (bin) => `Your ${bin} bin order is confirmed — we're scheduling delivery.`,
  },
  delivered: {
    type: "bin_delivered",
    describe: (bin) => `Your ${bin} bin has been delivered and is ready to use.`,
  },
  picked_up: {
    type: "bin_picked_up",
    describe: (bin) => `Your ${bin} bin has been picked up. Thanks for using HaulBrokr!`,
  },
  cancelled: {
    type: "bin_cancelled",
    describe: (bin) => `Your ${bin} bin order has been cancelled.`,
  },
};

/**
 * Records an in-app notification telling the customer their bin order changed
 * status (confirmed / delivered / picked_up / cancelled). The activity table
 * keys off the numeric profile id, so we resolve the order's customer (a Clerk
 * id) to their profile first. relatedBinOrderId links the entry back to the
 * order — the bin_orders PK is a uuid, which can't live in the integer relatedId
 * column. Best-effort: a notification failure must never make the status update
 * appear to fail, so we swallow errors.
 */
async function notifyBinOrderStatusChanged(
  order: typeof binOrders.$inferSelect,
  status: "confirmed" | "delivered" | "picked_up" | "cancelled",
  binLabel: string,
): Promise<void> {
  try {
    const [profile] = await db
      .select()
      .from(profilesTable)
      .where(eq(profilesTable.clerkId, order.customerId));
    if (!profile) return;

    const notification = BIN_STATUS_NOTIFICATIONS[status];
    await db.insert(activityTable).values({
      profileId: profile.id,
      type: notification.type,
      description: notification.describe(binLabel),
      relatedId: null,
      relatedBinOrderId: order.id,
    });
  } catch (err) {
    logger.error({ err, orderId: order.id, status }, "Failed to record bin order status notification");
  }
}

// PATCH /bin-orders/:id/status — advance an order through its fulfillment
// lifecycle (pending → confirmed → delivered → picked_up). Gated by the "bins"
// permission (CEO/CFO/CTO/IT — not Accounting): bin orders aren't tied to a
// provider, so HaulBrokr operations staff move them forward as the bin is dropped
// off and hauled away. Customers use the cancel endpoint above. Each successful
// transition notifies the customer in-app.
router.patch("/bin-orders/:id/status", requireAuth, requirePermission("bins"), async (req, res) => {
  const id = req.params.id as string;
  const status = req.body?.status;

  if (!status || !["confirmed", "delivered", "picked_up"].includes(status)) {
    res.status(400).json({ error: "Invalid status" });
    return;
  }

  const [existing] = await db.select().from(binOrders).where(eq(binOrders.id, id));

  if (!existing) {
    res.status(404).json({ error: "Order not found" });
    return;
  }

  const allowed = ADVANCE_TRANSITIONS[existing.status] ?? [];
  if (!allowed.includes(status)) {
    res.status(400).json({
      error: `Cannot move a ${existing.status} order to ${status}`,
    });
    return;
  }

  const now = new Date();
  const changes: Partial<typeof binOrders.$inferInsert> = {
    status,
    updatedAt: now,
  };
  // Record when the bin actually came back so the pickup date reflects reality.
  if (status === "picked_up" && !existing.pickupDate) {
    changes.pickupDate = now;
  }

  const [updated] = await db
    .update(binOrders)
    .set(changes)
    .where(eq(binOrders.id, id))
    .returning();

  // Tell the customer their bin advanced. Best-effort; never blocks the response.
  const enriched = enrichOrder(updated);
  await notifyBinOrderStatusChanged(
    updated,
    status as "confirmed" | "delivered" | "picked_up",
    enriched.binSizeLabel,
  );

  res.json(enriched);
});

export default router;
