import {
  db,
  autonomousRecommendationsTable,
  activityTable,
  type AutonomousRecommendation,
} from "@workspace/db";
import { eq, and, inArray, desc } from "drizzle-orm";
import type { OperationsCenterPayload } from "./operationsInsights";
import { isDismissed, recordTimelineEvent, remember } from "./autonomousMemory";

export interface RecommendationDraft {
  externalKey: string;
  actionType: AutonomousRecommendation["actionType"];
  priority: AutonomousRecommendation["priority"];
  title: string;
  description: string;
  businessImpact: string;
  confidence: number;
  estimatedRoi: number;
  payload: Record<string, unknown>;
  relatedJobId?: number;
  relatedRequestId?: number;
  relatedTruckId?: number;
}

export interface ProfileCtx {
  id: number;
  role: string;
  companyName: string;
}

function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function generateRecommendationDrafts(
  profile: ProfileCtx,
  ops: OperationsCenterPayload,
): RecommendationDraft[] {
  const drafts: RecommendationDraft[] = [];
  const isProvider = profile.role === "provider" || profile.role === "driver";
  const isCustomer = profile.role === "customer";

  for (const job of ops.lateJobs) {
    drafts.push({
      externalKey: `escalate-delay-job-${job.id}`,
      actionType: "escalate_delay",
      priority: "critical",
      title: `Escalate delay on Job #${job.id}`,
      description: `${job.materialType} haul is past scheduled start without check-in.`,
      businessImpact: "Late jobs risk cancellation fees and customer churn.",
      confidence: 96,
      estimatedRoi: 800,
      payload: { jobId: job.id, message: `Job #${job.id} is running late. Immediate dispatch action required.` },
      relatedJobId: job.id,
    });
  }

  if (isProvider) {
    for (const suggestion of ops.dispatchSuggestions) {
      if (suggestion.recommendedTruckId && suggestion.backupTruckId && suggestion.lateRisk !== "low") {
        drafts.push({
          externalKey: `assign-truck-job-${suggestion.jobId}-truck-${suggestion.recommendedTruckId}`,
          actionType: "assign_truck",
          priority: suggestion.lateRisk === "high" ? "critical" : "high",
          title: `Assign ${suggestion.recommendedTruckLabel} to Job #${suggestion.jobId}`,
          description: `AI recommends ${suggestion.recommendedTruckLabel} over ${suggestion.backupTruckLabel} — est. profit $${suggestion.estimatedProfit}.`,
          businessImpact: `Estimated ROI $${suggestion.estimatedProfit} with $${suggestion.estimatedFuelCost} fuel cost.`,
          confidence: 88,
          estimatedRoi: suggestion.estimatedProfit,
          payload: {
            jobId: suggestion.jobId,
            truckId: suggestion.recommendedTruckId,
            backupTruckId: suggestion.backupTruckId,
          },
          relatedJobId: suggestion.jobId,
          relatedTruckId: suggestion.recommendedTruckId,
        });
      }
    }

    const idleCount = ops.fleetStatus.available;
    if (idleCount >= 2 && ops.highMarginOpportunities.length > 0) {
      const opp = ops.highMarginOpportunities[0]!;
      drafts.push({
        externalKey: `combine-loads-${opp.id}`,
        actionType: "combine_loads",
        priority: "medium",
        title: `Bid on high-margin load #${opp.id}`,
        description: `${idleCount} idle trucks available — ${opp.materialType} load at $${opp.budgetPerHour}/hr.`,
        businessImpact: `Potential margin $${opp.estimatedMargin} per haul cycle.`,
        confidence: 82,
        estimatedRoi: opp.estimatedMargin,
        payload: { requestId: opp.id },
        relatedRequestId: opp.id,
      });
    }

    if (ops.complianceWarnings.length > 0) {
      drafts.push({
        externalKey: `renew-insurance-${profile.id}`,
        actionType: "renew_insurance",
        priority: "high",
        title: "Renew or verify insurance documentation",
        description: ops.complianceWarnings.map((w) => w.title).join("; "),
        businessImpact: "Non-compliance blocks bidding and dispatch.",
        confidence: 99,
        estimatedRoi: 0,
        payload: { href: "/account" },
      });
    }

    const unassigned = ops.driverAvailability.unassigned;
    if (unassigned > 0) {
      drafts.push({
        externalKey: `driver-shortage-${profile.id}`,
        actionType: "notify_driver",
        priority: "medium",
        title: `${unassigned} truck(s) without assigned driver`,
        description: "Driver shortage reduces fleet utilization and increases late-delivery risk.",
        businessImpact: `Fleet utilization at ${ops.analytics.fleetUtilization}% — assign drivers to recover capacity.`,
        confidence: 90,
        estimatedRoi: idleCount * 120,
        payload: { unassignedTrucks: unassigned },
      });
    }

    for (const alert of ops.fuelAlerts) {
      drafts.push({
        externalKey: `maintenance-${alert.id}`,
        actionType: "schedule_maintenance",
        priority: "medium",
        title: alert.title,
        description: alert.detail,
        businessImpact: "Equipment compliance affects dispatch eligibility.",
        confidence: 85,
        estimatedRoi: 200,
        payload: { alertId: alert.id },
      });
    }
  }

  if (isCustomer) {
    for (const insight of ops.insights.filter((i) => i.id === "pending-bids")) {
      drafts.push({
        externalKey: `contact-customer-bids-${profile.id}`,
        actionType: "contact_customer",
        priority: "high",
        title: "Review pending bids to secure capacity",
        description: insight.description,
        businessImpact: insight.businessImpact,
        confidence: insight.confidence,
        estimatedRoi: 500,
        payload: { href: "/requests" },
      });
    }

    if (ops.lateJobs.length > 0) {
      for (const job of ops.lateJobs.slice(0, 2)) {
        drafts.push({
          externalKey: `notify-vendor-job-${job.id}`,
          actionType: "notify_vendor",
          priority: "high",
          title: `Contact vendor about late Job #${job.id}`,
          description: `Provider has not checked in for ${job.materialType} haul.`,
          businessImpact: "Proactive outreach reduces project delays.",
          confidence: 92,
          estimatedRoi: 400,
          payload: { jobId: job.id, message: `Please confirm status for Job #${job.id}.` },
          relatedJobId: job.id,
        });
      }
    }
  }

  if (ops.highMarginOpportunities.length > 0 && isProvider) {
    const top = ops.highMarginOpportunities[0]!;
    if (top.budgetPerHour && top.budgetPerHour >= 130) {
      drafts.push({
        externalKey: `increase-rate-request-${top.id}`,
        actionType: "increase_rate",
        priority: "medium",
        title: `Premium rate opportunity: $${top.budgetPerHour}/hr`,
        description: `Load #${top.id} exceeds market average — bid aggressively.`,
        businessImpact: `Est. margin uplift $${top.estimatedMargin}.`,
        confidence: 78,
        estimatedRoi: top.estimatedMargin,
        payload: { requestId: top.id, suggestedRate: top.budgetPerHour },
        relatedRequestId: top.id,
      });
    }
  }

  for (const job of ops.upcomingDeliveries.slice(0, 3)) {
    const sched = new Date(job.scheduledDate);
    const hoursUntil = (sched.getTime() - Date.now()) / 3600000;
    if (hoursUntil > 0 && hoursUntil < 24) {
      drafts.push({
        externalKey: `follow-up-job-${job.id}`,
        actionType: "create_follow_up",
        priority: "low",
        title: `Prepare dispatch for Job #${job.id}`,
        description: `${job.materialType} delivery to ${job.deliveryAddress} in ${Math.round(hoursUntil)}h.`,
        businessImpact: "Pre-dispatch confirmation reduces day-of delays.",
        confidence: 75,
        estimatedRoi: 150,
        payload: { jobId: job.id },
        relatedJobId: job.id,
      });
    }
  }

  return drafts.slice(0, 20);
}

