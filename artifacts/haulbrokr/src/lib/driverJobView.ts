import type { Job } from "@workspace/api-client-react";

/** Fields drivers must never see in the UI. */
const DRIVER_REDACTED_KEYS = [
  "customerTotalAmount",
  "platformFeeAmount",
  "platformFeeRate",
  "totalAmount",
  "notes",
] as const;

export type DriverSafeJob = Omit<
  Job,
  (typeof DRIVER_REDACTED_KEYS)[number]
> & {
  /** Estimated driver pay for the load (net work value). */
  driverPay: number;
};

export function computeDriverPay(job: Job): number {
  if (job.providerNetAmount != null && job.providerNetAmount > 0) {
    return job.providerNetAmount;
  }
  const hours = job.totalHours ?? job.estimatedHours ?? 0;
  return Math.round((job.ratePerHour ?? 0) * hours);
}

export function computeDriverHourlyPay(job: Job): number {
  return job.ratePerHour ?? 0;
}

/** Strip broker/customer pricing fields before rendering driver-facing UI. */
export function redactJobForDriver(job: Job): DriverSafeJob {
  const safe = { ...job } as Record<string, unknown>;
  for (const key of DRIVER_REDACTED_KEYS) {
    delete safe[key];
  }
  return {
    ...(safe as Omit<Job, (typeof DRIVER_REDACTED_KEYS)[number]>),
    driverPay: computeDriverPay(job),
  };
}

export type DriverLoadSection = "available" | "accepted" | "in_progress" | "completed";

const ACTIVE_STATUSES = new Set(["awarded", "accepted", "active"]);
const ACCEPTED_STATUSES = new Set(["awarded", "accepted", "active"]);
const IN_PROGRESS_STATUSES = new Set(["in_progress"]);
const COMPLETED_STATUSES = new Set(["completed"]);

export function categorizeDriverJob(
  job: Job,
  assignedJobIds: Set<number>,
): DriverLoadSection | null {
  const assigned = assignedJobIds.has(job.id);

  if (COMPLETED_STATUSES.has(job.status)) {
    return assigned ? "completed" : null;
  }
  if (IN_PROGRESS_STATUSES.has(job.status)) {
    return assigned ? "in_progress" : null;
  }
  if (assigned && ACCEPTED_STATUSES.has(job.status)) {
    return "accepted";
  }
  if (!assigned && ACTIVE_STATUSES.has(job.status)) {
    return "available";
  }
  return null;
}

export function isToday(dateValue: string | Date | null | undefined): boolean {
  if (!dateValue) return false;
  const d = typeof dateValue === "string" ? new Date(dateValue) : dateValue;
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

export function formatDriverPay(amount: number): string {
  return `$${Math.round(amount).toLocaleString("en-US")}`;
}

export function formatDeadline(job: Job): string {
  const date = new Date(job.scheduledDate);
  const dateStr = date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  return job.startTime ? `${dateStr} · ${job.startTime}` : dateStr;
}

export function navigationUrl(address: string): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
}

export type DriverJobFilters = {
  material?: string;
  truckType?: string;
  facility?: string;
  status?: string;
  minPay?: number;
  maxPay?: number;
  maxDeadlineDays?: number;
};

