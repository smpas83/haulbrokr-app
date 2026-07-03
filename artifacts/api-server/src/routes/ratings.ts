import { Router, type IRouter, type Request, type Response } from "express";
import { eq, and } from "drizzle-orm";
import {
  db,
  ratingsTable,
  reviewModerationHistoryTable,
  reviewAggregatesTable,
  ticketsTable,
  type Rating,
  type Job,
  type Profile,
} from "@workspace/db";
import { getRequestProfile, requireProfile } from "../middlewares/requireAuth";
import { isAdmin } from "../middlewares/requireAdmin";
import { loadJobIfMember, CUSTOMER_SIDE, isDriverAssignedToJob } from "../lib/access";
import { z } from "zod/v4";

const router: IRouter = Router();

const ReviewTypeSchema = z.enum(["customer_to_driver", "driver_to_customer", "vendor_to_customer"]);
const ModerationActionSchema = z.enum(["approved", "rejected", "hidden"]);

const CreateReviewBody = z.object({
  reviewType: ReviewTypeSchema.optional(),
  revieweeProfileId: z.number().int().positive().optional(),
  stars: z.number().int().min(1).max(5),
  comment: z.string().max(1000).optional().nullable(),
});

const ModerateReviewBody = z.object({
  action: ModerationActionSchema,
  reason: z.string().trim().max(1000).optional().nullable(),
});

function sanitizeComment(value: string | null | undefined): string | null {
  if (value == null) return null;
  const sanitized = value
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return sanitized.length > 0 ? sanitized : null;
}

function serializeReview(review: Rating) {
  return {
    ...review,
    reviewType: review.reviewType,
    moderationStatus: review.moderationStatus,
  };
}

function visibleReviews(rows: Rating[]): Rating[] {
  return rows.filter((row) => row.moderationStatus === "approved");
}

async function assignedDriverIds(jobId: number): Promise<number[]> {
  const tickets = await db.select().from(ticketsTable).where(eq(ticketsTable.jobId, jobId));
  return [...new Set(tickets.map((ticket) => ticket.driverProfileId))];
}

async function resolveReviewTarget(
  job: Job,
  profile: Profile,
  requestedType: z.infer<typeof ReviewTypeSchema> | undefined,
  requestedRevieweeId: number | undefined,
): Promise<{ reviewType: z.infer<typeof ReviewTypeSchema>; rateeProfileId: number } | { error: string; status: number }> {
  if (CUSTOMER_SIDE.has(profile.role)) {
    const reviewType = requestedType ?? "customer_to_driver";
    if (reviewType !== "customer_to_driver") {
      return { status: 403, error: "Customers can only review assigned drivers for this job." };
    }
    const drivers = await assignedDriverIds(job.id);
    const rateeProfileId = requestedRevieweeId ?? (drivers.length === 1 ? drivers[0] : undefined);
    if (!rateeProfileId || !drivers.includes(rateeProfileId)) {
      return { status: 400, error: "Select an assigned driver to review." };
    }
    return { reviewType, rateeProfileId };
  }

  if (profile.role === "driver") {
    const reviewType = requestedType ?? "driver_to_customer";
    if (reviewType !== "driver_to_customer") {
      return { status: 403, error: "Drivers can only review the customer for their assigned trip." };
    }
    if (!(await isDriverAssignedToJob(job.id, profile.id))) {
      return { status: 403, error: "Drivers can only review customers for assigned completed jobs." };
    }
    return { reviewType, rateeProfileId: job.customerId };
  }

  if (profile.role === "provider") {
    const reviewType = requestedType ?? "vendor_to_customer";
    if (reviewType !== "vendor_to_customer") {
      return { status: 403, error: "Vendors can only review the customer for this job." };
    }
    return { reviewType, rateeProfileId: job.customerId };
  }

  return { status: 403, error: "You aren't allowed to review this job." };
}

