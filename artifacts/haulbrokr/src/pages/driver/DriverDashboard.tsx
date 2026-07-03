import { lazy, Suspense, useMemo } from "react";
import { Link } from "wouter";
import {
  Activity,
  ArrowRight,
  Bell,
  Briefcase,
  Camera,
  CheckCircle2,
  Clock,
  DollarSign,
  FileUp,
  MapPin,
  Navigation,
  Phone,
  ShieldCheck,
  ToggleLeft,
  ToggleRight,
  Truck,
  Upload,
} from "lucide-react";
import {
  useGetAccountStatus,
  useGetDashboardActivity,
  useGetMyProfile,
  useListJobs,
} from "@workspace/api-client-react";

import { DriverLoadCard, formatJobEta } from "@/components/driver/DriverLoadCard";
import {
  ActivityFeed,
  AppLoader,
  EmptyState,
  OfflineBanner,
  PageHeader,
  StatCard,
  StatusBadge,
} from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useDriverAssignedJobIds } from "@/hooks/useDriverAssignedJobs";
import { useDriverOnline } from "@/hooks/useDriverOnline";
import {
  computeDriverPay,
  formatDriverPay,
  formatDeadline,
  isToday,
  navigationUrl,
  redactJobForDriver,
} from "@/lib/driverJobView";

const LazyMapContainer = lazy(() =>
  import("@/components/shared/MapContainer").then((m) => ({ default: m.MapContainer })),
);

function ActionRow({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <>
      <div className="flex items-center gap-3">
        <Icon className="h-5 w-5 text-primary" aria-hidden />
        <span className="text-sm font-semibold">{label}</span>
      </div>
      <ArrowRight className="h-4 w-4 text-muted-foreground transition-all group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden />
    </>
  );
}

function QuickActionButton({
  icon,
  label,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full cursor-pointer items-center justify-between border-2 border-border bg-card p-4 text-left transition-all hover:border-primary hover:bg-primary/5"
    >
      <ActionRow icon={icon} label={label} />
    </button>
  );
}

function QuickAction({
  href,
  icon,
  label,
  external,
}: {
  href: string;
  icon: React.ElementType;
  label: string;
  external?: boolean;
}) {
  const inner = (
    <div className="group flex cursor-pointer items-center justify-between border-2 border-border bg-card p-4 transition-all hover:border-primary hover:bg-primary/5">
      <ActionRow icon={icon} label={label} />
    </div>
  );

  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer">
        {inner}
      </a>
    );
  }
  return <Link href={href}>{inner}</Link>;
}

