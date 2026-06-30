import { and, eq, inArray, sql } from "drizzle-orm";
import {
  activityTable,
  db,
  deliveryEvidenceTable,
  jobsTable,
  requestsTable,
  ticketsTable,
  type Job,
  type Profile,
  type Ticket,
} from "@workspace/db";
import { computeBreakdown } from "./jobSettlement";
import { recordJobTimelineEvent } from "./jobTimeline";

export const DRIVER_WORKFLOW_ACTIONS = [
  "accept_job",
  "decline_job",
  "navigate_to_pickup",
  "check_in",
  "start_loading",
  "upload_loading_photos",
  "upload_scale_ticket",
  "leave_pickup",
  "navigate_to_delivery",
  "arrive_delivery",
  "upload_delivery_photos",
  "upload_signed_ticket",
  "check_out",
  "complete_job",
] as const;

export type DriverWorkflowAction = (typeof DRIVER_WORKFLOW_ACTIONS)[number];
type WorkflowState = NonNullable<Ticket["workflowState"]>;
type TimelineStatus = Parameters<typeof recordJobTimelineEvent>[2];

type WorkflowFile = {
  role: string;
  url: string;
  caption?: string | null;
};

export type DriverWorkflowInput = {
  action: DriverWorkflowAction;
  ticketId?: number | null;
  files?: WorkflowFile[];
  gps?: { lat?: number; long?: number } | null;
  weightTons?: number | string | null;
  totalHours?: number | string | null;
  notes?: string | null;
};

const WORKFLOW: Record<DriverWorkflowAction, {
  from: WorkflowState[];
  to: WorkflowState;
  timeline: TimelineStatus;
  timestampColumn: keyof Ticket;
  note: string;
}> = {
  accept_job: {
    from: ["assigned"],
    to: "accepted",
    timeline: "driver_accepted",
    timestampColumn: "acceptedAt",
    note: "Driver accepted assignment",
  },
  decline_job: {
    from: ["assigned", "accepted"],
    to: "declined",
    timeline: "driver_declined",
    timestampColumn: "declinedAt",
    note: "Driver declined assignment",
  },
  navigate_to_pickup: {
    from: ["accepted"],
    to: "en_route_pickup",
    timeline: "en_route_pickup",
    timestampColumn: "enRoutePickupAt",
    note: "Driver en route to pickup",
  },
  check_in: {
    from: ["en_route_pickup"],
    to: "checked_in",
    timeline: "checked_in",
    timestampColumn: "pickupCheckedInAt",
    note: "Driver checked in at pickup",
  },
  start_loading: {
    from: ["checked_in"],
    to: "loading",
    timeline: "loading",
    timestampColumn: "loadingStartedAt",
    note: "Driver started loading",
  },
  upload_loading_photos: {
    from: ["loading"],
    to: "loading_photos_uploaded",
    timeline: "loading_photos_uploaded",
    timestampColumn: "loadingPhotosUploadedAt",
    note: "Driver uploaded loading photos",
  },
  upload_scale_ticket: {
    from: ["loading_photos_uploaded"],
    to: "scale_ticket_uploaded",
    timeline: "scale_ticket_uploaded",
    timestampColumn: "scaleTicketUploadedAt",
    note: "Driver uploaded scale ticket",
  },
  leave_pickup: {
    from: ["scale_ticket_uploaded"],
    to: "left_pickup",
    timeline: "left_pickup",
    timestampColumn: "leftPickupAt",
    note: "Driver left pickup",
  },
  navigate_to_delivery: {
    from: ["left_pickup"],
    to: "en_route_delivery",
    timeline: "en_route_delivery",
    timestampColumn: "enRouteDeliveryAt",
    note: "Driver en route to delivery",
  },
  arrive_delivery: {
    from: ["en_route_delivery"],
    to: "arrived_delivery",
    timeline: "arrived_delivery",
    timestampColumn: "arrivedDeliveryAt",
    note: "Driver arrived at delivery",
  },
  upload_delivery_photos: {
    from: ["arrived_delivery"],
    to: "delivery_photos_uploaded",
    timeline: "delivery_photos_uploaded",
    timestampColumn: "deliveryPhotosUploadedAt",
    note: "Driver uploaded delivery photos",
  },
  upload_signed_ticket: {
    from: ["delivery_photos_uploaded"],
    to: "signed_ticket_uploaded",
    timeline: "signed_ticket_uploaded",
    timestampColumn: "signedTicketUploadedAt",
    note: "Driver uploaded signed ticket",
  },
  check_out: {
    from: ["signed_ticket_uploaded"],
    to: "checked_out",
    timeline: "checked_out",
    timestampColumn: "checkedOutAt",
    note: "Driver checked out",
  },
  complete_job: {
    from: ["checked_out"],
    to: "completed",
    timeline: "completed",
    timestampColumn: "completedAt",
    note: "Driver completed assignment",
  },
};

