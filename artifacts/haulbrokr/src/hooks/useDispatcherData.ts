import { useMemo } from "react";
import {
  useGetDashboardStats,
  useGetDashboardActivity,
  useListJobs,
  useListTrucks,
  useListOrgMembers,
  useListDumpSites,
  type Job,
} from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";

async function fetchJobTickets(jobId: number) {
  const res = await fetch(`/api/jobs/${jobId}/tickets`);
  if (!res.ok) throw new Error("Failed to fetch tickets");
  return res.json();
}

export function useDispatcherData() {
  const statsQuery = useGetDashboardStats();
  const activityQuery = useGetDashboardActivity();
  const jobsQuery = useListJobs();
  const trucksQuery = useListTrucks();
  const membersQuery = useListOrgMembers();
  const facilitiesQuery = useListDumpSites();

  const activeJobs = useMemo(
    () =>
      (jobsQuery.data ?? []).filter((j) =>
        ["awarded", "accepted", "active", "in_progress"].includes(j.status)
      ),
    [jobsQuery.data]
  );

  const pendingDispatchJobs = useMemo(
    () => activeJobs.filter((j) => j.status === "awarded" || j.status === "accepted"),
    [activeJobs]
  );

  const availableTrucks = useMemo(
    () => (trucksQuery.data ?? []).filter((t) => t.isAvailable),
    [trucksQuery.data]
  );

  const drivers = useMemo(
    () => (membersQuery.data?.members ?? []).filter((m) => m.role === "driver"),
    [membersQuery.data]
  );

  const kpis = useMemo(() => {
    const stats = statsQuery.data;
    return {
      availableTrucks: availableTrucks.length,
      driversOnline: drivers.length, // PLACEHOLDER: no live presence API yet
      activeJobs: stats?.activeJobs ?? activeJobs.length,
      pendingDispatch: pendingDispatchJobs.length,
      revenueToday: stats?.totalRevenue ?? 0, // PLACEHOLDER: daily revenue API pending
      loadsToday: stats?.completedJobs ?? 0, // PLACEHOLDER: daily loads API pending
      averageEta: "—", // PLACEHOLDER: ETA aggregation API pending
      paperworkCompletion: "—", // PLACEHOLDER: paperwork completion API pending
    };
  }, [statsQuery.data, availableTrucks.length, drivers.length, activeJobs.length, pendingDispatchJobs.length]);

  const mapTrucks = useMemo(
    () =>
      (trucksQuery.data ?? []).map((t) => ({
        id: t.id,
        label: t.truckNumber || t.licensePlate || `Truck #${t.id}`,
        isAvailable: t.isAvailable,
      })),
    [trucksQuery.data]
  );

  const isLoading =
    statsQuery.isLoading ||
    jobsQuery.isLoading ||
    trucksQuery.isLoading ||
    membersQuery.isLoading;

  const isError =
    statsQuery.isError ||
    jobsQuery.isError ||
    trucksQuery.isError ||
    membersQuery.isError;

  const refetchAll = () => {
    statsQuery.refetch();
    activityQuery.refetch();
    jobsQuery.refetch();
    trucksQuery.refetch();
    membersQuery.refetch();
    facilitiesQuery.refetch();
  };

  return {
    statsQuery,
    activityQuery,
    jobsQuery,
    trucksQuery,
    membersQuery,
    facilitiesQuery,
    activeJobs,
    pendingDispatchJobs,
    availableTrucks,
    drivers,
    kpis,
    mapTrucks,
    isLoading,
    isError,
    refetchAll,
  };
}

export function useDispatchQueueTickets(jobs: Job[]) {
  return useQuery({
    queryKey: ["dispatcher-queue-tickets", jobs.map((j) => j.id).join(",")],
    queryFn: async () => {
      const results = await Promise.all(
        jobs.map(async (job) => {
          try {
            const data = await fetchJobTickets(job.id);
            return { jobId: job.id, tickets: data.tickets ?? [] };
          } catch {
            return { jobId: job.id, tickets: [] };
          }
        })
      );
      return results;
    },
    enabled: jobs.length > 0,
    staleTime: 30_000,
  });
}

export function useOperationsTimeline(jobs: Job[]) {
  const timelineJobs = jobs.slice(0, 5);

  return useQuery({
    queryKey: ["dispatcher-timeline", timelineJobs.map((j) => j.id).join(",")],
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
