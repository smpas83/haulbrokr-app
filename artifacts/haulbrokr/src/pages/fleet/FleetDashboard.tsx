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
  FleetTopBar,
  FleetKpis,
  FleetGrid,
  FleetLayout,
  DriverStatusPanel,
  RevenuePanel,
  CompliancePanel,
  MaintenancePanel,
  FleetTimeline,
} from "@/components/fleet";
import {
  useFleetDashboardData,
  useUnreadFleetNotificationCount,
} from "@/hooks/useFleetDashboardData";

const LazyMapSection = lazy(async () => ({
  default: MapContainer,
}));

export default memo(function FleetDashboard() {
  const { data: profile } = useGetMyProfile();
  const { data: accountStatus } = useGetAccountStatus();
  const unreadCount = useUnreadFleetNotificationCount();

  const [timelineOpen, setTimelineOpen] = useState(false);
  const [selectedTruckId, setSelectedTruckId] = useState<number | null>(null);

  const {
    activityQuery,
    trucksQuery,
    jobsQuery,
    membersQuery,
    walletQuery,
    orgComplianceQuery,
    complianceQuery,
    trucks,
    jobs,
    drivers,
    activeJobs,
    mapTrucks,
    kpis,
    revenue,
    isLoading,
    isError,
    refetchAll,
  } = useFleetDashboardData();

  const canOperate =
    accountStatus?.w9Status === "verified" &&
    accountStatus?.insuranceStatus === "verified";

  const handleSelectTruck = useCallback((truckId: number) => {
    setSelectedTruckId((prev) => (prev === truckId ? null : truckId));
  }, []);

  const dotStatus = useMemo(() => {
    return orgComplianceQuery.data?.dotCdlStatus ?? complianceQuery.data?.status ?? accountStatus?.dotCdlStatus;
  }, [orgComplianceQuery.data, complianceQuery.data, accountStatus]);

  const rightPanel = (
    <>
      <Card className="rounded-none border-2 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-bold">Notifications</CardTitle>
          <CardDescription>
            New dispatch, driver delay, compliance alerts, documents, and payments
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<AppLoader className="min-h-[200px]" label="Loading notifications" />}>
            <ActivityFeed
              activities={activityQuery.data}
              isLoading={activityQuery.isLoading}
              isError={activityQuery.isError}
              onRetry={() => activityQuery.refetch()}
              animated
              limit={8}
            />
          </Suspense>
        </CardContent>
      </Card>

      <Suspense fallback={<AppLoader className="min-h-[120px]" label="Loading driver status" />}>
        <DriverStatusPanel
          trucks={trucks}
          jobs={jobs}
          drivers={drivers}
          complianceStatus={dotStatus}
          isLoading={membersQuery.isLoading || trucksQuery.isLoading}
          isError={membersQuery.isError || trucksQuery.isError}
          onRetry={() => {
            membersQuery.refetch();
            trucksQuery.refetch();
          }}
        />
      </Suspense>

      <Suspense fallback={<AppLoader className="min-h-[120px]" label="Loading revenue" />}>
        <RevenuePanel
          revenue={revenue}
          isLoading={walletQuery.isLoading || isLoading}
          isError={walletQuery.isError}
          onRetry={() => walletQuery.refetch()}
        />
      </Suspense>

      <Suspense fallback={<AppLoader className="min-h-[120px]" label="Loading compliance" />}>
        <CompliancePanel
          w9Status={orgComplianceQuery.data?.w9Status ?? accountStatus?.w9Status}
          insuranceStatus={orgComplianceQuery.data?.insuranceStatus ?? accountStatus?.insuranceStatus}
          dotCdlStatus={orgComplianceQuery.data?.dotCdlStatus ?? accountStatus?.dotCdlStatus}
          payoutStatus={orgComplianceQuery.data?.payoutStatus}
          trucks={trucks}
          isLoading={orgComplianceQuery.isLoading}
          isError={orgComplianceQuery.isError}
          onRetry={() => orgComplianceQuery.refetch()}
        />
      </Suspense>

      <Suspense fallback={<AppLoader className="min-h-[120px]" label="Loading maintenance" />}>
        <MaintenancePanel />
      </Suspense>
    </>
  );

  const bottomDrawer = (
    <FleetTimeline
      trucks={trucks}
      jobs={jobs}
      open={timelineOpen}
      onOpenChange={setTimelineOpen}
    />
  );

  if (isLoading && !trucksQuery.data && !jobsQuery.data) {
    return <AppLoader label="Loading fleet command center…" className="min-h-[50vh]" />;
  }

  return (
    <div className="animate-in fade-in duration-500 motion-reduce:animate-none">
      <FleetTopBar
        companyName={profile?.companyName}
        unreadCount={unreadCount}
        hasMultipleFleets={!!profile?.organizationId}
      />

      {accountStatus && !canOperate && (
        <Alert className="rounded-none border-2 border-amber-500/50 bg-amber-500/10 mb-4">
          <ShieldAlert className="h-4 w-4 text-amber-600" aria-hidden="true" />
          <AlertTitle className="text-amber-700 font-bold">Action Required</AlertTitle>
          <AlertDescription className="text-amber-700/80">
            Complete your W-9 and insurance verification to start bidding on jobs.{" "}
            <Link href="/account">
              <span className="underline font-semibold cursor-pointer">Go to Account →</span>
            </Link>
          </AlertDescription>
        </Alert>
      )}

      <div className="flex justify-end mb-4">
        <Link href="/fleet/new">
          <Button className="rounded-none border-2 font-bold" data-testid="btn-add-truck-dashboard">
            <Plus className="h-4 w-4 mr-2" aria-hidden="true" />
            Add Truck
          </Button>
        </Link>
      </div>

      <FleetLayout
        rightPanel={rightPanel}
        bottomDrawer={bottomDrawer}
        onRetry={refetchAll}
      >
        <FleetKpis kpis={kpis} isLoading={isLoading} />

        <Suspense fallback={<AppLoader className="min-h-[360px]" label="Loading fleet map" />}>
          <LazyMapSection
            jobs={jobs}
            trucks={mapTrucks}
            selectedJobId={selectedTruckId}
            isLoading={jobsQuery.isLoading || trucksQuery.isLoading}
            isError={jobsQuery.isError || trucksQuery.isError || isError}
            onRetry={refetchAll}
            title="Live Fleet Map"
            description="Truck markers, driver locations, pickup sites, dropoff facilities, and active routes — awaiting map provider integration"
          />
        </Suspense>

        <FleetGrid
          trucks={trucks}
          jobs={jobs}
          drivers={drivers}
          isLoading={trucksQuery.isLoading}
          isError={trucksQuery.isError}
          onRetry={() => trucksQuery.refetch()}
          selectedTruckId={selectedTruckId}
          onSelectTruck={handleSelectTruck}
        />
      </FleetLayout>
    </div>
  );
});