function serializeTicket(ticket: Ticket) {
  return {
    ...ticket,
    weightTons: ticket.weightTons == null ? null : parseFloat(ticket.weightTons),
  };
}

function normalizeFiles(files: DriverWorkflowInput["files"]): WorkflowFile[] {
  return Array.isArray(files)
    ? files.filter((file): file is WorkflowFile => Boolean(file?.role && file?.url))
    : [];
}

function findFile(files: WorkflowFile[], roles: string[]) {
  return files.find((file) => roles.includes(file.role));
}

function gpsNote(gps: DriverWorkflowInput["gps"]) {
  if (!gps || gps.lat == null || gps.long == null) return null;
  return `gps:${gps.lat},${gps.long}`;
}

async function loadWorkflowTicket(jobId: number, profile: Profile, ticketId?: number | null) {
  const predicates = [eq(ticketsTable.jobId, jobId)];
  if (ticketId != null) predicates.push(eq(ticketsTable.id, ticketId));
  if (profile.role === "driver") predicates.push(eq(ticketsTable.driverProfileId, profile.id));

  const [ticket] = await db
    .select()
    .from(ticketsTable)
    .where(and(...predicates))
    .orderBy(sql`${ticketsTable.loadNumber} asc`);

  return ticket ?? null;
}

async function recordNotification(job: Job, profile: Profile, action: DriverWorkflowAction, note: string) {
  const description = `${note} on job #${job.id} - ${job.materialType} delivery`;
  await db.insert(activityTable).values([
    {
      profileId: job.customerId,
      type: "driver_workflow_updated",
      description,
      relatedId: job.id,
    },
    {
      profileId: job.providerId,
      type: "driver_workflow_updated",
      description,
      relatedId: job.id,
    },
  ]);

  if (action === "decline_job") {
    await db.insert(activityTable).values({
      profileId: job.customerId,
      type: "job_declined",
      description: `Driver declined load #${job.id}; dispatcher should reassign the truck.`,
      relatedId: job.id,
    });
  } else if (action === "complete_job") {
    await db.insert(activityTable).values({
      profileId: profile.id,
      type: "job_completed",
      description: `Completed load assignment for job #${job.id}`,
      relatedId: job.id,
    });
  }
}

async function insertEvidence(jobId: number, profileId: number, files: WorkflowFile[], gps: DriverWorkflowInput["gps"]) {
  const siteNotes = gpsNote(gps);
  const rows = [];
  for (const file of files) {
    const [row] = await db.insert(deliveryEvidenceTable).values({
      jobId,
      uploadedByProfileId: profileId,
      photoUrl: file.url,
      photoCaption: file.caption ?? file.role,
      siteNotes,
      uploadedAt: new Date(),
    }).returning();
    rows.push(row);
  }
  return rows;
}

async function completeJobIfAssignmentsDone(job: Job, actorProfileId: number, totalHours?: number | string | null) {
  const tickets = await db
    .select()
    .from(ticketsTable)
    .where(and(eq(ticketsTable.jobId, job.id), inArray(ticketsTable.status, ["pending", "in_progress", "completed", "verified"])));

  const activeTickets = tickets.filter((ticket) => ticket.status !== "declined" && ticket.status !== "cancelled");
  if (activeTickets.length === 0 || activeTickets.some((ticket) => !["completed", "verified"].includes(ticket.status))) {
    return null;
  }

  const hours =
    totalHours != null && totalHours !== ""
      ? Number(totalHours)
      : job.totalHours != null
        ? parseFloat(job.totalHours)
        : parseFloat(job.estimatedHours);

  const updates: Record<string, unknown> = {
    status: "completed",
    completedAt: new Date(),
    completionApproval: "pending",
  };

  if (Number.isFinite(hours)) {
    const rate = parseFloat(job.ratePerHour);
    const feeRate = job.platformFeeRate ? parseFloat(job.platformFeeRate) : 0.15;
    const { base, fee, gross } = computeBreakdown(rate, hours, feeRate);
    updates.totalHours = String(hours);
    updates.totalAmount = String(base);
    updates.customerTotalAmount = String(gross);
    updates.platformFeeAmount = String(fee);
    updates.providerNetAmount = String(base);
  }

  const [updated] = await db.update(jobsTable).set(updates).where(eq(jobsTable.id, job.id)).returning();
  await db.update(requestsTable).set({ status: "completed" }).where(eq(requestsTable.id, job.requestId));
  await recordJobTimelineEvent(job.id, actorProfileId, "completed", { note: "All driver assignments completed" });
  return updated ?? null;
}

