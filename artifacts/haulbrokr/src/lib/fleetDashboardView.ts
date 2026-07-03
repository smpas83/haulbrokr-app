import type { Job, Truck } from "@workspace/api-client-react";

const ACTIVE_JOB_STATUSES = new Set(["awarded", "accepted", "active", "in_progress"]);

export function isActiveJob(job: Job): boolean {
  return ACTIVE_JOB_STATUSES.has(job.status);
}

export function isToday(dateStr: string | Date | null | undefined): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

export function isThisWeek(dateStr: string | Date | null | undefined): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  weekStart.setHours(0, 0, 0, 0);
  return d >= weekStart;
}

export function isThisMonth(dateStr: string | Date | null | undefined): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

export function computeFleetUtilization(trucks: Truck[], activeJobs: Job[]): number {
  if (trucks.length === 0) return 0;
  const trucksInUse = trucks.filter((t) => !t.isAvailable).length;
  const activeTruckSlots = activeJobs.reduce((sum, j) => sum + (j.trucksAssigned ?? 0), 0);
  const utilized = Math.max(trucksInUse, Math.min(activeTruckSlots, trucks.length));
  return Math.round((utilized / trucks.length) * 100);
}

export function computeComplianceScore(statuses: {
  w9Status?: string;
  insuranceStatus?: string;
  dotCdlStatus?: string;
  payoutStatus?: string;
}): string {
  const fields = [
    statuses.w9Status,
    statuses.insuranceStatus,
    statuses.dotCdlStatus,
    statuses.payoutStatus,
  ].filter(Boolean);

  if (fields.length === 0) return "—";

  const verified = fields.filter((s) => s === "verified").length;
  return `${Math.round((verified / fields.length) * 100)}%`;
}

export function countPendingInvoices(jobs: Job[]): number {
  return jobs.filter(
    (j) => j.invoicedAt && j.paymentStatus !== "paid" && j.paymentStatus !== "released"
  ).length;
}

export function formatCurrency(amount: number): string {
  return `$${amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function getTruckStatusLabel(truck: Truck): string {
  return truck.isAvailable ? "Available" : "In Use";
}

export function getDriverStatusFromJob(job: Job | undefined): string {
  if (!job) return "Unavailable";
  switch (job.status) {
    case "in_progress":
      return "Driving";
    case "active":
    case "accepted":
      return "Online";
    case "awarded":
      return "At Facility";
    default:
      return "Off Duty";
  }
}

export function findActiveJobForTruck(truck: Truck, jobs: Job[]): Job | undefined {
  if (!truck.isAvailable) {
    return jobs.find((j) => isActiveJob(j));
  }
  return undefined;
}
