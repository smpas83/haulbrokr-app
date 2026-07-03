import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  useGetDashboardStats,
  useGetDashboardActivity,
  useListJobs,
  useListDumpSites,
  useListRequests,
  type Job,
} from "@workspace/api-client-react";
import {
  isActiveJob,
  isToday,
  countOpenInvoices,
  sumTonsDeliveredToday,
  computeOnTimePercent,
  countTrucksEnRoute,
} from "@/lib/customerJobView";

async function fetchJobTickets(jobId: number) {
  const res = await fetch(`/api/jobs/${jobId}/tickets`);
  if (!res.ok) throw new Error("Failed to fetch tickets");
  return res.json();
}

async function fetchJobEvidence(jobId: number) {
  const res = await fetch(`/api/jobs/${jobId}/evidence`);
  if (!res.ok) throw new Error("Failed to fetch evidence");
  return res.json();
}

export function useCustomerDashboardData() {
  const statsQuery = useGetDashboardStats();
  const activityQuery = useGetDashboardActivity();
  const jobsQuery = useListJobs();
  const facilitiesQuery = useListDumpSites();
  const requestsQuery = useListRequests();

  const jobs = jobsQuery.data ?? [];

  const activeJobs = useMemo(
    () => jobs.filter((j) => isActiveJob(j)),
    [jobs]
  );

  const completedToday = useMemo(
    () => jobs.filter((j) => j.status === "completed" && isToday(j.completedAt ?? j.scheduledDate)),
    [jobs]
  );

  const mapTrucks = useMemo(
    () =>
      activeJobs.flatMap((j) =>
        Array.from({ length: j.trucksAssigned ?? 1 }, (_, i) => ({
          id: j.id * 100 + i,
          label: `${j.providerCompany} · JOB-${String(j.id).padStart(4, "0")}`,
          isAvailable: false,
        }))
      ),
    [activeJobs]
  );

  const kpis = useMemo(() => {
    const stats = statsQuery.data;
    return {
      activeJobs: stats?.activeJobs ?? activeJobs.length,
      trucksEnRoute: countTrucksEnRoute(jobs),
      completedToday: completedToday.length,
      tonsDelivered: sumTonsDeliveredToday(jobs),
      openInvoices: countOpenInvoices(jobs),
      averageEta: "—", // PLACEHOLDER: ETA aggregation API pending
      activeFacilities: (facilitiesQuery.data ?? []).filter((f) => f.isActive).length,
      onTimeDelivery: computeOnTimePercent(jobs),
    };
  }, [statsQuery.data, activeJobs.length, jobs, completedToday.length, facilitiesQuery.data]);

  const lastRequest = useMemo(() => {
    const reqs = requestsQuery.data ?? [];
    return reqs.length > 0 ? reqs[0] : null;
  }, [requestsQuery.data]);

  const isLoading =
    statsQuery.isLoading ||
    jobsQuery.isLoading ||
    activityQuery.isLoading ||
    facilitiesQuery.isLoading;

  const isError =
    statsQuery.isError ||
    jobsQuery.isError ||
    activityQuery.isError ||
    facilitiesQuery.isError;

  const refetchAll = () => {
    statsQuery.refetch();
    activityQuery.refetch();
    jobsQuery.refetch();
    facilitiesQuery.refetch();
    requestsQuery.refetch();
  };

  return {
    statsQuery,
    activityQuery,
    jobsQuery,
    facilitiesQuery,
    requestsQuery,
    activeJobs,
    completedToday,
    mapTrucks,
    kpis,
    lastRequest,
    isLoading,
    isError,
    refetchAll,
  };
}

export function useCustomerTimeline(jobs: Job[]) {
  const timelineJobs = jobs.slice(0, 6);

  return useQuery({
    queryKey: ["customer-timeline", timelineJobs.map((j) => j.id).join(",")],
    queryFn: async () => {
      const groups = await Promise.all(
        timelineJobs.map(async (job) => {
          try {
            const res = await fetch(`/api/jobs/${job.id}/status-updates`);
            if (!res.ok) return { job, updates: [] };
            const updates = await res.json();
            return { job, updates: updates ?? [] };
          } catch {
            return { job, updates: [] };
          }
        })
      );
      return groups;
    },
    enabled: timelineJobs.length > 0,
    staleTime: 30_000,
  });
}

export function useCustomerDocuments(jobs: Job[]) {
  const docJobs = jobs.slice(0, 5);

  return useQuery({
    queryKey: ["customer-documents", docJobs.map((j) => j.id).join(",")],
    queryFn: async () => {
      const results: Array<{
        jobId: number;
        jobLabel: string;
        type: "pod" | "scale_ticket" | "bol" | "photo";
        label: string;
        url?: string;
        createdAt?: string;
      }> = [];

      await Promise.all(
        docJobs.map(async (job) => {
          const jobLabel = `JOB-${String(job.id).padStart(4, "0")}`;
          try {
            const [ticketData, evidenceData] = await Promise.all([
              fetchJobTickets(job.id).catch(() => ({ tickets: [] })),
              fetchJobEvidence(job.id).catch(() => []),
            ]);

            const tickets = (ticketData?.tickets ?? []) as Array<{
              id: number;
              photoUrl?: string;
              weightTons?: number;
              createdAt?: string;
            }>;

            tickets.forEach((t) => {
              if (t.photoUrl) {
                results.push({
                  jobId: job.id,
                  jobLabel,
                  type: "scale_ticket",
                  label: `Scale Ticket · ${t.weightTons ?? "—"} tons`,
                  url: t.photoUrl,
                  createdAt: t.createdAt,
                });
              }
            });

            const evidence = (evidenceData ?? []) as Array<{
              id: number;
              photoUrl?: string;
              photoCaption?: string;
              createdAt?: string;
            }>;

            evidence.forEach((e) => {
              if (e.photoUrl) {
                results.push({
                  jobId: job.id,
                  jobLabel,
                  type: e.photoCaption?.toLowerCase().includes("bol") ? "bol" : "pod",
                  label: e.photoCaption || "Proof of Delivery",
                  url: e.photoUrl,
                  createdAt: e.createdAt,
                });
                results.push({
                  jobId: job.id,
                  jobLabel,
                  type: "photo",
                  label: e.photoCaption || "Site Photo",
                  url: e.photoUrl,
                  createdAt: e.createdAt,
                });
              }
            });
          } catch {
            // Best-effort document aggregation
          }
        })
      );

      return results
        .sort((a, b) => {
          const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return tb - ta;
        })
        .slice(0, 8);
    },
    enabled: docJobs.length > 0,
    staleTime: 60_000,
  });
}

export function useUnreadNotificationCount() {
  const { data: activities } = useGetDashboardActivity();
  // Reuses existing notification engine (activity feed) — no separate unread API
  const unreadTypes = new Set([
    "payment_requires_action",
    "payment_failed",
    "job_started",
    "job_completed",
    "bid_accepted",
    "bin_delivered",
    "bin_confirmed",
  ]);
  return useMemo(
    () => (activities ?? []).filter((a) => unreadTypes.has(a.type)).length,
    [activities]
  );
}
