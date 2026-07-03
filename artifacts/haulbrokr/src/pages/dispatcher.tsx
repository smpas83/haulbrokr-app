import { lazy, memo, Suspense, useMemo, useState, useCallback } from "react";
import { Redirect, useLocation } from "wouter";
import { useGetMyProfile } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AppLoader,
  ActivityFeed,
  MapContainer,
} from "@/components/shared";
import { DispatcherLayout } from "@/components/dispatcher/DispatcherLayout";
import { DispatcherKpis } from "@/components/dispatcher/DispatcherKpis";
import { DispatchQueue } from "@/components/dispatcher/DispatchQueue";
import { AIRecommendations } from "@/components/dispatcher/AIRecommendations";
import { FacilityStatus } from "@/components/dispatcher/FacilityStatus";
import { OperationsTimeline } from "@/components/dispatcher/OperationsTimeline";
import {
  useDispatcherData,
  useDispatchQueueTickets,
} from "@/hooks/useDispatcherData";

const LazyMapSection = lazy(async () => ({
  default: MapContainer,
}));

function RequireProvider({ children }: { children: React.ReactNode }) {
  const { data: profile, isLoading, error } = useGetMyProfile();

  if (isLoading) return <AppLoader className="min-h-screen" label="Loading profile" />;
  if (error && (error as { status?: number }).status === 404) return <Redirect to="/onboarding" />;
  if (profile?.role !== "provider") return <Redirect to="/dashboard" />;

  return <>{children}</>;
}

function DispatcherCommandCenter() {
  const [, setLocation] = useLocation();
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null);

  const {
    activityQuery,
    jobsQuery,
    trucksQuery,
    membersQuery,
    facilitiesQuery,
    activeJobs,
    pendingDispatchJobs,
    drivers,
    kpis,
    mapTrucks,
    isLoading,
    isError,
    refetchAll,
  } = useDispatcherData();

  const ticketsQuery = useDispatchQueueTickets(pendingDispatchJobs);

  const ticketCounts = useMemo(() => {
    const map: Record<number, number> = {};
    ticketsQuery.data?.forEach(({ jobId, tickets }) => {
      map[jobId] = tickets.length;
    });
    return map;
  }, [ticketsQuery.data]);

  const facilities = useMemo(
    () => (facilitiesQuery.data ?? []).slice(0, 8),
    [facilitiesQuery.data]
  );

  const handleAssign = useCallback(
    (jobId: number) => {
      setSelectedJobId(jobId);
      setLocation(`/jobs/${jobId}`);
    },
    [setLocation]
  );

  const rightPanel = (
    <>
      <Card className="rounded-none border-2 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-bold">Live Activity Feed</CardTitle>
          <CardDescription>Newest operations events first</CardDescription>
        </CardHeader>
        <CardContent>
          <ActivityFeed
            activities={activityQuery.data}
            isLoading={activityQuery.isLoading}
            isError={activityQuery.isError}
            onRetry={() => activityQuery.refetch()}
            animated
            limit={10}
          />
        </CardContent>
      </Card>

      <AIRecommendations
        jobs={activeJobs}
        drivers={drivers}
        isLoading={isLoading}
      />

      <FacilityStatus
        facilities={facilities}
        isLoading={facilitiesQuery.isLoading}
        isError={facilitiesQuery.isError}
        onRetry={() => facilitiesQuery.refetch()}
      />
    </>
  );

  const bottomDrawer = (
    <OperationsTimeline
      jobs={activeJobs}
      open={timelineOpen}
      onOpenChange={setTimelineOpen}
    />
  );

  return (
    <DispatcherLayout
      onlineDrivers={drivers.length}
      liveTrucks={mapTrucks.length}
      rightPanel={rightPanel}
      bottomDrawer={bottomDrawer}
    >
      <header>
        <h1 className="text-2xl md:text-3xl font-black tracking-tight">Dispatcher Command Center</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Live operations — trucks, drivers, jobs, and dispatch queue
        </p>
      </header>

      <DispatcherKpis kpis={kpis} isLoading={isLoading} />

      <Suspense fallback={<AppLoader className="min-h-[360px]" label="Loading map" />}>
        <LazyMapSection
          jobs={jobsQuery.data}
          trucks={mapTrucks}
          selectedJobId={selectedJobId}
          isLoading={jobsQuery.isLoading || trucksQuery.isLoading}
          isError={jobsQuery.isError || trucksQuery.isError}
          onRetry={refetchAll}
        />
      </Suspense>

      <DispatchQueue
        jobs={activeJobs}
        ticketCounts={ticketCounts}
        isLoading={jobsQuery.isLoading || ticketsQuery.isLoading}
        isError={isError || ticketsQuery.isError}
        onRetry={refetchAll}
        onAssign={handleAssign}
      />
    </DispatcherLayout>
  );
}

export default memo(function DispatcherPage() {
  return (
    <RequireProvider>
      <DispatcherCommandCenter />
    </RequireProvider>
  );
});