async function recomputeAggregate(profileId: number, reviewType: z.infer<typeof ReviewTypeSchema>, updatedReview?: Rating): Promise<void> {
  const rows = await db.select().from(ratingsTable).where(eq(ratingsTable.rateeProfileId, profileId));
  const effectiveRows = updatedReview
    ? rows.map((row) => row.id === updatedReview.id ? updatedReview : row)
    : rows;
  const approved = effectiveRows.filter((row) => row.reviewType === reviewType && row.moderationStatus === "approved");
  const reviewCount = approved.length;
  const averageStars = reviewCount === 0
    ? "0"
    : (approved.reduce((sum, row) => sum + row.stars, 0) / reviewCount).toFixed(2);

  const [existing] = await db
    .select()
    .from(reviewAggregatesTable)
    .where(and(eq(reviewAggregatesTable.profileId, profileId), eq(reviewAggregatesTable.reviewType, reviewType)));

  const values = { profileId, reviewType, averageStars, reviewCount };
  if (existing) {
    await db.update(reviewAggregatesTable).set(values).where(eq(reviewAggregatesTable.id, existing.id));
  } else {
    await db.insert(reviewAggregatesTable).values(values);
  }
}

async function ratingSummary(profileId: number, reviewType?: z.infer<typeof ReviewTypeSchema>) {
  const rows = await db.select().from(ratingsTable).where(eq(ratingsTable.rateeProfileId, profileId));
  const approved = visibleReviews(rows).filter((row) => !reviewType || row.reviewType === reviewType);
  const count = approved.length;
  return {
    profileId,
    reviewType: reviewType ?? null,
    averageStars: count === 0 ? 0 : Math.round((approved.reduce((sum, row) => sum + row.stars, 0) / count) * 100) / 100,
    reviewCount: count,
    starsBreakdown: [1, 2, 3, 4, 5].reduce<Record<string, number>>((acc, stars) => {
      acc[String(stars)] = approved.filter((row) => row.stars === stars).length;
      return acc;
    }, {}),
  };
}

async function getJobReviews(req: Request, res: Response): Promise<void> {
  const profile = getRequestProfile(req);
  const jobId = parseInt(String(req.params.id), 10);
  if (!Number.isFinite(jobId)) { res.status(400).json({ error: "Invalid job id" }); return; }
  const job = await loadJobIfMember(jobId, profile);
  if (!job) { res.status(404).json({ error: "Job not found" }); return; }

  const rows = await db.select().from(ratingsTable).where(eq(ratingsTable.jobId, jobId));
  const mine = rows.find((r) => r.raterProfileId === profile.id) ?? null;
  const theirs = visibleReviews(rows).find((r) => r.rateeProfileId === profile.id) ?? null;

  res.json({ mine: mine ? serializeReview(mine) : null, theirs: theirs ? serializeReview(theirs) : null, reviews: visibleReviews(rows).map(serializeReview) });
}

async function createJobReview(req: Request, res: Response): Promise<void> {
  const profile = getRequestProfile(req);
  const jobId = parseInt(String(req.params.id), 10);
  if (!Number.isFinite(jobId)) { res.status(400).json({ error: "Invalid job id" }); return; }

  const parsed = CreateReviewBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const job = await loadJobIfMember(jobId, profile);
  if (!job) { res.status(404).json({ error: "Job not found" }); return; }
  if (job.status !== "completed") {
    res.status(409).json({ error: "You can only rate a job after it is completed." });
    return;
  }

  const target = await resolveReviewTarget(job, profile, parsed.data.reviewType, parsed.data.revieweeProfileId);
  if ("error" in target) {
    res.status(target.status).json({ error: target.error });
    return;
  }
  if (target.rateeProfileId === profile.id) {
    res.status(400).json({ error: "Self-reviews are not allowed." });
    return;
  }

  const existingRows = await db.select().from(ratingsTable).where(eq(ratingsTable.jobId, jobId));
  const duplicate = existingRows.find((row) =>
    row.raterProfileId === profile.id &&
    row.rateeProfileId === target.rateeProfileId &&
    row.reviewType === target.reviewType);
  if (duplicate) {
    res.status(409).json({ error: "You have already reviewed this person for this job." });
    return;
  }

  const comment = sanitizeComment(parsed.data.comment);

  const [rating] = await db
    .insert(ratingsTable)
    .values({
      jobId,
      raterProfileId: profile.id,
      rateeProfileId: target.rateeProfileId,
      reviewType: target.reviewType,
      stars: parsed.data.stars,
      comment,
      moderationStatus: "pending",
    })
    .returning();

  await db.insert(reviewModerationHistoryTable).values({
    reviewId: rating.id,
    action: "created",
    actorProfileId: profile.id,
    previousStatus: null,
    nextStatus: "pending",
    reason: null,
  });

  res.status(201).json(serializeReview(rating));
}

