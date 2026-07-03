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