export default function DriverDashboard() {
  const { data: profile } = useGetMyProfile();
  const {
    data: jobs,
    isLoading: jobsLoading,
    isError: jobsError,
    refetch: refetchJobs,
    isFetching,
  } = useListJobs();
  const {
    data: activities,
    isLoading: activityLoading,
    isError: activityError,
    refetch: refetchActivity,
  } = useGetDashboardActivity();
  const { data: accountStatus, isLoading: statusLoading } = useGetAccountStatus();
  const { data: assignedJobIds, isLoading: ticketsLoading } = useDriverAssignedJobIds(jobs, profile?.id);

  const safeJobs = useMemo(() => (jobs ?? []).map(redactJobForDriver), [jobs]);
  const assignedIds = assignedJobIds ?? new Set<number>();

  const currentJob = useMemo(() => {
    const inProgress = safeJobs.find((j) => assignedIds.has(j.id) && j.status === "in_progress");
    if (inProgress) return inProgress;
    return safeJobs.find(
      (j) => assignedIds.has(j.id) && (j.status === "active" || j.status === "accepted" || j.status === "awarded"),
    );
  }, [safeJobs, assignedIds]);

  const hasActiveLoad = !!currentJob && currentJob.status === "in_progress";
  const { isOnline, setIsOnline, toggleOnline, presence } = useDriverOnline(hasActiveLoad);

  const stats = useMemo(() => {
    const assignedJobs = safeJobs.filter((j) => assignedIds.has(j.id));
    const completedToday = assignedJobs.filter((j) => j.status === "completed" && isToday(j.completedAt ?? j.scheduledDate));
    const todayEarnings = completedToday.reduce((sum, j) => sum + computeDriverPay(j), 0);
    const nextPickup = assignedJobs
      .filter((j) => j.status !== "completed" && j.status !== "cancelled")
      .sort((a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime())[0];

    return {
      todayEarnings,
      completedToday: completedToday.length,
      activeStatus: currentJob ? currentJob.status.replace(/_/g, " ") : "No active load",
      nextPickupEta: nextPickup ? formatJobEta(nextPickup) ?? formatDeadline(nextPickup) : "—",
    };
  }, [safeJobs, assignedIds, currentJob]);

  const availableNearby = useMemo(
    () =>
      safeJobs
        .filter((j) => !assignedIds.has(j.id) && ["awarded", "accepted", "active"].includes(j.status))
        .slice(0, 3),
    [safeJobs, assignedIds],
  );

  const weekEarnings = useMemo(() => {
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return safeJobs
      .filter(
        (j) =>
          assignedIds.has(j.id) &&
          j.status === "completed" &&
          new Date(j.completedAt ?? j.scheduledDate).getTime() >= weekAgo,
      )
      .reduce((sum, j) => sum + j.driverPay, 0);
  }, [safeJobs, assignedIds]);

  const complianceComplete = accountStatus
    ? accountStatus.dotCdlStatus === "verified" && accountStatus.w9Status === "verified"
    : false;

  const isOffline = typeof navigator !== "undefined" && !navigator.onLine;
  const isLoading = jobsLoading || ticketsLoading || statusLoading;

  if (isLoading) {
    return <AppLoader label="Loading driver cockpit…" />;
  }

  const retryAll = () => {
    refetchJobs();
    refetchActivity();
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 motion-reduce:animate-none">
      {(isOffline || jobsError || activityError) && (
        <OfflineBanner onRetry={retryAll} />
      )}

      <PageHeader
        title="Driver Cockpit"
        description={
          <>
            Welcome back,{" "}
            <span className="font-semibold text-foreground">
              {profile?.contactName || profile?.companyName}
            </span>
            . Here&apos;s your shift at a glance.
          </>
        }
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge status={presence} />
            <Button
              variant={isOnline ? "default" : "outline"}
              className="h-11 rounded-none border-2 font-bold"
              onClick={toggleOnline}
              aria-pressed={isOnline}
            >
              {isOnline ? <ToggleRight className="mr-2 h-4 w-4" aria-hidden /> : <ToggleLeft className="mr-2 h-4 w-4" aria-hidden />}
              {isOnline ? "Go Offline" : "Go Online"}
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <StatCard title="Driver Status" value={presence.toUpperCase()} icon={Activity} accent={presence === "online"} sub={isOnline ? "Receiving dispatch updates" : "Not accepting new loads"} />
        <StatCard title="Shift" value={hasActiveLoad ? "On load" : isOnline ? "On shift" : "Off shift"} icon={Clock} />
        <StatCard title="Today's Earnings" value={formatDriverPay(stats.todayEarnings)} icon={DollarSign} accent sub="Assigned loads completed today" />
        <StatCard title="Completed Today" value={stats.completedToday} icon={CheckCircle2} />
        <StatCard title="Active Load" value={stats.activeStatus} icon={Truck} accent={!!currentJob} />
        <StatCard title="Next Pickup ETA" value={stats.nextPickupEta} icon={MapPin} />
      </div>

      <Card className="rounded-none border-2 border-primary/30">
        <CardHeader className="border-b border-border/50 bg-primary/5">
          <CardTitle className="text-xl font-black">Current Job</CardTitle>
          <CardDescription>Your active assignment and next action</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {currentJob ? (
            <div className="grid gap-0 lg:grid-cols-5">
              <div className="space-y-4 p-6 lg:col-span-3">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={currentJob.status} />
                  <span className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                    {formatDriverPay(currentJob.driverPay)} driver pay
                  </span>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Pickup</p>
                    <p className="mt-1 font-semibold">{currentJob.pickupAddress}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Dropoff facility</p>
                    <p className="mt-1 font-semibold">{currentJob.deliveryAddress}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Material</p>
                    <p className="mt-1 font-semibold capitalize">{currentJob.materialType}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Load quantity</p>
                    <p className="mt-1 font-semibold">
                      {currentJob.trucksAssigned} truck{currentJob.trucksAssigned === 1 ? "" : "s"} · est. {currentJob.estimatedHours}h
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">ETA</p>
                    <p className="mt-1 font-semibold">{formatJobEta(currentJob) ?? "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Deadline</p>
                    <p className="mt-1 font-semibold">{formatDeadline(currentJob)}</p>
                  </div>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button className="h-12 flex-1 rounded-none font-bold" asChild>
                    <a href={navigationUrl(currentJob.pickupAddress)} target="_blank" rel="noopener noreferrer">
                      <Navigation className="mr-2 h-4 w-4" aria-hidden />
                      Open Navigation
                    </a>
                  </Button>
                  <Link href={`/jobs/${currentJob.id}`} className="flex-1">
                    <Button variant="outline" className="h-12 w-full rounded-none border-2 font-bold">
                      View Job
                    </Button>
                  </Link>
                </div>
              </div>
              <div className="border-t border-border lg:col-span-2 lg:border-l lg:border-t-0">
                <Suspense fallback={<Skeleton className="h-full min-h-[220px] w-full rounded-none" />}>
                  <LazyMapContainer className="h-full min-h-[220px] rounded-none border-0" placeholder="Route preview" />
                </Suspense>
              </div>
            </div>
          ) : (
            <EmptyState
              icon={<Truck className="h-10 w-10 opacity-40" aria-hidden />}
              title="No current assignment"
              description="When your dispatcher assigns a load, it will appear here with pickup, pay, and navigation."
              action={
                <Link href="/jobs">
                  <Button className="rounded-none font-bold">View Load Board</Button>
                </Link>
              }
              className="m-6"
            />
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="rounded-none border-2 lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base font-bold">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <QuickActionButton
              icon={isOnline ? ToggleLeft : ToggleRight}
              label={isOnline ? "Go Offline" : "Go Online"}
              onClick={() => setIsOnline(!isOnline)}
            />
            <QuickAction href="/jobs" icon={Briefcase} label="View Available Loads" />
            {currentJob ? (
              <QuickAction href={navigationUrl(currentJob.pickupAddress)} icon={Navigation} label="Open Navigation" external />
            ) : null}
            {currentJob ? (
              <QuickAction href={`/jobs/${currentJob.id}#ticket-upload`} icon={Upload} label="Upload Ticket" />
            ) : null}
            {currentJob ? (
              <QuickAction href={`/jobs/${currentJob.id}#pod-upload`} icon={Camera} label="Upload POD" />
            ) : null}
            <QuickAction href="/account" icon={Phone} label="Contact Dispatcher" />
            <QuickAction href="/account" icon={DollarSign} label="View Earnings" />
          </CardContent>
        </Card>

        <div className="space-y-4 lg:col-span-2">
          <Card className="rounded-none border-2">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold">Available Loads Nearby</CardTitle>
                <CardDescription>Unassigned loads in your fleet</CardDescription>
              </div>
              <Link href="/jobs">
                <Button variant="ghost" size="sm" className="rounded-none font-bold">
                  View all
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="space-y-3">
              {isFetching && !availableNearby.length ? (
                <Skeleton className="h-24 w-full rounded-none" />
              ) : availableNearby.length ? (
                availableNearby.map((job) => (
                  <div key={job.id} className="flex flex-col gap-2 border border-border p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-bold capitalize">{job.materialType}</p>
                      <p className="text-sm text-muted-foreground">{job.pickupAddress}</p>
                      <p className="text-sm font-semibold text-primary">{formatDriverPay(job.driverPay)}</p>
                    </div>
                    <Link href={`/jobs/${job.id}`}>
                      <Button variant="outline" className="h-11 w-full rounded-none border-2 font-bold sm:w-auto">
                        View
                      </Button>
                    </Link>
                  </div>
                ))
              ) : (
                <EmptyState
                  title="No nearby loads"
                  description="New fleet loads will show here when dispatch posts them."
                  className="border-none bg-transparent py-6"
                />
              )}
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card className="rounded-none border-2">
              <CardHeader>
                <CardTitle className="text-base font-bold">Earnings Summary</CardTitle>
                <CardDescription>Driver pay only — no customer pricing</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Today</span>
                  <span className="text-xl font-black tabular-nums">{formatDriverPay(stats.todayEarnings)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Last 7 days</span>
                  <span className="text-xl font-black tabular-nums">{formatDriverPay(weekEarnings)}</span>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-none border-2">
              <CardHeader>
                <CardTitle className="text-base font-bold">Compliance Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm">
                    <ShieldCheck className="h-4 w-4 text-primary" aria-hidden />
                    CDL / DOT docs
                  </span>
                  <StatusBadge status={accountStatus?.dotCdlStatus === "verified" ? "completed" : "pending"} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm">
                    <FileUp className="h-4 w-4 text-primary" aria-hidden />
                    W-9 on file
                  </span>
                  <StatusBadge status={accountStatus?.w9Status === "verified" ? "completed" : "pending"} />
                </div>
                {!complianceComplete ? (
                  <Link href="/account">
                    <Button variant="outline" className="mt-2 w-full rounded-none border-2 font-bold">
                      Complete compliance
                    </Button>
                  </Link>
                ) : null}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-7">
        <ActivityFeed
          activities={activities?.map((a) => ({
            id: a.id,
            type: a.type,
            description: a.description,
            createdAt: a.createdAt,
            relatedId: a.relatedId,
            relatedBinOrderId: a.relatedBinOrderId,
          }))}
          isLoading={activityLoading}
          title="Recent Activity"
          description="Dispatch updates, uploads, and load events"
          className="lg:col-span-4"
        />

        <Card className="rounded-none border-2 lg:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-bold">
              <Bell className="h-4 w-4" aria-hidden />
              Notifications
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activityLoading ? (
              <Skeleton className="h-24 w-full rounded-none" />
            ) : activities?.length ? (
              <ul className="space-y-3">
                {activities.slice(0, 5).map((a) => (
                  <li key={a.id} className="border-b border-border/40 pb-3 last:border-0">
                    <p className="text-sm font-medium">{a.description}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="All caught up" description="No new notifications." className="border-none bg-transparent py-4" />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
