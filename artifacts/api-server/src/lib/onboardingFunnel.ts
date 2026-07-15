/**
 * Pure helpers for Admin Onboarding Center funnel classification.
 * Kept separate from DB I/O so unit tests do not need Neon.
 */

export type OnboardingFunnelFilter =
  | "all"
  | "registered_only"
  | "incomplete"
  | "waiting_documents"
  | "pending_review"
  | "approved"
  | "stalled";

export type OnboardingFunnelStage =
  | "new_registration"
  | "setup_started"
  | "waiting_documents"
  | "waiting_approval"
  | "approved"
  | "stalled";

export type OnboardingTimelineEventType =
  | "signup"
  | "email_verified"
  | "company_profile_saved"
  | "equipment_added"
  | "upload_requested"
  | "r2_upload_completed"
  | "database_finalized"
  | "admin_viewed"
  | "approved"
  | "rejected";

export interface OnboardingTimelineEvent {
  type: OnboardingTimelineEventType;
  label: string;
  at: string | null;
  status: "complete" | "pending" | "missing" | "rejected";
  detail?: string | null;
}

export interface FunnelInput {
  profileComplete: boolean;
  truckAdded: boolean;
  hasAnyDocumentOrForm: boolean;
  hasPendingReview: boolean;
  isApproved: boolean;
  canBid: boolean;
  lastActivityIso: string;
  nowMs?: number;
  stalledHours?: number;
}

const STALL_MS = 24 * 60 * 60 * 1000;

/** Classify carrier into a single ops funnel stage. */
export function classifyFunnelStage(input: FunnelInput): OnboardingFunnelStage {
  const now = input.nowMs ?? Date.now();
  const last = Date.parse(input.lastActivityIso);
  const stalled =
    Number.isFinite(last)
    && now - last > (input.stalledHours ? input.stalledHours * 3600_000 : STALL_MS)
    && !input.isApproved
    && !input.canBid;

  if (input.isApproved || input.canBid) return "approved";
  if (input.hasPendingReview) return stalled ? "stalled" : "waiting_approval";
  if (input.hasAnyDocumentOrForm) return stalled ? "stalled" : "waiting_documents";
  if (input.profileComplete || input.truckAdded) return stalled ? "stalled" : "setup_started";
  return stalled ? "stalled" : "new_registration";
}

export function matchesFunnelFilter(
  stage: OnboardingFunnelStage,
  filter: OnboardingFunnelFilter,
  opts: { isApproved: boolean; profileComplete: boolean; truckAdded: boolean; hasDocs: boolean },
): boolean {
  switch (filter) {
    case "all":
      return true;
    case "registered_only":
      return !opts.profileComplete && !opts.truckAdded && !opts.hasDocs;
    case "incomplete":
      return !opts.isApproved;
    case "waiting_documents":
      return stage === "waiting_documents";
    case "pending_review":
      return stage === "waiting_approval";
    case "approved":
      return stage === "approved" || opts.isApproved;
    case "stalled":
      return stage === "stalled";
    default:
      return true;
  }
}

export function completionPercent(stepsComplete: number, stepsTotal: number): number {
  if (stepsTotal <= 0) return 0;
  return Math.round((stepsComplete / stepsTotal) * 100);
}

export function buildTimeline(events: Array<{
  type: OnboardingTimelineEventType;
  label: string;
  at: string | null | undefined;
  status?: OnboardingTimelineEvent["status"];
  detail?: string | null;
}>): OnboardingTimelineEvent[] {
  return events.map((e) => ({
    type: e.type,
    label: e.label,
    at: e.at ?? null,
    status: e.status ?? (e.at ? "complete" : "missing"),
    detail: e.detail ?? null,
  }));
}
