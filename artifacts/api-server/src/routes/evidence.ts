import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, deliveryEvidenceTable } from "@workspace/db";
import { getRequestProfile, requireProfile } from "../middlewares/requireAuth";
import { loadJobIfMember, DRIVER_SIDE, isDriverAssignedToJob } from "../lib/access";
import { recordJobTimelineEvent } from "../lib/jobTimeline";

const router: IRouter = Router();

router.get("/jobs/:jobId/evidence", requireProfile, async (req, res): Promise<void> => {
  const profile = getRequestProfile(req);
  const jobId = parseInt(req.params.jobId as string, 10);
  if (!Number.isFinite(jobId)) { res.status(400).json({ error: "Invalid job id" }); return; }

  const job = await loadJobIfMember(jobId, profile);
  if (!job) { res.status(404).json({ error: "Job not found" }); return; }

  const evidence = await db.select().from(deliveryEvidenceTable)
    .where(eq(deliveryEvidenceTable.jobId, jobId));
  res.json(evidence);
});

router.post("/jobs/:jobId/evidence", requireProfile, async (req, res): Promise<void> => {
  const profile = getRequestProfile(req);
  const jobId = parseInt(req.params.jobId as string, 10);
  if (!Number.isFinite(jobId)) { res.status(400).json({ error: "Invalid job id" }); return; }
  if (!DRIVER_SIDE.has(profile.role)) {
    res.status(403).json({ error: "Only drivers and providers can upload job photos." });
    return;
  }

  const job = await loadJobIfMember(jobId, profile);
  if (!job) { res.status(404).json({ error: "Job not found" }); return; }

  if (profile.role === "driver" && !(await isDriverAssignedToJob(jobId, profile.id))) {
    res.status(403).json({ error: "You are not assigned to this job." });
    return;
  }

  const { photoUrl, photoCaption, siteNotes } = req.body;

  const [evidence] = await db.insert(deliveryEvidenceTable).values({
    jobId,
    uploadedByProfileId: profile.id,
    photoUrl: photoUrl ?? null,
    photoCaption: photoCaption ?? null,
    siteNotes: siteNotes ?? null,
    uploadedAt: new Date(),
  }).returning();

  await recordJobTimelineEvent(jobId, profile.id, "photo_uploaded", {
    note: photoCaption ?? (photoUrl ? "Job photo uploaded" : "Site notes added"),
  });

  res.status(201).json(evidence);
});

export default router;
