import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, ratingsTable, reviewFlagsTable, reviewHistoryTable, reviewStatsTable } from "@workspace/db";
import { getRequestProfile, requireProfile } from "../middlewares/requireAuth";
import { loadJobIfMember, CUSTOMER_SIDE, DRIVER_SIDE } from "../lib/access";
import { requireStaffOrProfile, attachStaffSession } from "../middlewares/staffAuth";
import { attachClerkProfileIfPresent } from "../middlewares/requireAuth";
import { requirePermission } from "../middlewares/requireAdmin";
import {
  CreateJobRatingBody,
  CreateJobRatingResponse,
  GetJobRatingResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.use(attachStaffSession);
router.use(attachClerkProfileIfPresent);

async function refreshReviewStats(profileId: number) {
  const reviews = await db
    .select()
    .from(reviewHistoryTable)
    .where(eq(reviewHistoryTable.rateeProfileId, profileId));
  const visible = reviews.filter((review) => review.moderationStatus === "visible");
  const flagged = reviews.filter((review) => review.moderationStatus === "flagged");
  const average = visible.length
    ? visible.reduce((sum, review) => sum + review.stars, 0) / visible.length
    : 0;
  const values = {
    averageRating: average.toFixed(2),
    reviewCount: visible.length,
    completedJobs: new Set(visible.map((review) => review.jobId)).size,
    responseRate: "0.00",
    cancellationRate: "0.00",
    repeatCustomerPercentage: "0.00",
    flaggedReviewCount: flagged.length,
    lastCalculatedAt: new Date(),
  };
  const [existing] = await db.select().from(reviewStatsTable).where(eq(reviewStatsTable.profileId, profileId));
  if (existing) {
    await db.update(reviewStatsTable).set(values).where(eq(reviewStatsTable.id, existing.id));
    return { ...existing, ...values };
  }
  const result = db.insert(reviewStatsTable).values({ profileId, ...values });
  if (result && typeof result === "object" && "returning" in result && typeof (result as any).returning === "function") {
    const [created] = await (result as { returning: () => Promise<any[]> }).returning();
    return created;
  }
  await result;
  return { id: 0, profileId, ...values };
}

router.get("/jobs/:id/rating", requireProfile, async (req, res): Promise<void> => {
  const profile = getRequestProfile(req);
  const jobId = parseInt(String(req.params.id), 10);
  if (!Number.isFinite(jobId)) { res.status(400).json({ error: "Invalid job id" }); return; }
  const job = await loadJobIfMember(jobId, profile);
  if (!job) { res.status(404).json({ error: "Job not found" }); return; }

  const rows = await db.select().from(ratingsTable).where(eq(ratingsTable.jobId, jobId));
  const mine = rows.find((r) => r.raterProfileId === profile.id) ?? null;
  const theirs = rows.find((r) => r.rateeProfileId === profile.id) ?? null;

  res.json(GetJobRatingResponse.parse({ mine, theirs }));
});

router.post("/jobs/:id/rating", requireProfile, async (req, res): Promise<void> => {
  const profile = getRequestProfile(req);
  const jobId = parseInt(String(req.params.id), 10);
  if (!Number.isFinite(jobId)) { res.status(400).json({ error: "Invalid job id" }); return; }

  const parsed = CreateJobRatingBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const job = await loadJobIfMember(jobId, profile);
  if (!job) { res.status(404).json({ error: "Job not found" }); return; }
  if (job.status !== "completed") {
    res.status(409).json({ error: "You can only rate a job after it is completed." });
    return;
  }

  // The ratee is the counterparty: customer-side rates the provider, and
  // provider-side rates the customer.
  let rateeProfileId: number;
  if (CUSTOMER_SIDE.has(profile.role)) {
    rateeProfileId = job.providerId;
  } else if (DRIVER_SIDE.has(profile.role)) {
    rateeProfileId = job.customerId;
  } else {
    res.status(403).json({ error: "You aren't on this job." });
    return;
  }

  const [rating] = await db
    .insert(ratingsTable)
    .values({
      jobId,
      raterProfileId: profile.id,
      rateeProfileId,
      stars: parsed.data.stars,
      comment: parsed.data.comment ?? null,
    })
    .onConflictDoUpdate({
      target: [ratingsTable.jobId, ratingsTable.raterProfileId],
      set: {
        stars: parsed.data.stars,
        comment: parsed.data.comment ?? null,
        rateeProfileId,
      },
    })
    .returning();

  const reviewValues = {
    jobId,
    ratingId: rating.id,
    raterProfileId: profile.id,
    rateeProfileId,
    subjectType: "profile",
    stars: parsed.data.stars,
    comment: parsed.data.comment ?? null,
    moderationStatus: "visible" as const,
  };
  const reviewInsert = db.insert(reviewHistoryTable).values(reviewValues);
  if (reviewInsert && typeof reviewInsert === "object" && "returning" in reviewInsert && typeof (reviewInsert as any).returning === "function") {
    await (reviewInsert as { returning: () => Promise<any[]> }).returning();
  } else {
    await reviewInsert;
  }
  await refreshReviewStats(rateeProfileId);

  res.json(CreateJobRatingResponse.parse(rating));
});

router.get("/profiles/:id/review-stats", requireProfile, async (req, res): Promise<void> => {
  const profileId = parseInt(String(req.params.id), 10);
  if (!Number.isFinite(profileId)) { res.status(400).json({ error: "Invalid profile id" }); return; }
  const [stats] = await db.select().from(reviewStatsTable).where(eq(reviewStatsTable.profileId, profileId));
  if (!stats) {
    res.json(await refreshReviewStats(profileId));
    return;
  }
  res.json({
    ...stats,
    averageRating: Number(stats.averageRating),
    responseRate: Number(stats.responseRate),
    cancellationRate: Number(stats.cancellationRate),
    repeatCustomerPercentage: Number(stats.repeatCustomerPercentage),
  });
});

router.post("/reviews/:id/flags", requireProfile, async (req, res): Promise<void> => {
  const profile = getRequestProfile(req);
  const reviewId = parseInt(String(req.params.id), 10);
  const reason = String(req.body?.reason ?? "").trim();
  if (!Number.isFinite(reviewId)) { res.status(400).json({ error: "Invalid review id" }); return; }
  if (!reason) { res.status(400).json({ error: "Flag reason is required." }); return; }
  const [review] = await db.select().from(reviewHistoryTable).where(eq(reviewHistoryTable.id, reviewId));
  if (!review) { res.status(404).json({ error: "Review not found" }); return; }
  const [flag] = await db.insert(reviewFlagsTable).values({
    reviewHistoryId: reviewId,
    flaggedByProfileId: profile.id,
    reason,
    status: "open",
  }).returning();
  await db.update(reviewHistoryTable).set({ moderationStatus: "flagged" }).where(eq(reviewHistoryTable.id, reviewId));
  await refreshReviewStats(review.rateeProfileId);
  res.status(201).json(flag);
});

router.patch("/admin/reviews/:id/moderation", requireStaffOrProfile, requirePermission("compliance"), async (req, res): Promise<void> => {
  const reviewId = parseInt(String(req.params.id), 10);
  const status = String(req.body?.status ?? "");
  if (!Number.isFinite(reviewId)) { res.status(400).json({ error: "Invalid review id" }); return; }
  if (!["visible", "flagged", "removed"].includes(status)) { res.status(400).json({ error: "Invalid moderation status." }); return; }
  const [review] = await db.select().from(reviewHistoryTable).where(eq(reviewHistoryTable.id, reviewId));
  if (!review) { res.status(404).json({ error: "Review not found" }); return; }
  const [updated] = await db.update(reviewHistoryTable).set({
    moderationStatus: status as "visible" | "flagged" | "removed",
    removedByProfileId: status === "removed" ? req.profile?.id ?? null : null,
    removedReason: status === "removed" ? String(req.body?.reason ?? "Removed by admin") : null,
  }).where(eq(reviewHistoryTable.id, reviewId)).returning();
  await refreshReviewStats(review.rateeProfileId);
  res.json(updated);
});

export default router;
