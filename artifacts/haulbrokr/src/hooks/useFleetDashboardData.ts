import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  useGetDashboardStats,
  useGetDashboardActivity,
  useListTrucks,
  useListJobs,
  useListOrgMembers,
  useGetWallet,
  useGetAccountStatus,
  useGetOrganizationComplianceStatus,
  useGetCompliance,
  useListDumpSites,
  type Job,
  type Truck,
} from "@workspace/api-client-react";
import {
  isActiveJob,
  isToday,
  isThisWeek,
  isThisMonth,
  computeFleetUtilization,
  computeComplianceScore,
  countPendingInvoices,
} from "@/lib/fleetDashboardView";

export function useFleetDashboardData() {
  const statsQuery = useGetDashboardStats();
  const activityQuery = useGetDashboardActivity();
  const trucksQuery = useListTrucks();
  const jobsQuery = useListJobs();
  const membersQuery = useListOrgMembers();
  const walletQuery = useGetWallet();
  const accountStatusQuery = useGetAccountStatus();
  const orgComplianceQuery = useGetOrganizationComplianceStatus();
  const complianceQuery = useGetCompliance();
  const facilitiesQuery = useListDumpSites();

  const trucks = trucksQuery.data ?? [];
  const jobs = jobsQuery.data ?? [];
  const members = membersQuery.data?.members ?? [];
  const drivers = useMemo(() => members.filter((m) => m.role === "driver"), [members]);

  const activeJobs = useMemo(() => jobs.filter((j) => isActiveJob(j)), [jobs]);

  const completedToday = useMemo(
    () => jobs.filter((j) => j.status === "completed" && isToday(j.completedAt ?? j.scheduledDate)),
    [jobs]
  );

  const mapTrucks = useMemo(
    () =>
      trucks.map((t) => ({
        id: t.id,
        label: t.truckNumber ? `#${t.truckNumber}` : `Truck ${t.id}`,
        isAvailable: t.isAvailable,
      })),
    [trucks]
  );

  const walletTransactions = walletQuery.data?.transactions ?? [];

  const todayRevenue = useMemo(() => {
    return walletTransactions
      .filter((tx) => tx.type === "earning" && isToday(tx.createdAt))
      .reduce((sum, tx) => sum + tx.amount, 0);
  }, [walletTransactions]);

  const weeklyRevenue = useMemo(() => {
    return walletTransactions
      .filter((tx) => tx.type === "earning" && isThisWeek(tx.createdAt))
      .reduce((sum, tx) => sum + tx.amount, 0);
  }, [walletTransactions]);

  const monthlyRevenue = useMemo(() => {
    return walletTransactions
      .filter((tx) => tx.type === "earning" && isThisMonth(tx.createdAt))
      .reduce((sum, tx) => sum + tx.amount, 0);
  }, [walletTransactions]);

  const driversOnline = useMemo(() => {
    const assignedDriverIds = new Set(
      trucks.filter((t) => t.assignedDriverId).map((t) => t.assignedDriverId)
    );
    const activeCount = drivers.filter((d) => assignedDriverIds.has(d.id) && activeJobs.length > 0).length;
    return activeCount > 0 ? activeCount : drivers.filter((d) => assignedDriverIds.has(d.id)).length;
  }, [trucks, drivers, activeJobs.length]);

  const kpis = useMemo(() => {
    const stats = statsQuery.data;
    const orgCompliance = orgComplianceQuery.data;
    const accountStatus = accountStatusQuery.data;

    return {
      fleetSize: trucks.length,
      driversOnline,
      availableTrucks: trucks.filter((t) => t.isAvailable).length,
      activeJobs: stats?.activeJobs ?? activeJobs.length,
      completedToday: completedToday.length,
      todaysRevenue: todayRevenue,
      fleetUtilization: computeFleetUtilization(trucks, activeJobs),
      complianceScore: computeComplianceScore({
        w9Status: orgCompliance?.w9Status ?? accountStatus?.w9Status,
        insuranceStatus: orgCompliance?.insuranceStatus ?? accountStatus?.insuranceStatus,
        dotCdlStatus: orgCompliance?.dotCdlStatus ?? accountStatus?.dotCdlStatus,
        payoutStatus: orgCompliance?.payoutStatus,
      }),
    };
  }, [
    statsQuery.data,
    trucks,
    driversOnline,
    activeJobs,
    completedToday.length,
    todayRevenue,
    orgComplianceQuery.data,
    accountStatusQuery.data,
  ]);

  const revenue = useMemo(() => {
    const stats = statsQuery.data;
    const wallet = walletQuery.data;
    const fleetSize = trucks.length || 1;

    return {
      todaysRevenue: todayRevenue,
      weeklyRevenue,
      monthlyRevenue,
      avgRevenuePerTruck: Math.round((stats?.totalRevenue ?? 0) / fleetSize),
      completedLoads: stats?.completedJobs ?? 0,
      avgDriverEarnings: "—", // PLACEHOLDER: per-driver earnings API pending
      outstandingPayments: wallet?.pendingBalance ?? 0,
      pendingInvoices: countPendingInvoices(jobs),
    };
  }, [todayRevenue, weeklyRevenue, monthlyRevenue, statsQuery.data, walletQuery.data, trucks.length, jobs]);

  const isLoading =
    statsQuery.isLoading ||
    trucksQuery.isLoading ||
    jobsQuery.isLoading ||
    activityQuery.isLoading;

  const isError =
    statsQuery.isError ||
    trucksQuery.isError ||
    jobsQuery.isError ||
    activityQuery.isError;

  const refetchAll = () => {
    statsQuery.refetch();
    activityQuery.refetch();
    trucksQuery.refetch();
    jobsQuery.refetch();
    membersQuery.refetch();
    walletQuery.refetch();
    accountStatusQuery.refetch();
    orgComplianceQuery.refetch();
    complianceQuery.refetch();
    facilitiesQuery.refetch();
  };

  return {
    statsQuery,
    activityQuery,
    trucksQuery,
    jobsQuery,
    membersQuery,
    walletQuery,
    accountStatusQuery,
    orgComplianceQuery,
    complianceQuery,
    facilitiesQuery,
    trucks,
    jobs,
    drivers,
    activeJobs,
    completedToday,
    mapTrucks,
    kpis,
    revenue,
    isLoading,
    isError,
    refetchAll,
  };
}

