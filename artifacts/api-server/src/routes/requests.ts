import { Router, type IRouter } from "express";
import { eq, and, or, sql } from "drizzle-orm";
import { db, requestsTable, profilesTable, bidsTable, activityTable, dumpSitesTable } from "@workspace/db";
import { getRequestProfile, requireProfile } from "../middlewares/requireAuth";
import {
  ListRequestsQueryParams,
  ListRequestsResponse,
  CreateRequestBody,
  GetRequestParams,
  GetRequestResponse,
  UpdateRequestParams,
  UpdateRequestBody,
  UpdateRequestResponse,
  DeleteRequestParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

function serializeRequest(
  r: typeof requestsTable.$inferSelect,
  customerCompany: string,
  bidCount: number,
) {
  return {
    ...r,
    quantityTons: parseFloat(r.quantityTons),
    estimatedHours: parseFloat(r.estimatedHours),
    budgetPerHour: r.budgetPerHour ? parseFloat(r.budgetPerHour) : null,
    customerCompany,
    bidCount,
  };
}

router.get("/requests", requireProfile, async (req, res): Promise<void> => {
  const profile = getRequestProfile(req);
  const params = ListRequestsQueryParams.safeParse(req.query);

  let rows: typeof requestsTable.$inferSelect[] = [];

  if (params.success && params.data.mine) {
    rows = await db.select().from(requestsTable).where(eq(requestsTable.customerId, profile.id)).orderBy(sql`${requestsTable.createdAt} desc`);
  } else if (profile.role === "customer") {
    const conditions = [];
    if (params.success && params.data.status) {
      conditions.push(eq(requestsTable.status, params.data.status as any));
    }
    conditions.push(eq(requestsTable.customerId, profile.id));
    rows = await db.select().from(requestsTable).where(and(...conditions)).orderBy(sql`${requestsTable.createdAt} desc`);
  } else {
    const conditions = [];
    if (params.success && params.data.status) {
      conditions.push(eq(requestsTable.status, params.data.status as any));
    } else {
      conditions.push(or(
        eq(requestsTable.status, "open"),
        eq(requestsTable.status, "bid_received"),
        eq(requestsTable.status, "bidding"),
      )!);
    }
    rows = await db.select().from(requestsTable).where(and(...conditions)).orderBy(sql`${requestsTable.createdAt} desc`);
  }

  const enriched = await Promise.all(rows.map(async (r) => {
    const [customer] = await db.select().from(profilesTable).where(eq(profilesTable.id, r.customerId));
    const bidCountResult = await db.select({ count: sql<number>`count(*)` }).from(bidsTable).where(eq(bidsTable.requestId, r.id));
    return serializeRequest(r, customer?.companyName ?? "", Number(bidCountResult[0]?.count ?? 0));
  }));

  res.json(ListRequestsResponse.parse(enriched));
});

router.post("/requests", requireProfile, async (req, res): Promise<void> => {
  const profile = getRequestProfile(req);
  if (profile.role !== "customer") {
    res.status(403).json({ error: "Only customers can post requests" });
    return;
  }
  const parsed = CreateRequestBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const selectedFacility = parsed.data.facilityId != null
    ? (await db.select().from(dumpSitesTable).where(eq(dumpSitesTable.id, parsed.data.facilityId)))[0]
    : null;
  if (parsed.data.facilityId != null && !selectedFacility) {
    res.status(400).json({ error: "Selected facility does not exist." });
    return;
  }
  if (selectedFacility && !selectedFacility.isActive) {
    res.status(409).json({ error: "Selected facility is closed or inactive." });
    return;
  }
  const [request] = await db.insert(requestsTable).values({
    ...parsed.data,
    customerId: profile.id,
    quantityTons: String(parsed.data.quantityTons),
    estimatedHours: String(parsed.data.estimatedHours),
    budgetPerHour: parsed.data.budgetPerHour != null ? String(parsed.data.budgetPerHour) : undefined,
    facilityName: parsed.data.facilityName ?? selectedFacility?.name,
    facilityPhone: parsed.data.facilityPhone ?? selectedFacility?.phone ?? undefined,
  }).returning();
  await db.insert(activityTable).values({
    profileId: profile.id,
    type: "request_posted",
    description: `Posted a request for ${request.materialType} — ${request.pickupAddress}`,
    relatedId: request.id,
  });
  res.status(201).json(serializeRequest(request, profile.companyName, 0));
});

router.get("/requests/:id", requireProfile, async (req, res): Promise<void> => {
  const profile = getRequestProfile(req);
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetRequestParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [request] = await db.select().from(requestsTable).where(eq(requestsTable.id, params.data.id));
  if (!request) {
    res.status(404).json({ error: "Request not found" });
    return;
  }

  // Authorization: customers see only their own requests (or org-mates'); providers
  // see open/bidding requests or ones they have a bid on; all others are denied.
  const isCustomerSide = profile.role === "customer" || profile.role === "supervisor";
  const isProviderSide = profile.role === "provider" || profile.role === "driver";
  const isStaff = !!profile.staffRole;

  if (isStaff) {
    // Staff may view any request for support and admin review.
  } else if (isCustomerSide) {
    let allowed = request.customerId === profile.id;
    if (!allowed && profile.organizationId) {
      const [customerProfile] = await db.select().from(profilesTable).where(eq(profilesTable.id, request.customerId));
      allowed = customerProfile?.organizationId === profile.organizationId;
    }
    if (!allowed) {
      res.status(403).json({ error: "Access denied" });
      return;
    }
  } else if (isProviderSide) {
    const isOpenForBidding = request.status === "open" || request.status === "bidding";
    let allowed = isOpenForBidding;
    if (!allowed) {
      const [ownBid] = await db.select().from(bidsTable).where(
        and(eq(bidsTable.requestId, request.id), eq(bidsTable.providerId, profile.id))
      );
      allowed = !!ownBid;
    }
    if (!allowed) {
      res.status(403).json({ error: "Access denied" });
      return;
    }
  } else {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  const [customer] = await db.select().from(profilesTable).where(eq(profilesTable.id, request.customerId));
  const bidCountResult = await db.select({ count: sql<number>`count(*)` }).from(bidsTable).where(eq(bidsTable.requestId, request.id));
  res.json(GetRequestResponse.parse(serializeRequest(
    request,
    customer?.companyName ?? "",
    Number(bidCountResult[0]?.count ?? 0),
  )));
});

router.patch("/requests/:id", requireProfile, async (req, res): Promise<void> => {
  const profile = getRequestProfile(req);
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = UpdateRequestParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (req.body && typeof req.body === "object" && "status" in req.body) {
    res.status(400).json({ error: "Request status is managed by the award, job, and completion workflow." });
    return;
  }
  const parsed = UpdateRequestBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const selectedFacility = parsed.data.facilityId != null
    ? (await db.select().from(dumpSitesTable).where(eq(dumpSitesTable.id, parsed.data.facilityId)))[0]
    : null;
  if (parsed.data.facilityId != null && !selectedFacility) {
    res.status(400).json({ error: "Selected facility does not exist." });
    return;
  }
  if (selectedFacility && !selectedFacility.isActive) {
    res.status(409).json({ error: "Selected facility is closed or inactive." });
    return;
  }
  const [request] = await db
    .update(requestsTable)
    .set({
      ...parsed.data,
      quantityTons: parsed.data.quantityTons != null ? String(parsed.data.quantityTons) : undefined,
      estimatedHours: parsed.data.estimatedHours != null ? String(parsed.data.estimatedHours) : undefined,
      budgetPerHour: parsed.data.budgetPerHour != null ? String(parsed.data.budgetPerHour) : undefined,
      facilityName: parsed.data.facilityName ?? selectedFacility?.name,
      facilityPhone: parsed.data.facilityPhone ?? selectedFacility?.phone ?? undefined,
    })
    .where(and(eq(requestsTable.id, params.data.id), eq(requestsTable.customerId, profile.id)))
    .returning();
  if (!request) {
    res.status(404).json({ error: "Request not found" });
    return;
  }
  const bidCountResult = await db.select({ count: sql<number>`count(*)` }).from(bidsTable).where(eq(bidsTable.requestId, request.id));
  res.json(UpdateRequestResponse.parse(serializeRequest(
    request,
    profile.companyName,
    Number(bidCountResult[0]?.count ?? 0),
  )));
});

router.delete("/requests/:id", requireProfile, async (req, res): Promise<void> => {
  const profile = getRequestProfile(req);
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = DeleteRequestParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [request] = await db
    .delete(requestsTable)
    .where(and(eq(requestsTable.id, params.data.id), eq(requestsTable.customerId, profile.id)))
    .returning();
  if (!request) {
    res.status(404).json({ error: "Request not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