export async function syncRecommendations(profile: ProfileCtx, ops: OperationsCenterPayload) {
  const drafts = generateRecommendationDrafts(profile, ops);
  const created: number[] = [];

  for (const draft of drafts) {
    if (await isDismissed(profile.id, draft.externalKey)) continue;

    const [existing] = await db.select()
      .from(autonomousRecommendationsTable)
      .where(and(
        eq(autonomousRecommendationsTable.profileId, profile.id),
        eq(autonomousRecommendationsTable.externalKey, draft.externalKey),
      ))
      .limit(1);

    if (existing) {
      if (existing.status === "pending") {
        await db.update(autonomousRecommendationsTable)
          .set({
            confidence: draft.confidence,
            estimatedRoi: String(draft.estimatedRoi),
            businessImpact: draft.businessImpact,
            description: draft.description,
            updatedAt: new Date(),
          })
          .where(eq(autonomousRecommendationsTable.id, existing.id));
      }
      continue;
    }

    const [row] = await db.insert(autonomousRecommendationsTable).values({
      profileId: profile.id,
      externalKey: draft.externalKey,
      actionType: draft.actionType,
      priority: draft.priority,
      title: draft.title,
      description: draft.description,
      businessImpact: draft.businessImpact,
      confidence: draft.confidence,
      estimatedRoi: String(draft.estimatedRoi),
      payload: JSON.stringify(draft.payload),
      relatedJobId: draft.relatedJobId,
      relatedRequestId: draft.relatedRequestId,
      relatedTruckId: draft.relatedTruckId,
    }).returning();

    created.push(row!.id);

    await recordTimelineEvent({
      profileId: profile.id,
      eventType: "recommendation_created",
      title: draft.title,
      description: draft.description,
      recommendationId: row!.id,
      metadata: { actionType: draft.actionType, priority: draft.priority, estimatedRoi: draft.estimatedRoi },
    });

    if (draft.estimatedRoi >= 300 && (draft.priority === "critical" || draft.priority === "high")) {
      await maybeNotifyHighValue(profile, draft, row!.id);
    }

    await remember(profile.id, "pattern", draft.actionType, {
      count: 1,
      lastSeen: new Date().toISOString(),
      externalKey: draft.externalKey,
    });
  }

  return created.length;
}

