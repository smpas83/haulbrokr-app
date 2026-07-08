import type { Job, JobStatus } from "@/context/AppContext";

export type LiveJob = {
  id: number;
  status: string;
  materialType?: string | null;
  pickupAddress?: string | null;
  deliveryAddress?: string | null;
  ratePerHour?: number | null;
  trucksAssigned?: number | null;
  scheduledDate?: string | Date | null;
  startedAt?: string | Date | null;
  completedAt?: string | Date | null;
  createdAt?: string | Date | null;
  customerId?: number | null;
  providerId?: number | null;
  customerCompany?: string | null;
  providerCompany?: string | null;
  totalHours?: number | null;
  totalAmount?: number | null;
  notes?: string | null;
  paymentStatus?: string | null;
  [key: string]: unknown;
};

const STATUS_MAP: Record<string, JobStatus> = {
  active: "accepted",
  in_progress: "in_progress",
  completed: "completed",
  cancelled: "cancelled",
};

function toDateStr(value: string | Date | null | undefined): string {
  if (!value) return "";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().split("T")[0];
}

/**
 * Maps a live `/jobs` API record (numeric id, payment fields) onto the
 * demo `Job` display shape so the existing job UI can render real data.
 * Fields the live API does not track (quantity, distances, bids, demo
 * chat/tickets) are left empty; callers should treat such a job as a live
 * job and hide demo-only interactive sections.
 */
export type LiveRequest = {
  id: number;
  status: string;
  materialType?: string | null;
  quantityTons?: number | null;
  pickupAddress?: string | null;
  deliveryAddress?: string | null;
  budgetPerHour?: number | null;
  trucksNeeded?: number | null;
  scheduledDate?: string | Date | null;
  createdAt?: string | Date | null;
  customerCompany?: string | null;
  bidCount?: number | null;
  notes?: string | null;
  [key: string]: unknown;
};

const REQUEST_STATUS_MAP: Record<string, JobStatus> = {
  open: "open",
  bidding: "bidding",
  accepted: "accepted",
  in_progress: "in_progress",
  completed: "completed",
  cancelled: "cancelled",
};

/** Human-friendly material label for a lowercase API materialType enum value. */
function materialLabel(material: string | null | undefined): string {
  if (!material) return "Material";
  return material.charAt(0).toUpperCase() + material.slice(1);
}

/**
 * Maps a live `/requests` API record onto the demo `Job` display shape so the
 * jobs list can render a customer's posted load requests alongside accepted
 * jobs. A request has no assigned provider yet, so provider/payment fields are
 * left empty. The numeric id is prefixed with `req-` so it never collides with
 * a live job id and callers can detect a request-backed card.
 */
export function liveRequestToViewJob(live: LiveRequest): Job {
  const rate = live.budgetPerHour ?? 0;
  return {
    id: `req-${live.id}`,
    projectName: live.materialType
      ? `${materialLabel(live.materialType)} Haul`
      : `Request #${live.id}`,
    projectType: "Transport",
    material: materialLabel(live.materialType),
    quantity: live.quantityTons ?? 0,
    quantityUnit: "tons",
    pickupAddress: live.pickupAddress ?? "",
    deliveryAddress: live.deliveryAddress ?? "",
    budgetPerHour: rate,
    preferredRate: rate,
    status: REQUEST_STATUS_MAP[live.status] ?? "open",
    trucksNeeded: live.trucksNeeded ?? 1,
    scheduledDate: toDateStr(live.scheduledDate),
    endDate: toDateStr(live.scheduledDate),
    postedAt: toDateStr(live.createdAt),
    postedBy: live.customerCompany ?? "Customer",
    bidsCount: live.bidCount ?? 0,
    providerSupplies: false,
    distanceToStart: 0,
    distanceToEnd: 0,
    notes: live.notes ?? undefined,
    bids: [],
    messages: [],
    loadTickets: [],
  };
}

export type LiveActivity = {
  id: number;
  type:
    | "request_posted"
    | "bid_placed"
    | "bid_accepted"
    | "job_started"
    | "job_completed"
    | "payment_failed"
    | "payment_requires_action"
    | "application_approved"
    | "application_rejected"
    | "payout_delayed"
    | "bin_confirmed"
    | "bin_delivered"
    | "bin_picked_up"
    | "bin_cancelled";
  description: string;
  relatedId?: number | null;
  relatedBinOrderId?: string | null;
  createdAt: string | Date;
};

export type ActivityView = {
  id: string;
  icon: string;
  text: string;
  time: string;
  type: "bid" | "job" | "bin" | "payment" | "alert";
  /** Bin order this entry links to, if any (uuid). Drives deep-linking. */
  binOrderId?: string | null;
};

const ACTIVITY_ICON: Record<LiveActivity["type"], string> = {
  request_posted: "plus-circle",
  bid_placed: "trending-up",
  bid_accepted: "check-circle",
  job_started: "truck",
  job_completed: "check-circle",
  payment_failed: "alert-circle",
  payment_requires_action: "alert-circle",
  application_approved: "check-circle",
  application_rejected: "x-circle",
  payout_delayed: "alert-circle",
  bin_confirmed: "check-circle",
  bin_delivered: "package",
  bin_picked_up: "truck",
  bin_cancelled: "x-circle",
};

const ACTIVITY_CATEGORY: Record<LiveActivity["type"], ActivityView["type"]> = {
  request_posted: "job",
  bid_placed: "bid",
  bid_accepted: "bid",
  job_started: "job",
  job_completed: "job",
  payment_failed: "alert",
  payment_requires_action: "alert",
  application_approved: "alert",
  application_rejected: "alert",
  payout_delayed: "alert",
  bin_confirmed: "bin",
  bin_delivered: "bin",
  bin_picked_up: "bin",
  bin_cancelled: "bin",
};

/** Compact "x ago" label from a timestamp; falls back to "" on bad input. */
export function relativeTime(value: string | Date | null | undefined): string {
  if (!value) return "";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  const diffMs = Date.now() - date.getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** Maps a live `/dashboard/activity` record onto the demo activity feed shape. */
export function liveActivityToView(a: LiveActivity): ActivityView {
  return {
    id: `act-${a.id}`,
    icon: ACTIVITY_ICON[a.type] ?? "activity",
    text: a.description,
    time: relativeTime(a.createdAt),
    type: ACTIVITY_CATEGORY[a.type] ?? "job",
    binOrderId: a.relatedBinOrderId ?? null,
  };
}

export function liveJobToViewJob(live: LiveJob): Job {
  const rate = live.ratePerHour ?? 0;
  return {
    id: String(live.id),
    projectName: live.materialType
      ? `${live.materialType} Haul`
      : `Job #${live.id}`,
    projectType: "Transport",
    material: live.materialType ?? "Material",
    quantity: 0,
    quantityUnit: "tons",
    pickupAddress: live.pickupAddress ?? "",
    deliveryAddress: live.deliveryAddress ?? "",
    budgetPerHour: rate,
    preferredRate: rate,
    status: STATUS_MAP[live.status] ?? "accepted",
    trucksNeeded: live.trucksAssigned ?? 1,
    scheduledDate: toDateStr(live.scheduledDate),
    endDate: toDateStr(live.completedAt ?? live.scheduledDate),
    postedAt: toDateStr(live.createdAt),
    postedBy: live.customerCompany ?? "Customer",
    bidsCount: 0,
    providerSupplies: false,
    distanceToStart: 0,
    distanceToEnd: 0,
    notes: live.notes ?? undefined,
    bids: [],
    providerCompany: live.providerCompany ?? undefined,
    messages: [],
    loadTickets: [],
  };
}
