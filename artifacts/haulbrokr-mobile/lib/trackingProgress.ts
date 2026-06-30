import type { JobStatusUpdate } from "@/hooks/useLiveApi";

export type TrackingProgressState = {
  progressPct: number;
  etaMinutes: number;
  label: string;
};

const STATUS_STATE: Record<string, TrackingProgressState> = {
  awarded: { progressPct: 5, etaMinutes: 45, label: "Awaiting Acceptance" },
  accepted: { progressPct: 10, etaMinutes: 40, label: "Accepted" },
  active: { progressPct: 15, etaMinutes: 38, label: "Active" },
  in_progress: { progressPct: 28, etaMinutes: 34, label: "In Progress" },
  completed: { progressPct: 100, etaMinutes: 0, label: "Completed" },
  released: { progressPct: 100, etaMinutes: 0, label: "Completed" },
  en_route: { progressPct: 18, etaMinutes: 36, label: "En Route" },
  arrived: { progressPct: 32, etaMinutes: 28, label: "Arrived" },
  loading: { progressPct: 48, etaMinutes: 22, label: "Loading" },
  loaded: { progressPct: 66, etaMinutes: 16, label: "Loaded" },
  dumping: { progressPct: 84, etaMinutes: 8, label: "Dumping" },
};

function newestStatus(updates: JobStatusUpdate[]): string | null {
  if (updates.length === 0) return null;
  return updates.reduce((latest, update) => {
    const latestTime = Date.parse(latest.createdAt);
    const updateTime = Date.parse(update.createdAt);
    return updateTime >= latestTime ? update : latest;
  }).status;
}

export function trackingProgressFromTimeline(
  jobStatus: string | null | undefined,
  updates: JobStatusUpdate[],
): TrackingProgressState {
  const status = newestStatus(updates) ?? jobStatus ?? "in_progress";
  return STATUS_STATE[status] ?? STATUS_STATE.in_progress;
}