router.get("/jobs/:id/rating", requireProfile, getJobReviews);
router.get("/jobs/:id/reviews", requireProfile, getJobReviews);
router.post("/jobs/:id/rating", requireProfile, createJobReview);
router.post("/jobs/:id/reviews", requireProfile, createJobReview);

router.get("/ratings/drivers/:profileId/summary", requireProfile, async (req, res): Promise<void> => {
  const profileId = parseInt(String(req.params.profileId), 10);
  if (!Number.isFinite(profileId)) { res.status(400).json({ error: "Invalid profile id" }); return; }
  res.json(await ratingSummary(profileId, "customer_to_driver"));
});

router.get("/ratings/customers/:profileId/summary", requireProfile, async (req, res): Promise<void> => {
  const profileId = parseInt(String(req.params.profileId), 10);
  if (!Number.isFinite(profileId)) { res.status(400).json({ error: "Invalid profile id" }); return; }
  res.json(await ratingSummary(profileId));
});

router.get("/ratings/vendors/:profileId/summary", requireProfile, async (req, res): Promise<void> => {
  const profileId = parseInt(String(req.params.profileId), 10);
  if (!Number.isFinite(profileId)) { res.status(400).json({ error: "Invalid profile id" }); return; }
  res.json(await ratingSummary(profileId, "vendor_to_customer"));
});

router.get("/admin/reviews/pending", requireProfile, async (req, res): Promise<void> => {
  if (!(await isAdmin(req))) {
    res.status(403).json({ error: "Admin access required." });
    return;
  }
  const rows = await db.select().from(ratingsTable).where(eq(ratingsTable.moderationStatus, "pending"));
  res.json({ reviews: rows.map(serializeReview) });
});

router.patch("/admin/reviews/:id/moderate", requireProfile, async (req, res): Promise<void> => {
  const profile = getRequestProfile(req);
  if (!(await isAdmin(req))) {
    res.status(403).json({ error: "Admin access required." });
    return;
  }
  const reviewId = parseInt(String(req.params.id), 10);
  if (!Number.isFinite(reviewId)) { res.status(400).json({ error: "Invalid review id" }); return; }
  const parsed = ModerateReviewBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [existing] = await db.select().from(ratingsTable).where(eq(ratingsTable.id, reviewId));
  if (!existing) { res.status(404).json({ error: "Review not found" }); return; }

  const nextStatus = parsed.data.action;
  const reason = sanitizeComment(parsed.data.reason);
  const [updated] = await db.update(ratingsTable)
    .set({
      moderationStatus: nextStatus,
      moderationReason: reason,
      moderatedByProfileId: profile.id,
      moderatedAt: new Date(),
    })
    .where(eq(ratingsTable.id, reviewId))
    .returning();

  await db.insert(reviewModerationHistoryTable).values({
    reviewId,
    action: nextStatus,
    actorProfileId: profile.id,
    previousStatus: existing.moderationStatus,
    nextStatus,
    reason,
  });
  await recomputeAggregate(existing.rateeProfileId, existing.reviewType, { ...existing, ...updated, id: existing.id });

  res.json(serializeReview(updated));
});

export default router;
