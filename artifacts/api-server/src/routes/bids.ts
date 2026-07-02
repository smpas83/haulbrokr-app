import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, bidsTable, requestsTable, profilesTable, jobsTable, activityTable } from "@workspace/db";
import { getRequestProfile, requireProfile } from "../middlewares/requireAuth";
import { getCarrierComplianceSnapshot } from "../lib/adminComplianceBundle";
import { describeCanBidBlockers } from "../lib/providerCompliance";
import { recordJobTimelineEvent } from "../lib/jobTimeline";
import {
  ListBidsParams,
  ListBidsResponse,
  CreateBidParams,
  CreateBidBody,
  GetBidParams,
  GetBidResponse,
  UpdateBidParams,
  UpdateBidBody,
  UpdateBidResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/requests/:requestId/bids", requireProfile, async (req, res): Promise<void> => {
  const profile = getRequestProfile(req);
  const rawId = Array.isArray(req.params.requestId) ? req.params.requestId[0] : req.params.requestId;
  const params = ListBidsParams.safeParse({ requestId: parseInt(rawId, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  // Authorization: load the parent request first so we can verify caller access.
  const [request] = await db.select().from(requestsTable).where(eq(requestsTable.id, params.data.requestId));
  if (!request) {
    res.status(404).json({ error: "Request not found" });
    return;
  }

  // Customer owners and same-org supervisors may see all bids on the request.
  // Provider/driver side may only see their own bid(s).
  let customerSideAllowed = profile.role === "customer" && request.customerId === profile.id;
  if (!customerSideAllowed && (profile.role === "customer" || profile.role === "supervisor") && profile.organizationId) {
    const [customerProfile] = await db.select().from(profilesTable).where(eq(profilesTable.id, request.customerId));
    customerSideAllowed = customerProfile?.organizationId === profile.organizationId;
  }

  const isProviderSide = profile.role === "provider" || profile.role === "driver";

  if (!customerSideAllowed && !isProviderSide) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  // Customers on the request see all bids; providers see only their own bid.
  let bids;
  if (customerSideAllowed) {
    bids = await db.select().from(bidsTable).where(eq(bidsTable.requestId, params.data.requestId));
  } else {
    bids = await db.select().from(bidsTable).where(and(eq(bidsTable.requestId, params.data.requestId), eq(bidsTable.providerId, profile.id)));
  }

  const enriched = await Promise.all(bids.map(async (b) => {
    const [provider] = await db.select().from(profilesTable).where(eq(profilesTable.id, b.providerId));
    return {
      ...b,
      ratePerHour: parseFloat(b.ratePerHour),
      estimatedHours: b.estimatedHours ? parseFloat(b.estimatedHours) : null,
      providerCompany: provider?.companyName ?? "",
    };
  }));
  res.json(ListBidsResponse.parse(enriched));
});

router.post("/requests/:requestId/bids", requireProfile, async (req, res): Promise<void> => {
  const profile = getRequestProfile(req);
  if (profile.role !== "provider") {
    res.status(403).json({ error: "Only providers can place bids" });
    return;
  }
  const rawId = Array.isArray(req.params.requestId) ? req.params.requestId[0] : req.params.requestId;
  const pathParams = CreateBidParams.safeParse({ requestId: parseInt(rawId, 10) });
  if (!pathParams.success) {
    res.status(400).json({ error: pathParams.error.message });
    return;
  }
  const parsed = CreateBidBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [request] = await db.select().from(requestsTable).where(eq(requestsTable.id, pathParams.data.requestId));
  if (!request) {
    res.status(404).json({ error: "Request not found" });
    return;
  }

  const compliance = await getCarrierComplianceSnapshot(profile.id);
  if (!compliance?.canBid) {
    const blockers = describeCanBidBlockers({
      role: profile.role,
      w9Status: compliance?.w9Status ?? "not_submitted",
      insuranceStatus: compliance?.insuranceStatus ?? "not_submitted",
      dotCdlStatus: compliance?.dotCdlStatus ?? "not_submitted",
      payoutStatus: compliance?.payoutStatus ?? "not_submitted",
    });
    res.status(403).json({
      error: `Cannot place a bid until compliance and payout requirements are met: ${blockers.join("; ")}.`,
    });
    return;
  }

  const [bid] = await db.insert(bidsTable).values({
    ...parsed.data,
    requestId: pathParams.data.requestId,
    providerId: profile.id,
    ratePerHour: String(parsed.data.ratePerHour),
    estimatedHours: parsed.data.estimatedHours != null ? String(parsed.data.estimatedHours) : undefined,
  }).returning();

  await db.update(requestsTable).set({ status: "bid_received" }).where(eq(requestsTable.id, pathParams.data.requestId));

  await db.insert(activityTable).values({
    profileId: profile.id,
    type: "bid_placed",
    description: `Placed a bid at $${bid.ratePerHour}/hr on request #${bid.requestId}`,
    relatedId: bid.id,
  });

  res.status(201).json({
    ...bid,
    ratePerHour: parseFloat(bid.ratePerHour),
    estimatedHours: bid.estimatedHours ? parseFloat(bid.estimatedHours) : null,
    providerCompany: profile.companyName,
  });
});

router.get("/bids/:id", requireProfile, async (req, res): Promise<void> => {
  const profile = getRequestProfile(req);
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetBidParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [bid] = await db.select().from(bidsTable).where(eq(bidsTable.id, params.data.id));
  if (!bid) {
    res.status(404).json({ error: "Bid not found" });
    return;
  }

  // Authorization: the provider who placed the bid, or the customer who owns the request.
  const isOwnBid = bid.providerId === profile.id;
  let allowed = isOwnBid;
  if (!allowed) {
    const [request] = await db.select().from(requestsTable).where(eq(requestsTable.id, bid.requestId));
    if (request) {
      if (request.customerId === profile.id) {
        allowed = true;
      } else if ((profile.role === "customer" || profile.role === "supervisor") && profile.organizationId) {
        const [customerProfile] = await db.select().from(profilesTable).where(eq(profilesTable.id, request.customerId));
        allowed = customerProfile?.organizationId === profile.organizationId;
      }
    }
  }
  if (!allowed) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  const [provider] = await db.select().from(profilesTable).where(eq(profilesTable.id, bid.providerId));
  res.json(GetBidResponse.parse({
    ...bid,
    ratePerHour: parseFloat(bid.ratePerHour),
    estimatedHours: bid.estimatedHours ? parseFloat(bid.estimatedHours) : null,
    providerCompany: provider?.companyName ?? "",
  }));
});

router.patch("/bids/:id", requireProfile, async (req, res): Promise<void> => {
  const profile = getRequestProfile(req);
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = UpdateBidParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateBidBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [existingBid] = await db.select().from(bidsTable).where(eq(bidsTable.id, params.data.id));
  if (!existingBid) {
    res.status(404).json({ error: "Bid not found" });
    return;
  }

  // Authorization: only the customer who owns the request may accept/reject bids.
  // A provider may only withdraw their own bid.
  const [request] = await db.select().from(requestsTable).where(eq(requestsTable.id, existingBid.requestId));
  if (!request) {
    res.status(404).json({ error: "Request not found" });
    return;
  }

  const isProviderBidOwner = existingBid.providerId === profile.id;
  let isCustomerRequestOwner = request.customerId === profile.id;
  if (!isCustomerRequestOwner && (profile.role === "customer" || profile.role === "supervisor") && profile.organizationId) {
    const [customerProfile] = await db.select().from(profilesTable).where(eq(profilesTable.id, request.customerId));
    isCustomerRequestOwner = customerProfile?.organizationId === profile.organizationId;
  }

  if (parsed.data.status === "accepted" || parsed.data.status === "rejected") {
    if (!isCustomerRequestOwner) {
      res.status(403).json({ error: "Only the request owner can accept or reject bids" });
      return;
    }
  } else if (parsed.data.status === "withdrawn") {
    if (!isProviderBidOwner) {
      res.status(403).json({ error: "Only the bid owner can withdraw a bid" });
      return;
    }
  } else {
    if (!isCustomerRequestOwner && !isProviderBidOwner) {
      res.status(403).json({ error: "Access denied" });
      return;
    }
  }

  if (parsed.data.status === "accepted") {
    if (!["open", "bid_received", "bidding"].includes(request.status)) {
      res.status(400).json({ error: "Request is not open for awarding" });
      return;
    }
    if (existingBid.status !== "pending") {
      res.status(400).json({ error: "Bid is not pending" });
      return;
    }

    const [provider] = await db.select().from(profilesTable).where(eq(profilesTable.id, existingBid.providerId));

    const [createdJob] = await db.insert(jobsTable).values({
      requestId: request.id,
      bidId: existingBid.id,
      customerId: request.customerId,
      providerId: existingBid.providerId,
      ratePerHour: existingBid.ratePerHour,
      trucksAssigned: existingBid.trucksOffered,
      status: "awarded",
      materialType: request.materialType,
      truckType: request.truckType,
      pickupAddress: request.pickupAddress,
      deliveryAddress: request.deliveryAddress,
      scheduledDate: request.scheduledDate,
      startTime: request.startTime,
      estimatedHours: request.estimatedHours,
      brokerMarginType: request.brokerMarginType,
      brokerMarginValue: request.brokerMarginValue,
      platformFeeRate: request.brokerMarginType === "percentage" ? request.brokerMarginValue : "0",
      pricingRules: request.pricingRules,
      notes: request.notes,
    }).returning();
    if (createdJob) {
      await recordJobTimelineEvent(createdJob.id, profile.id, "job_created", { note: "Job created from accepted bid" });
    }

    await db.update(requestsTable).set({ status: "awarded" }).where(eq(requestsTable.id, request.id));
    await db
      .update(bidsTable)
      .set({ status: "rejected" })
      .where(and(eq(bidsTable.requestId, request.id), eq(bidsTable.status, "pending")));
    const [bid] = await db
      .update(bidsTable)
      .set({ status: "awarded" })
      .where(eq(bidsTable.id, existingBid.id))
      .returning();

    if (provider) {
      await db.insert(activityTable).values({
        profileId: profile.id,
        type: "bid_awarded",
        description: `Awarded job to ${provider.companyName} at $${existingBid.ratePerHour}/hr — awaiting hauler acceptance`,
        relatedId: existingBid.id,
      });
      await db.insert(activityTable).values({
        profileId: existingBid.providerId,
        type: "bid_awarded",
        description: `You were awarded a job at $${existingBid.ratePerHour}/hr — accept or decline to proceed`,
        relatedId: existingBid.id,
      });
    }

    const [providerAfter] = await db.select().from(profilesTable).where(eq(profilesTable.id, bid!.providerId));
    res.json(UpdateBidResponse.parse({
      ...bid!,
      ratePerHour: parseFloat(bid!.ratePerHour),
      estimatedHours: bid!.estimatedHours ? parseFloat(bid!.estimatedHours) : null,
      providerCompany: providerAfter?.companyName ?? "",
    }));
    return;
  }

  const [bid] = await db
    .update(bidsTable)
    .set(parsed.data)
    .where(eq(bidsTable.id, params.data.id))
    .returning();

  if (!bid) {
    res.status(404).json({ error: "Bid not found" });
    return;
  }

  const [provider] = await db.select().from(profilesTable).where(eq(profilesTable.id, bid.providerId));
  res.json(UpdateBidResponse.parse({
    ...bid,
    ratePerHour: parseFloat(bid.ratePerHour),
    estimatedHours: bid.estimatedHours ? parseFloat(bid.estimatedHours) : null,
    providerCompany: provider?.companyName ?? "",
  }));
});

export default router;
