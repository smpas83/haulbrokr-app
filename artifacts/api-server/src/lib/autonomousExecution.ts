import {
  db,
  autonomousRecommendationsTable,
  activityTable,
  jobMessagesTable,
  jobsTable,
  trucksTable,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { recordTimelineEvent, remember } from "./autonomousMemory";
import { getRecommendation, serializeRecommendation } from "./autonomousEngine";
import { loadJobIfMember } from "./access";

const FINANCIAL_ACTIONS = new Set(["generate_invoice"]);

export interface ExecutionResult {
  success: boolean;
  message: string;
  details?: Record<string, unknown>;
}

export async function executeApprovedRecommendation(
  profile: { id: number; role: string; companyName: string },
  recommendationId: number,
): Promise<ExecutionResult> {
  const rec = await getRecommendation(profile.id, recommendationId);
  if (!rec) return { success: false, message: "Recommendation not found." };
  if (!["approved", "modified"].includes(rec.status)) {
    return { success: false, message: "Recommendation must be approved before execution." };
  }

  if (FINANCIAL_ACTIONS.has(rec.actionType)) {
    return { success: false, message: "Financial actions require explicit manual approval in Account." };
  }

  const payload = rec.modifiedPayload ?? rec.payload;

  let result: ExecutionResult;
  switch (rec.actionType) {
    case "assign_truck":
      result = await execAssignTruck(profile, payload);
      break;
    case "notify_driver":
    case "notify_vendor":
    case "contact_customer":
      result = await execNotify(profile, rec.actionType, payload);
      break;
    case "escalate_delay":
      result = await execEscalateDelay(profile, payload);
      break;
    case "schedule_maintenance":
      result = await execScheduleMaintenance(profile, payload);
      break;
    case "renew_insurance":
      result = await execRenewInsurance(profile);
      break;
    case "create_follow_up":
      result = await execFollowUp(profile, payload);
      break;
    case "combine_loads":
    case "increase_rate":
      result = { success: true, message: "Recommendation noted — navigate to Load Board to act.", details: payload };
      break;
    default:
      result = { success: false, message: `Action type ${rec.actionType} is not executable.` };
  }

  if (result.success) {
    await db.update(autonomousRecommendationsTable)
      .set({ status: "executed", executedAt: new Date(), updatedAt: new Date() })
      .where(eq(autonomousRecommendationsTable.id, recommendationId));

    await recordTimelineEvent({
      profileId: profile.id,
      eventType: "action_executed",
      title: `Executed: ${rec.title}`,
      description: result.message,
      recommendationId,
      metadata: { actionType: rec.actionType, ...result.details },
    });

    await remember(profile.id, "decision", `exec-${recommendationId}`, {
      actionType: rec.actionType,
      executedAt: new Date().toISOString(),
      result: result.message,
    });
  }

  return result;
}

async function execAssignTruck(
  profile: { id: number; role: string },
  payload: Record<string, unknown>,
): Promise<ExecutionResult> {
  const jobId = Number(payload.jobId);
  const truckId = Number(payload.truckId);
  if (!Number.isFinite(jobId) || !Number.isFinite(truckId)) {
    return { success: false, message: "Missing jobId or truckId in payload." };
  }

  const job = await loadJobIfMember(jobId, profile as Parameters<typeof loadJobIfMember>[1]);
  if (!job) return { success: false, message: "Job not found or access denied." };

  const [truck] = await db.select().from(trucksTable).where(eq(trucksTable.id, truckId));
  if (!truck || truck.ownerId !== profile.id) {
    return { success: false, message: "Truck not in your fleet." };
  }

  await db.update(trucksTable)
    .set({ isAvailable: false, updatedAt: new Date() })
    .where(eq(trucksTable.id, truckId));

  await db.insert(activityTable).values({
    profileId: profile.id,
    type: "job_accepted",
    description: `AI assigned ${truck.truckNumber ?? `Truck #${truckId}`} to Job #${jobId}`,
    relatedId: jobId,
  });

  return {
    success: true,
    message: `Truck #${truckId} marked dispatched for Job #${jobId}. Complete driver assignment in job detail.`,
    details: { jobId, truckId },
  };
}

async function execNotify(
  profile: { id: number; companyName: string },
  actionType: string,
  payload: Record<string, unknown>,
): Promise<ExecutionResult> {
  const jobId = payload.jobId != null ? Number(payload.jobId) : null;
  const message = String(payload.message ?? payload.body ?? "Action required — please review in HaulBrokr.");

  if (jobId && Number.isFinite(jobId)) {
    const job = await loadJobIfMember(jobId, profile as Parameters<typeof loadJobIfMember>[1]);
    if (job) {
      await db.insert(jobMessagesTable).values({
        jobId,
        senderProfileId: profile.id,
        body: `[AI COO — ${actionType.replace(/_/g, " ")}] ${message}`,
      });
    }
  }

  await db.insert(activityTable).values({
    profileId: profile.id,
    type: "request_posted",
    description: `AI notification sent: ${message.slice(0, 120)}`,
    relatedId: jobId ?? undefined,
  });

  return { success: true, message: "Notification recorded and message posted to job thread.", details: { jobId } };
}

async function execEscalateDelay(
  profile: { id: number },
  payload: Record<string, unknown>,
): Promise<ExecutionResult> {
  const jobId = Number(payload.jobId);
  if (!Number.isFinite(jobId)) return { success: false, message: "Missing jobId." };

  await db.insert(activityTable).values({
    profileId: profile.id,
    type: "payout_delayed",
    description: `DELAY ESCALATION: Job #${jobId} requires immediate attention.`,
    relatedId: jobId,
  });

  return { success: true, message: `Delay escalated for Job #${jobId}.`, details: { jobId } };
}

async function execScheduleMaintenance(
  profile: { id: number },
  payload: Record<string, unknown>,
): Promise<ExecutionResult> {
  await remember(profile.id, "decision", `maintenance-${payload.alertId ?? Date.now()}`, {
    scheduledAt: new Date().toISOString(),
    alertId: payload.alertId,
    status: "scheduled",
  });

  return { success: true, message: "Maintenance follow-up scheduled in AI memory.", details: payload };
}

async function execRenewInsurance(profile: { id: number }): Promise<ExecutionResult> {
  await db.insert(activityTable).values({
    profileId: profile.id,
    type: "application_rejected",
    description: "AI COO: Insurance/compliance renewal required — visit Account settings.",
  });

  return { success: true, message: "Compliance renewal reminder created. Visit Account to upload documents." };
}

async function execFollowUp(
  profile: { id: number },
  payload: Record<string, unknown>,
): Promise<ExecutionResult> {
  const jobId = Number(payload.jobId);
  if (!Number.isFinite(jobId)) return { success: false, message: "Missing jobId." };

  const [job] = await db.select({ materialType: jobsTable.materialType }).from(jobsTable).where(eq(jobsTable.id, jobId));
  await db.insert(activityTable).values({
    profileId: profile.id,
    type: "job_started",
    description: `Follow-up task: confirm dispatch for Job #${jobId}${job ? ` (${job.materialType})` : ""}.`,
    relatedId: jobId,
  });

  return { success: true, message: `Follow-up task created for Job #${jobId}.`, details: { jobId } };
}

export async function approveRecommendation(
  profileId: number,
  recommendationId: number,
  approverId: number,
  modifiedPayload?: Record<string, unknown>,
) {
  const rec = await getRecommendation(profileId, recommendationId);
  if (!rec) return null;
  if (rec.status !== "pending" && rec.status !== "modified") return null;

  const status = modifiedPayload ? "modified" : "approved";
  await db.update(autonomousRecommendationsTable)
    .set({
      status,
      approvedByProfileId: approverId,
      approvedAt: new Date(),
      modifiedPayload: modifiedPayload
        ? JSON.stringify(modifiedPayload)
        : rec.modifiedPayload
          ? JSON.stringify(rec.modifiedPayload)
          : null,
      updatedAt: new Date(),
    })
    .where(eq(autonomousRecommendationsTable.id, recommendationId));

  await recordTimelineEvent({
    profileId,
    eventType: status === "modified" ? "recommendation_modified" : "recommendation_approved",
    title: rec.title,
    description: `User ${status} AI recommendation.`,
    recommendationId,
  });

  await remember(profileId, "approval", `rec-${recommendationId}`, {
    status,
    approvedAt: new Date().toISOString(),
    modified: !!modifiedPayload,
  });

  return getRecommendation(profileId, recommendationId);
}

export async function rejectRecommendation(
  profileId: number,
  recommendationId: number,
  reason?: string,
) {
  const rec = await getRecommendation(profileId, recommendationId);
  if (!rec || rec.status !== "pending") return null;

  await db.update(autonomousRecommendationsTable)
    .set({
      status: "rejected",
      rejectionReason: reason ?? "Rejected by user",
      updatedAt: new Date(),
    })
    .where(eq(autonomousRecommendationsTable.id, recommendationId));

  await recordTimelineEvent({
    profileId,
    eventType: "recommendation_rejected",
    title: rec.title,
    description: reason ?? "User rejected AI recommendation.",
    recommendationId,
  });

  await remember(profileId, "dismissal", rec.externalKey, {
    rejectedAt: new Date().toISOString(),
    reason,
  });

  return getRecommendation(profileId, recommendationId);
}

export { serializeRecommendation };
