import type { Job } from "@workspace/api-client-react";

export interface CustomerJobView {
  id: number;
  requestId: number;
  status: string;
  materialType: string;
  truckType: string;
  trucksAssigned: number;
  pickupAddress: string;
  deliveryAddress: string;
  scheduledDate: string;
  startTime: string;
  providerCompany: string;
  paymentStatus?: string;
  invoicedAt?: string | null;
  completedAt?: string | null;
  /** Driver/provider label for display — no pay fields exposed */
  driverLabel: string;
}

const ACTIVE_STATUSES = new Set(["awarded", "accepted", "active", "in_progress"]);

export function isActiveJob(job: Job): boolean {
  return ACTIVE_STATUSES.has(job.status);
}

export function isToday(dateStr: string | null | undefined): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

export function formatJobEta(job: Pick<Job, "scheduledDate" | "startTime">): string | null {
  if (!job.scheduledDate) return null;
  const d = new Date(job.scheduledDate);
  if (Number.isNaN(d.getTime())) return null;
  const [h, m] = (job.startTime ?? "08:00").split(":").map(Number);
  d.setHours(h ?? 8, m ?? 0, 0, 0);
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

/** Strip pricing and provider-internal fields from job cards shown on customer dashboard */
export function redactJobForCustomer(job: Job): CustomerJobView {
  return {
    id: job.id,
    requestId: job.requestId,
    status: job.status,
    materialType: job.materialType,
    truckType: job.truckType,
    trucksAssigned: job.trucksAssigned,
    pickupAddress: job.pickupAddress,
    deliveryAddress: job.deliveryAddress,
    scheduledDate: job.scheduledDate,
    startTime: job.startTime,
    providerCompany: job.providerCompany,
    paymentStatus: job.paymentStatus,
    invoicedAt: job.invoicedAt,
    completedAt: job.completedAt,
    driverLabel: job.providerCompany,
  };
}

export function countOpenInvoices(jobs: Job[]): number {
  return jobs.filter(
    (j) =>
      j.invoicedAt &&
      j.paymentStatus !== "paid" &&
      j.paymentStatus !== "released"
  ).length;
}

export function sumTonsDeliveredToday(jobs: Job[]): number {
  // PLACEHOLDER: aggregate tonnage API pending — estimate from completed jobs today
  return jobs.filter((j) => j.status === "completed" && isToday(j.completedAt ?? j.scheduledDate)).length;
}

export function computeOnTimePercent(jobs: Job[]): string {
  const completed = jobs.filter((j) => j.status === "completed");
  if (completed.length === 0) return "—";
  // PLACEHOLDER: on-time delivery API pending — use completed count as proxy
  const onTime = completed.filter((j) => j.completedAt).length;
  return `${Math.round((onTime / completed.length) * 100)}%`;
}

export function countTrucksEnRoute(jobs: Job[]): number {
  return jobs
    .filter((j) => isActiveJob(j))
    .reduce((sum, j) => sum + (j.trucksAssigned ?? 0), 0);
}