export function applyDriverJobFilters(jobs: DriverSafeJob[], filters: DriverJobFilters): DriverSafeJob[] {
  return jobs.filter((job) => {
    if (filters.material && filters.material !== "all" && job.materialType !== filters.material) return false;
    if (filters.truckType && filters.truckType !== "all" && job.truckType !== filters.truckType) return false;
    if (filters.facility && filters.facility !== "all") {
      const needle = filters.facility.toLowerCase();
      if (!job.deliveryAddress.toLowerCase().includes(needle)) return false;
    }
    if (filters.status && filters.status !== "all" && job.status !== filters.status) return false;
    if (filters.minPay != null && job.driverPay < filters.minPay) return false;
    if (filters.maxPay != null && job.driverPay > filters.maxPay) return false;
    if (filters.maxDeadlineDays != null) {
      const deadline = new Date(job.scheduledDate);
      const diffDays = (deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
      if (diffDays > filters.maxDeadlineDays) return false;
    }
    return true;
  });
}

export function uniqueFilterValues(jobs: DriverSafeJob[]) {
  const materials = [...new Set(jobs.map((j) => j.materialType).filter(Boolean))].sort();
  const truckTypes = [...new Set(jobs.map((j) => j.truckType).filter(Boolean))].sort();
  const facilities = [...new Set(jobs.map((j) => j.deliveryAddress).filter(Boolean))].sort();
  return { materials, truckTypes, facilities };
}

export function jobProgressPercent(status: string): number {
  switch (status) {
    case "awarded":
    case "accepted":
      return 15;
    case "active":
      return 30;
    case "in_progress":
      return 65;
    case "completed":
      return 100;
    default:
      return 0;
  }
}

/** Production timeline steps for Driver Job Detail (Package 3). */
export const DRIVER_LIVE_PROGRESS_STEPS = [
  { key: "accepted", label: "Accepted" },
  { key: "en_route", label: "Driving to Pickup" },
  { key: "checked_in_pickup", label: "Checked In" },
  { key: "loading", label: "Loading" },
  { key: "driving_facility", label: "Driving to Facility" },
  { key: "checked_in_facility", label: "Checked In Facility" },
  { key: "unload", label: "Unload" },
  { key: "pod_uploaded", label: "POD Uploaded" },
  { key: "broker_approved", label: "Broker Approved" },
  { key: "payment_pending", label: "Payment Pending" },
  { key: "completed", label: "Completed" },
] as const;

export type DriverProgressStepKey = (typeof DRIVER_LIVE_PROGRESS_STEPS)[number]["key"];

type StatusUpdateLike = { status: string };
type TicketLike = { clockedInAt?: string | null; clockedOutAt?: string | null; photoUrl?: string | null; verifiedAt?: string | null };
type EvidenceLike = { photoUrl?: string | null; siteNotes?: string | null };
type JobProgressInput = {
  status: string;
  completionApproval?: string | null;
  paymentStatus?: string | null;
};

export function resolveDriverProgress(
  job: JobProgressInput,
  statusUpdates: StatusUpdateLike[],
  myTicket: TicketLike | null | undefined,
  evidence: EvidenceLike[],
): { completedKeys: Set<DriverProgressStepKey>; currentKey: DriverProgressStepKey } {
  const reachedStatuses = new Set(statusUpdates.map((u) => u.status));
  const completedKeys = new Set<DriverProgressStepKey>();

  const accepted =
    job.status === "accepted" ||
    job.status === "active" ||
    job.status === "awarded" ||
    job.status === "in_progress" ||
    job.status === "completed";
  if (accepted) completedKeys.add("accepted");

  if (reachedStatuses.has("en_route")) completedKeys.add("en_route");
  if (reachedStatuses.has("arrived") || reachedStatuses.has("checked_in") || !!myTicket?.clockedInAt) {
    completedKeys.add("checked_in_pickup");
  }
  if (reachedStatuses.has("loading")) completedKeys.add("loading");
  if (reachedStatuses.has("loaded")) completedKeys.add("driving_facility");
  if (reachedStatuses.has("dumping")) completedKeys.add("checked_in_facility");
  if (reachedStatuses.has("started") || !!myTicket?.clockedOutAt) completedKeys.add("unload");
  if (
    reachedStatuses.has("photo_uploaded") ||
    reachedStatuses.has("ticket_uploaded") ||
    evidence.some((e) => !!e.photoUrl)
  ) {
    completedKeys.add("pod_uploaded");
  }
  if (job.completionApproval === "approved") completedKeys.add("broker_approved");
  if (
    job.status === "completed" &&
    job.paymentStatus &&
    !["paid", "released"].includes(job.paymentStatus)
  ) {
    completedKeys.add("payment_pending");
  }
  if (job.status === "completed") completedKeys.add("completed");

  const currentKey =
    DRIVER_LIVE_PROGRESS_STEPS.find((step) => !completedKeys.has(step.key))?.key ??
    "completed";

  return { completedKeys, currentKey };
}

export function liveProgressPercent(completedKeys: Set<DriverProgressStepKey>): number {
  const done = DRIVER_LIVE_PROGRESS_STEPS.filter((s) => completedKeys.has(s.key)).length;
  return Math.round((done / DRIVER_LIVE_PROGRESS_STEPS.length) * 100);
}

export type DumpSiteLike = {
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  type?: string;
  phone?: string | null;
  fullAddress?: string;
};

/** Best-effort match of delivery address to dump-site directory. */
export function matchDumpSiteForAddress(deliveryAddress: string, sites: DumpSiteLike[]): DumpSiteLike | null {
  const needle = deliveryAddress.toLowerCase().replace(/[^a-z0-9\s]/g, " ");
  if (!needle.trim()) return null;

  let best: DumpSiteLike | null = null;
  let bestScore = 0;

  for (const site of sites) {
    const hay = `${site.name} ${site.address} ${site.city} ${site.state} ${site.zip}`.toLowerCase();
    let score = 0;
    for (const token of needle.split(/\s+/).filter((t) => t.length > 3)) {
      if (hay.includes(token)) score += 1;
    }
    if (site.fullAddress && needle.includes(site.name.toLowerCase())) score += 3;
    if (score > bestScore) {
      bestScore = score;
      best = site;
    }
  }

  return bestScore >= 2 ? best : null;
}

export function computeRemainingTime(scheduledDate: string, startTime?: string | null): string {
  try {
    const base = new Date(scheduledDate);
    if (startTime) {
      const [h, m] = startTime.split(":").map(Number);
      if (!Number.isNaN(h)) base.setHours(h, m ?? 0, 0, 0);
    }
    const diffMs = base.getTime() - Date.now();
    if (diffMs <= 0) return "Past deadline";
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    if (hours >= 24) return `${Math.floor(hours / 24)}d ${hours % 24}h remaining`;
    if (hours > 0) return `${hours}h ${mins}m remaining`;
    return `${mins}m remaining`;
  } catch {
    return "—";
  }
}

export type DriverEarningsBreakdown = {
  driverPay: number;
  bonus: number;
  waitingTime: number;
  fuelAdjustment: number;
  currentTotal: number;
};

/** Driver-visible earnings only — no customer or broker fields. */
export function computeDriverEarningsBreakdown(job: Job): DriverEarningsBreakdown {
  const driverPay = computeDriverPay(job);
  return {
    driverPay,
    bonus: 0,
    waitingTime: 0,
    fuelAdjustment: 0,
    currentTotal: driverPay,
  };
}

export type DriverDocumentKind =
  | "load_ticket"
  | "scale_ticket"
  | "bill_of_lading"
  | "proof_of_delivery"
  | "delivery_photos";

export type DriverDocumentCard = {
  kind: DriverDocumentKind;
  title: string;
  status: "missing" | "uploaded" | "verified" | "placeholder";
  verificationStatus: string;
  previewUrl?: string | null;
  uploadAnchor: string;
};

export function buildDriverDocumentCards(
  tickets: TicketLike[],
  evidence: EvidenceLike[],
): DriverDocumentCard[] {
  const loadTicket = tickets.find((t) => !!t.photoUrl);
  const hasPod = evidence.some((e) => !!e.photoUrl);
  const verifiedTicket = tickets.find((t) => !!t.verifiedAt);

  return [
    {
      kind: "load_ticket",
      title: "Load Ticket",
      status: loadTicket?.photoUrl ? (verifiedTicket ? "verified" : "uploaded") : "missing",
      verificationStatus: verifiedTicket ? "Verified" : loadTicket?.photoUrl ? "Pending review" : "Not uploaded",
      previewUrl: loadTicket?.photoUrl,
      uploadAnchor: "#load-ticket-upload",
    },
    {
      kind: "scale_ticket",
      title: "Scale Ticket",
      status: "placeholder",
      verificationStatus: "Awaiting design — no dedicated API field",
      uploadAnchor: "#scale-ticket-upload",
    },
    {
      kind: "bill_of_lading",
      title: "Bill of Lading",
      status: "placeholder",
      verificationStatus: "Awaiting design — no dedicated API field",
      uploadAnchor: "#bol-upload",
    },
    {
      kind: "proof_of_delivery",
      title: "Proof of Delivery",
      status: hasPod ? "uploaded" : "missing",
      verificationStatus: hasPod ? "Pending review" : "Not uploaded",
      previewUrl: evidence.find((e) => e.photoUrl)?.photoUrl,
      uploadAnchor: "#pod-upload",
    },
    {
      kind: "delivery_photos",
      title: "Delivery Photos",
      status: hasPod ? "uploaded" : "missing",
      verificationStatus: hasPod ? `${evidence.filter((e) => e.photoUrl).length} photo(s)` : "Not uploaded",
      previewUrl: evidence.find((e) => e.photoUrl)?.photoUrl,
      uploadAnchor: "#photos-upload",
    },
  ];
}

export function filterActivityForJob<T extends { relatedId?: number | null; type: string }>(
  activities: T[] | undefined,
  jobId: number,
): T[] {
  return (activities ?? []).filter(
    (a) =>
      a.relatedId === jobId ||
      a.type.includes("job") ||
      a.type.includes("ticket") ||
      a.type.includes("payout"),
  );
}