async function maybeNotifyHighValue(profile: ProfileCtx, draft: RecommendationDraft, recommendationId: number) {
  const key = `notified-${draft.externalKey}`;
  if (await isDismissed(profile.id, key)) return;

  await db.insert(activityTable).values({
    profileId: profile.id,
    type: "application_approved",
    description: `AI COO: ${draft.title} — est. ROI $${draft.estimatedRoi}`,
    relatedId: recommendationId,
  });

  await remember(profile.id, "dismissal", key, { notifiedAt: new Date().toISOString() });
}

export async function listRecommendations(profileId: number, statuses: AutonomousRecommendation["status"][] = ["pending", "approved", "modified"]) {
  const rows = await db.select()
    .from(autonomousRecommendationsTable)
    .where(and(
      eq(autonomousRecommendationsTable.profileId, profileId),
      inArray(autonomousRecommendationsTable.status, statuses),
    ))
    .orderBy(desc(autonomousRecommendationsTable.createdAt))
    .limit(50);

  return rows.map(serializeRecommendation);
}

export async function getRecommendation(profileId: number, id: number) {
  const [row] = await db.select()
    .from(autonomousRecommendationsTable)
    .where(and(
      eq(autonomousRecommendationsTable.profileId, profileId),
      eq(autonomousRecommendationsTable.id, id),
    ))
    .limit(1);
  return row ? serializeRecommendation(row) : null;
}

export function serializeRecommendation(row: AutonomousRecommendation) {
  return {
    id: row.id,
    externalKey: row.externalKey,
    actionType: row.actionType,
    priority: row.priority,
    title: row.title,
    description: row.description,
    businessImpact: row.businessImpact,
    confidence: row.confidence,
    estimatedRoi: row.estimatedRoi ? parseFloat(row.estimatedRoi) : 0,
    status: row.status,
    payload: safeJson(row.payload),
    modifiedPayload: row.modifiedPayload ? safeJson(row.modifiedPayload) : null,
    relatedJobId: row.relatedJobId,
    relatedRequestId: row.relatedRequestId,
    relatedTruckId: row.relatedTruckId,
    approvedAt: row.approvedAt?.toISOString() ?? null,
    executedAt: row.executedAt?.toISOString() ?? null,
    rejectionReason: row.rejectionReason,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function safeJson(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export async function countExecutedToday(profileId: number) {
  const items = await db.select()
    .from(autonomousRecommendationsTable)
    .where(and(
      eq(autonomousRecommendationsTable.profileId, profileId),
      eq(autonomousRecommendationsTable.status, "executed"),
    ));
  const dayStart = startOfDay();
  return items.filter((i) => i.executedAt && i.executedAt >= dayStart).length;
}
