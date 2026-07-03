import { lazy, memo, Suspense, useCallback, useMemo, useState } from "react";
import { Link } from "wouter";
import { ShieldAlert, Plus } from "lucide-react";
import {
  useGetMyProfile,
  useGetAccountStatus,
} from "@workspace/api-client-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ActivityFeed,
  AppLoader,
  MapContainer,
} from "@/components/shared";
import {
  CustomerTopBar,
  CustomerKpis,
  ActiveJobsPanel,
  FacilityStatus,
  CustomerDocuments,
  CustomerQuickActions,
  CustomerTimeline,
  CustomerLayout,
} from "@/components/customer";
import {
  useCustomerDashboardData,
  useUnreadNotificationCount,
} from "@/hooks/useCustomerDashboardData";

const LazyMapSection = lazy(async () => ({
  default: MapContainer,
}));

export default memo(function CustomerDashboard() {
  const { data: profile } = useGetMyProfile();
  const { data: accountStatus } = useGetAccountStatus();
  const unreadCount = useUnreadNotificationCount();

  const [timelineOpen, setTimelineOpen] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null);

  const {
    activityQuery,
    jobsQuery,
    facilitiesQuery,
    activeJobs,
    mapTrucks,
    kpis,
    lastRequest,
    isLoading,
    isError,
    refetchAll,
  } = useCustomerDashboardData();

  const facilities = useMemo(
    () => (facilitiesQuery.data ?? []).filter((f) => f.isActive).slice(0, 6),
    [facilitiesQuery.data]
  );

  const allJobs = jobsQuery.data ?? [];
  const canOperate = accountStatus?.profileComplete;

  const handleSelectJob = useCallback((jobId: number) => {
    setSelectedJobId((prev) => (prev === jobId ? null : jobId));
  }, []);

  const rightPanel = (
    <>
      <Card className="rounded-none border-2 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-bold">Activity Feed</CardTitle>
          <CardDescription>Newest events first — dispatch, documents, invoices, payments</CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<AppLoader className="min-h-[200px]" label="Loading activity feed" />}>
            <ActivityFeed
              activities={activityQuery.data}
              isLoading={activityQuery.isLoading}
              isError={activityQuery.isError}
              onRetry={() => activityQuery.refetch()}
              animated
              limit={10}
            />
          </Suspense>
        </CardContent>
      </Card>

      <Suspense fallback={<AppLoader className="min-h-[120px]" label="Loading documents" />}>
        <CustomerDocuments jobs={allJobs} />
      </Suspense>

      <FacilityStatus
        facilities={facilities}
        isLoading={facilitiesQuery.isLoading}
        isError={facilitiesQuery.isError}
        onRetry={() => facilitiesQuery.refetch()}
      />

      <CustomerQuickActions lastRequest={lastRequest} />
    </>
  );

  const bottomDrawer = (
    <CustomerTimeline
      jobs={activeJobs}
      open={timelineOpen}
      onOpenChange={setTimelineOpen}
    />
  );

  if (isLoading && !jobsQuery.data) {
    return <AppLoader label="Loading command center…" className="min-h-[50vh]" />;
  }

  return (
    <div className="animate-in fade-in duration-500 motion-reduce:animate-none">
      <CustomerTopBar
        companyName={profile?.companyName}
        unreadCount={unreadCount}
        hasMultipleAccounts={!!profile?.organizationId}
      />

      {accountStatus && !canOperate && (
        <Alert className="rounded-none border-2 border-amber-500/50 bg-amber-500/10 mb-4">
          <ShieldAlert className="h-4 w-4 text-amber-600" aria-hidden="true" />
          <AlertTitle className="text-amber-700 font-bold">Action Required</AlertTitle>
          <AlertDescription className="text-amber-700/80">
            Complete your profile to post job requests.{" "}
            <Link href="/account">
              <span className="underline font-semibold cursor-pointer">Go to Account →</span>
            </Link>
          </AlertDescription>
        </Alert>
      )}

      <CustomerLayout
        rightPanel={rightPanel}
        bottomDrawer={bottomDrawer}
        onRetry={refetchAll}
      >
        <CustomerKpis kpis={kpis} isLoading={isLoading} />

        <Suspense fallback={<AppLoader className="min-h-[360px]" label="Loading map" />}>
          <LazyMapSection
            jobs={allJobs}
            trucks={mapTrucks}
            selectedJobId={selectedJobId}
            isLoading={jobsQuery.isLoading}
            isError={jobsQuery.isError || isError}
            onRetry={refetchAll}
            title="Live Map"
            description="Driver locations, pickup sites, dropoff facilities, and active routes"
          />
        </Suspense>

        <ActiveJobsPanel
          jobs={activeJobs}
          isLoading={jobsQuery.isLoading}
          isError={jobsQuery.isError}
          onRetry={() => jobsQuery.refetch()}
          selectedJobId={selectedJobId}
          onSelectJob={handleSelectJob}
        />

        <div className="flex justify-end">
          <Link href="/requests/new">
            <Button className="h-10 px-5 font-bold shadow-sm rounded-none" data-testid="button-new-request">
              <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
              Request Haul
            </Button>
          </Link>
        </div>
      </CustomerLayout>
    </div>
  );
});
