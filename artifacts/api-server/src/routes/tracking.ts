import { Router, type IRouter } from "express";
import {
  db,
  jobStatusUpdatesTable,
  jobsTable,
  trucksTable,
  deliveryEvidenceTable,
} from "@workspace/db";
import { eq, desc, and, inArray } from "drizzle-orm";
import { getRequestProfile, requireProfile } from "../middlewares/requireAuth";
import { loadJobIfMember, DRIVER_SIDE } from "../lib/access";
import { recordJobTimelineEvent } from "../lib/jobTimeline";

const router: IRouter = Router();

function parseGpsNote(
  note: string | null,
): { lat: number; lng: number; at: string } | null {
  if (!note) return null;
  const m = note.match(/^gps:(-?\d+\.?\d*),(-?\d+\.?\d*)(?:@(\d+))?/);
  if (!m) return null;
  return {
    lat: parseFloat(m[1]),
    lng: parseFloat(m[2]),
    at: m[3]
      ? new Date(parseInt(m[3], 10)).toISOString()
      : new Date().toISOString(),
  };
}

/** Driver pings live location during active haul. */
router.post(
  "/jobs/:id/location",
  requireProfile,
  async (req, res): Promise<void> => {
    const profile = getRequestProfile(req);
    const jobId = parseInt(req.params.id as string, 10);
    if (!Number.isFinite(jobId)) {
      res.status(400).json({ error: "Invalid job id" });
      return;
    }

    if (!DRIVER_SIDE.has(profile.role)) {
      res
        .status(403)
        .json({ error: "Only drivers and providers can update location." });
      return;
    }

    const job = await loadJobIfMember(jobId, profile);
    if (!job) {
      res.status(404).json({ error: "Job not found" });
      return;
    }

    const lat = Number(req.body?.lat);
    const lng = Number(req.body?.lng ?? req.body?.long);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      res.status(400).json({ error: "lat and lng are required numbers." });
      return;
    }

    const ts = Date.now();
    await recordJobTimelineEvent(jobId, profile.id, "en_route", {
      note: `gps:${lat},${lng}@${ts}`,
    });

    res.status(201).json({ lat, lng, recordedAt: new Date(ts).toISOString() });
  },
);

/** Latest truck position + trail for a job. */
router.get(
  "/jobs/:id/tracking",
  requireProfile,
  async (req, res): Promise<void> => {
    const profile = getRequestProfile(req);
    const jobId = parseInt(req.params.id as string, 10);
    if (!Number.isFinite(jobId)) {
      res.status(400).json({ error: "Invalid job id" });
      return;
    }

    const job = await loadJobIfMember(jobId, profile);
    if (!job) {
      res.status(404).json({ error: "Job not found" });
      return;
    }

    const updates = await db
      .select()
      .from(jobStatusUpdatesTable)
      .where(eq(jobStatusUpdatesTable.jobId, jobId))
      .orderBy(desc(jobStatusUpdatesTable.createdAt))
      .limit(50);

    const evidence = await db
      .select()
      .from(deliveryEvidenceTable)
      .where(eq(deliveryEvidenceTable.jobId, jobId))
      .orderBy(desc(deliveryEvidenceTable.uploadedAt))
      .limit(20);

    const trail = [
      ...updates.map((u) => ({
        source: "status" as const,
        status: u.status,
        ...parseGpsNote(u.note),
        createdAt: u.createdAt,
      })),
      ...evidence.map((e) => ({
        source: "evidence" as const,
        ...parseGpsNote(e.siteNotes),
        createdAt: e.uploadedAt,
      })),
    ]
      .filter((p) => p.lat != null && p.lng != null)
      .sort(
        (a, b) =>
          new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime(),
      );

    const latest = trail[0] ?? null;

    res.json({
      jobId,
      status: job.status,
      latest,
      trail: trail.slice(0, 20),
    });
  },
);

/** Digital Twin — fleet overview for dispatch mission control. */
router.get(
  "/dispatch/overview",
  requireProfile,
  async (req, res): Promise<void> => {
    const profile = getRequestProfile(req);

    const activeStatuses = ["accepted", "active", "in_progress"] as const;
    const jobs = await db
      .select({
        id: jobsTable.id,
        status: jobsTable.status,
        materialType: jobsTable.materialType,
        pickupAddress: jobsTable.pickupAddress,
        deliveryAddress: jobsTable.deliveryAddress,
        customerId: jobsTable.customerId,
        providerId: jobsTable.providerId,
        scheduledDate: jobsTable.scheduledDate,
      })
      .from(jobsTable)
      .where(inArray(jobsTable.status, [...activeStatuses]));

    const visibleJobs =
      profile.role === "customer"
        ? jobs.filter((j) => j.customerId === profile.id)
        : profile.role === "provider" || profile.role === "driver"
          ? jobs.filter((j) => j.providerId === profile.id)
          : jobs;

    const jobIds = visibleJobs.map((j) => j.id);
    const positions: Record<
      number,
      { lat: number; lng: number; at: string } | null
    > = {};

    if (jobIds.length > 0) {
      const updates = await db
        .select()
        .from(jobStatusUpdatesTable)
        .where(inArray(jobStatusUpdatesTable.jobId, jobIds))
        .orderBy(desc(jobStatusUpdatesTable.createdAt));

      for (const u of updates) {
        if (positions[u.jobId]) continue;
        const gps = parseGpsNote(u.note);
        if (gps)
          positions[u.jobId] = { lat: gps.lat, lng: gps.lng, at: gps.at };
      }
    }

    let fleet: { id: number; truckType: string; isAvailable: boolean }[] = [];
    if (profile.role === "provider") {
      fleet = await db
        .select({
          id: trucksTable.id,
          truckType: trucksTable.truckType,
          isAvailable: trucksTable.isAvailable,
        })
        .from(trucksTable)
        .where(eq(trucksTable.ownerId, profile.id));
    }

    res.json({
      activeJobs: visibleJobs.length,
      jobs: visibleJobs.map((j) => ({
        ...j,
        position: positions[j.id] ?? null,
      })),
      fleet,
      updatedAt: new Date().toISOString(),
    });
  },
);

export default router;
