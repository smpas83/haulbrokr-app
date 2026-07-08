import { Router, type IRouter } from "express";
import {
  db,
  deliveryEvidenceTable,
  ticketsTable,
  activityTable,
} from "@workspace/db";
import { getRequestProfile, requireProfile } from "../middlewares/requireAuth";
import {
  loadJobIfMember,
  DRIVER_SIDE,
  isDriverAssignedToJob,
} from "../lib/access";
import { recordJobTimelineEvent } from "../lib/jobTimeline";

const router: IRouter = Router();

type EventType = "checkin" | "checkout" | "pickup" | "delivery";
type FileInput = { role: string; url: string };

// Required items per driver event (validation proven in prototype).
const REQUIRED: Record<
  EventType,
  { gps: boolean; gpsConfirmed: boolean; files: string[] }
> = {
  checkin: {
    gps: true,
    gpsConfirmed: false,
    files: ["selfie", "truck", "license_plate"],
  },
  checkout: { gps: true, gpsConfirmed: false, files: [] },
  pickup: {
    gps: false,
    gpsConfirmed: false,
    files: ["loaded_truck", "scale_ticket"],
  },
  delivery: {
    gps: false,
    gpsConfirmed: true,
    files: ["delivered_material", "customer_signature"],
  },
};

const TIMELINE_STATUS: Record<
  EventType,
  "checked_in" | "loaded" | "completed" | "arrived"
> = {
  checkin: "checked_in",
  checkout: "arrived",
  pickup: "loaded",
  delivery: "completed",
};

router.post(
  "/jobs/:jobId/driver-events",
  requireProfile,
  async (req, res): Promise<void> => {
    const profile = getRequestProfile(req);
    const jobId = parseInt(req.params.jobId as string, 10);
    if (!Number.isFinite(jobId)) {
      res.status(400).json({ error: "Invalid job id" });
      return;
    }

    if (!DRIVER_SIDE.has(profile.role)) {
      res.status(403).json({
        error: "Only drivers and providers can submit driver events.",
      });
      return;
    }

    const job = await loadJobIfMember(jobId, profile);
    if (!job) {
      res.status(404).json({ error: "Job not found" });
      return;
    }

    if (
      profile.role === "driver" &&
      !(await isDriverAssignedToJob(jobId, profile.id))
    ) {
      res.status(403).json({ error: "You are not assigned to this job." });
      return;
    }

    const eventType = req.body?.eventType as EventType;
    if (!REQUIRED[eventType]) {
      res.status(400).json({
        error: "Invalid eventType. Expected checkin|checkout|pickup|delivery.",
      });
      return;
    }

    const gps = req.body?.gps as { lat?: number; long?: number } | undefined;
    const gpsConfirmed = req.body?.gpsConfirmed === true;
    const weightTons = req.body?.weightTons as number | string | undefined; // for pickup scale ticket
    const loadNumber = Number(req.body?.loadNumber ?? 1);
    const files: FileInput[] = Array.isArray(req.body?.files)
      ? req.body.files
      : [];
    const spec = REQUIRED[eventType];

    // ── Validation ──
    const missing: string[] = [];
    if (spec.gps && (!gps || gps.lat == null || gps.long == null))
      missing.push("gps");
    if (spec.gpsConfirmed && !gpsConfirmed) missing.push("gps_confirmed");
    for (const role of spec.files) {
      if (!files.some((f) => f.role === role && f.url)) missing.push(role);
    }

    if (missing.length > 0) {
      await db.insert(activityTable).values({
        profileId: job.customerId,
        type: "driver_event_rejected",
        description: `Driver ${eventType} rejected on job #${jobId}: missing ${missing.join(", ")}`,
        relatedId: jobId,
      });
      res
        .status(422)
        .json({ error: "Missing required items", eventType, missing });
      return;
    }

    // ── Store everything atomically ──
    const result = await db.transaction(async (tx) => {
      const evidenceRows = [];
      for (const f of files) {
        const [row] = await tx
          .insert(deliveryEvidenceTable)
          .values({
            jobId,
            uploadedByProfileId: profile.id,
            photoUrl: f.url,
            photoCaption: f.role,
            siteNotes: gps ? `gps:${gps.lat},${gps.long}` : null,
            uploadedAt: new Date(),
          })
          .returning();
        evidenceRows.push(row);
      }

      let ticketId: number | null = null;
      if (eventType === "pickup") {
        const scale = files.find((f) => f.role === "scale_ticket");
        const [ticket] = await tx
          .insert(ticketsTable)
          .values({
            jobId,
            driverProfileId: profile.id,
            loadNumber: Number.isFinite(loadNumber) ? loadNumber : 1,
            status: "in_progress",
            weightTons: weightTons != null ? String(weightTons) : null,
            photoUrl: scale?.url ?? null,
            clockedInAt: new Date(),
          })
          .returning();
        ticketId = ticket.id;
      }

      await recordJobTimelineEvent(
        jobId,
        profile.id,
        TIMELINE_STATUS[eventType],
        {
          ticketId,
          note: `Driver ${eventType} (${files.length} file(s))`,
        },
      );
      if (eventType === "pickup") {
        await recordJobTimelineEvent(jobId, profile.id, "ticket_uploaded", {
          ticketId,
        });
      }

      if (eventType === "delivery") {
        await tx.insert(activityTable).values({
          profileId: job.customerId,
          type: "delivery_evidence_submitted",
          description: `Delivery completed on job #${jobId} by profile ${profile.id}`,
          relatedId: jobId,
        });
      }

      return { evidence: evidenceRows, ticketId };
    });

    res.status(201).json({ eventType, ...result });
  },
);

export default router;