export function useFleetTimeline(trucks: Truck[], jobs: Job[]) {
  const timelineTrucks = trucks.slice(0, 8);
  const activeJobIds = jobs.filter((j) => isActiveJob(j)).map((j) => j.id);

  return useQuery({
    queryKey: ["fleet-timeline", timelineTrucks.map((t) => t.id).join(","), activeJobIds.join(",")],
    queryFn: async () => {
      const jobUpdates = await Promise.all(
        activeJobIds.slice(0, 6).map(async (jobId) => {
          try {
            const res = await fetch(`/api/jobs/${jobId}/status-updates`);
            if (!res.ok) return { jobId, updates: [] };
            const updates = await res.json();
            return { jobId, updates: updates ?? [] };
          } catch {
            return { jobId, updates: [] };
          }
        })
      );

      return timelineTrucks.map((truck) => {
        const job = jobs.find(
          (j) => isActiveJob(j) && truck.assignedDriverId && !truck.isAvailable
        );
        const jobUpdateGroup = job ? jobUpdates.find((g) => g.jobId === job.id) : undefined;

        return {
          truck,
          job,
          updates: jobUpdateGroup?.updates ?? [],
        };
      });
    },
    enabled: timelineTrucks.length > 0,
    staleTime: 30_000,
  });
}

export function useUnreadFleetNotificationCount() {
  const { data: activities } = useGetDashboardActivity();
  const fleetTypes = new Set([
    "bid_accepted",
    "job_started",
    "job_completed",
    "payment_received",
    "payment_requires_action",
    "payout_delayed",
    "application_approved",
    "application_rejected",
  ]);
  return useMemo(
    () => (activities ?? []).filter((a) => fleetTypes.has(a.type)).length,
    [activities]
  );
}