export async function transitionDriverWorkflow(job: Job, profile: Profile, input: DriverWorkflowInput) {
  const definition = WORKFLOW[input.action];
  if (!definition) {
    return { ok: false as const, status: 400, error: "Invalid workflow action." };
  }

  if (!["driver", "provider"].includes(profile.role)) {
    return { ok: false as const, status: 403, error: "Only drivers and providers can update driver workflow." };
  }

  const ticket = await loadWorkflowTicket(job.id, profile, input.ticketId);
  if (!ticket) {
    return { ok: false as const, status: 404, error: "Assignment ticket not found." };
  }

  if (!definition.from.includes(ticket.workflowState)) {
    return {
      ok: false as const,
      status: 409,
      error: `Cannot ${input.action.replace(/_/g, " ")} from ${ticket.workflowState}.`,
      currentState: ticket.workflowState,
      allowedStates: definition.from,
    };
  }

  const files = normalizeFiles(input.files);
  const now = new Date();
  const ticketUpdates: Record<string, unknown> = {
    workflowState: definition.to,
    lastWorkflowTransitionAt: now,
    [definition.timestampColumn]: now,
  };

  if (input.action === "decline_job") {
    ticketUpdates.status = "declined";
  } else if (input.action === "check_in") {
    ticketUpdates.status = "in_progress";
    ticketUpdates.clockedInAt = now;
  } else if (input.action === "upload_scale_ticket") {
    const scaleTicket = findFile(files, ["scale_ticket", "scale_ticket_photo"]);
    if (!scaleTicket) return { ok: false as const, status: 422, error: "Scale ticket photo is required." };
    ticketUpdates.photoUrl = scaleTicket.url;
    if (input.weightTons != null && input.weightTons !== "") ticketUpdates.weightTons = String(input.weightTons);
  } else if (input.action === "upload_loading_photos") {
    if (files.length === 0) return { ok: false as const, status: 422, error: "At least one loading photo is required." };
  } else if (input.action === "upload_delivery_photos") {
    if (files.length === 0) return { ok: false as const, status: 422, error: "At least one delivery photo is required." };
  } else if (input.action === "upload_signed_ticket") {
    const signedTicket = findFile(files, ["signed_ticket", "customer_signature"]);
    if (!signedTicket) return { ok: false as const, status: 422, error: "Signed ticket photo is required." };
  } else if (input.action === "check_out") {
    ticketUpdates.status = "completed";
    ticketUpdates.clockedOutAt = now;
  } else if (input.action === "complete_job") {
    ticketUpdates.status = "completed";
  }

  const [updatedTicket] = await db.update(ticketsTable)
    .set(ticketUpdates)
    .where(eq(ticketsTable.id, ticket.id))
    .returning();

  if (!updatedTicket) {
    return { ok: false as const, status: 404, error: "Assignment ticket not found." };
  }

  let evidence: Awaited<ReturnType<typeof insertEvidence>> = [];
  if (
    input.action === "upload_loading_photos" ||
    input.action === "upload_delivery_photos" ||
    input.action === "upload_signed_ticket" ||
    input.action === "upload_scale_ticket"
  ) {
    evidence = await insertEvidence(job.id, profile.id, files, input.gps);
  }

  if (input.action === "start_loading" && ["accepted", "active"].includes(job.status)) {
    await db.update(jobsTable)
      .set({ status: "in_progress", startedAt: job.startedAt ?? now })
      .where(eq(jobsTable.id, job.id));
    await db.update(requestsTable).set({ status: "in_progress" }).where(eq(requestsTable.id, job.requestId));
    await db.insert(activityTable).values({
      profileId: job.customerId,
      type: "job_started",
      description: `Driver started loading for job #${job.id} - ${job.materialType} delivery`,
      relatedId: job.id,
    });
  }

  await recordJobTimelineEvent(job.id, profile.id, definition.timeline, {
    ticketId: updatedTicket.id,
    note: input.notes ?? definition.note,
  });
  await recordNotification(job, profile, input.action, input.notes ?? definition.note);

  const completedJob = input.action === "complete_job"
    ? await completeJobIfAssignmentsDone(job, profile.id, input.totalHours)
    : null;

  return {
    ok: true as const,
    action: input.action,
    previousState: ticket.workflowState,
    currentState: updatedTicket.workflowState,
    ticket: serializeTicket(updatedTicket),
    evidence,
    job: completedJob,
  };
}
