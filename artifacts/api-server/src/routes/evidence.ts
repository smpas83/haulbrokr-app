import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, deliveryEvidenceTable, jobsTable } from "@workspace/db";
import { requireProfile } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.get("/jobs/:jobId/evidence", requireProfile, async (req, res): Promise<void> => {
  const profile = (req as any).profile;
  const jobId = parseInt(req.params.jobId as string, 10);

  const [job] = await db.select().from(jobsTable).where(
    and(
      eq(jobsTable.id, jobId),
      eq(profile.role === "provider" ? jobsTable.providerId : jobsTable.customerId, profile.id)
    )
  );
  if (!job) { res.status(404).json({ error: "Job not found" }); return; }

  const evidence = await db.select().from(deliveryEvidenceTable)
    .where(eq(deliveryEvidenceTable.jobId, jobId));
  res.json(evidence);
});

router.post("/jobs/:jobId/evidence", requireProfile, async (req, res): Promise<void> => {
  const profile = (req as any).profile;
  const jobId = parseInt(req.params.jobId as string, 10);
  const { photoUrl, photoCaption, siteNotes } = req.body;

  const [job] = await db.select().from(jobsTable)
    .where(and(eq(jobsTable.id, jobId), eq(jobsTable.providerId, profile.id)));
  if (!job) { res.status(404).json({ error: "Job not found or not authorized" }); return; }

  const [evidence] = await db.insert(deliveryEvidenceTable).values({
    jobId,
    uploadedByProfileId: profile.id,
    photoUrl: photoUrl ?? null,
    photoCaption: photoCaption ?? null,
    siteNotes: siteNotes ?? null,
    uploadedAt: new Date(),
  }).returning();

  res.status(201).json(evidence);
});

export default router;
