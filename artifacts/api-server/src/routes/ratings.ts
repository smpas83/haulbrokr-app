import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, ratingsTable } from "@workspace/db";
import { getRequestProfile, requireProfile } from "../middlewares/requireAuth";
import { loadJobIfMember, CUSTOMER_SIDE, DRIVER_SIDE } from "../lib/access";
import {
  CreateJobRatingBody,
  CreateJobRatingResponse,
  GetJobRatingResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get(
  "/jobs/:id/rating",
  requireProfile,
  async (req, res): Promise<void> => {
    const profile = getRequestProfile(req);
    const jobId = parseInt(String(req.params.id), 10);
    if (!Number.isFinite(jobId)) {
      res.status(400).json({ error: "Invalid job id" });
      return;
    }
    const job = await loadJobIfMember(jobId, profile);
    if (!job) {
      res.status(404).json({ error: "Job not found" });
      return;
    }

    const rows = await db
      .select()
      .from(ratingsTable)
      .where(eq(ratingsTable.jobId, jobId));
    const mine = rows.find((r) => r.raterProfileId === profile.id) ?? null;
    const theirs = rows.find((r) => r.rateeProfileId === profile.id) ?? null;

    res.json(GetJobRatingResponse.parse({ mine, theirs }));
  },
);

router.post(
  "/jobs/:id/rating",
  requireProfile,
  async (req, res): Promise<void> => {
    const profile = getRequestProfile(req);
    const jobId = parseInt(String(req.params.id), 10);
    if (!Number.isFinite(jobId)) {
      res.status(400).json({ error: "Invalid job id" });
      return;
    }

    const parsed = CreateJobRatingBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const job = await loadJobIfMember(jobId, profile);
    if (!job) {
      res.status(404).json({ error: "Job not found" });
      return;
    }
    if (job.status !== "completed") {
      res
        .status(409)
        .json({ error: "You can only rate a job after it is completed." });
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

    res.json(CreateJobRatingResponse.parse(rating));
  },
);

export default router;
