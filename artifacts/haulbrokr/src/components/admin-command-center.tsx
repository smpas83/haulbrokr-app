import { useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity, AlertCircle, Banknote, Briefcase, CreditCard, DollarSign,
  FileStack, Headphones, PackageCheck, ShieldCheck, TrendingUp, Truck,
} from "lucide-react";
import { getGetAdminOverviewQueryKey } from "@workspace/api-client-react";
import { apiFetch } from "@/lib/apiFetch";
import { AdminInsights, type AdminOverviewV2 } from "@/components/admin-insights";
import {
  ActivityFeed,
  AsyncSection,
  MapContainer,
  PageHeader,
  StatCard,
  type ActivityFeedItem,
} from "@/components/shared";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface AdminJobRow {
  id: number;
  status: string;
  materialType: string;
  pickupAddress: string;
  deliveryAddress: string;
  gmv: number;
  createdAt: string;
  customerName: string | null;
  providerName: string | null;
}

const money = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n || 0);

function PanelCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="rounded-none border-2">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-bold">{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export interface AdminCommandCenterProps {
  enabled: boolean;
  staffDisplayName?: string | null;
  onJumpTab?: (tab: string) => void;
}

export function AdminCommandCenter({ enabled, staffDisplayName, onJumpTab }: AdminCommandCenterProps) {
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null);

  const overview = useQuery({
    queryKey: getGetAdminOverviewQueryKey(),
    queryFn: () => apiFetch<AdminOverviewV2>("/admin/overview"),
    enabled,
  });

  const recentJobs = useQuery({
    queryKey: ["admin-recent-jobs"],
    queryFn: () => apiFetch<AdminJobRow[]>("/admin/jobs?limit=12"),
    enabled,
  });

  const activityItems = useMemo<ActivityFeedItem[]>(() => {
    return (recentJobs.data ?? []).map((job) => ({
      id: job.id,
      description: `Job #${job.id} · ${job.materialType} · ${job.customerName ?? "Customer"} → ${job.providerName ?? "Unassigned"}`,
      createdAt: job.createdAt,
      type: job.status,
      href: null,
      tone: job.status === "cancelled" ? "danger" : job.status === "completed" ? "success" : "default",
    }));
  }, [recentJobs.data]);

  const d = overview.data;

  return (
    <div className="space-y-6">
      {/* Executive Header */}
      <PageHeader
        title="Command Center"
        icon={<ShieldCheck className="w-7 h-7 text-primary" aria-hidden="true" />}
        description={
          <>
            Marketplace overview, operations, revenue, compliance, and support.
            {staffDisplayName ? ` · Signed in as ${staffDisplayName}` : ""}
          </>
        }
      />

      {/* Marketplace KPI Ribbon */}
      <AsyncSection
        title="Marketplace KPIs"
        isLoading={overview.isLoading}
        isError={overview.isError}
        onRetry={() => overview.refetch()}
        skeletonRows={1}
      >
        {d ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
            <StatCard title="GMV" value={money(d.gmv)} icon={DollarSign} accent sub="Total billed" />
            <StatCard title="Broker fees" value={money(d.brokerFees)} icon={TrendingUp} accent sub="Platform revenue" />
            <StatCard title="Active jobs" value={d.inProgressJobs.toLocaleString()} icon={Activity} sub="In progress now" />
            <StatCard title="Open requests" value={d.openRequests.toLocaleString()} icon={Briefcase} sub="Awaiting award" />
            <StatCard title="Carriers" value={d.newCarriers.toLocaleString()} icon={Truck} sub="Provider accounts" />
            <StatCard
              title="Stuck payouts"
              value={d.stuckPayouts.toLocaleString()}
              icon={Banknote}
              accent={d.stuckPayouts > 0}
              sub="Needs transfer"
            />
          </div>
        ) : null}
      </AsyncSection>

      {/* Marketplace Map */}
      <MapContainer
        title="Marketplace map"
        subtitle="Active jobs and fleet positions — live layers ship with GPS infrastructure"
        height={280}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Operations Panel */}
        <PanelCard title="Operations" description="Job funnel and dispatch health">
          {overview.isLoading ? (
            <Skeleton className="h-24 w-full rounded-none" />
          ) : d ? (
            <div className="grid grid-cols-2 gap-3">
              <StatCard title="Posted" value={d.requestsPosted.toLocaleString()} icon={Briefcase} />
              <StatCard title="Accepted" value={d.acceptedJobs.toLocaleString()} icon={PackageCheck} />
              <StatCard title="In progress" value={d.inProgressJobs.toLocaleString()} icon={Activity} />
              <StatCard title="Completed" value={d.completedJobs.toLocaleString()} icon={PackageCheck} accent />
            </div>
          ) : null}
        </PanelCard>

        {/* Revenue Panel */}
        <PanelCard title="Revenue" description="Billing and realised platform earnings">
          {overview.isLoading ? (
            <Skeleton className="h-24 w-full rounded-none" />
          ) : d ? (
            <div className="grid grid-cols-2 gap-3">
              <StatCard title="GMV" value={money(d.gmv)} icon={DollarSign} accent />
              <StatCard title="Broker fees" value={money(d.brokerFees)} icon={TrendingUp} accent />
              <StatCard title="Realised profit" value={money(d.realisedProfit)} icon={Banknote} />
              <StatCard title="Avg job value" value={money(d.avgJobValue)} icon={DollarSign} />
            </div>
          ) : null}
        </PanelCard>

        {/* Compliance Panel */}
        <PanelCard title="Compliance" description="Document and carrier review queues">
          {overview.isLoading ? (
            <Skeleton className="h-24 w-full rounded-none" />
          ) : d ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <StatCard
                  title="Pending docs"
                  value={(d.documentsPending ?? 0).toLocaleString()}
                  icon={FileStack}
                  onClick={onJumpTab ? () => onJumpTab("compliance") : undefined}
                />
                <StatCard
                  title="Expired docs"
                  value={(d.documentsExpired ?? 0).toLocaleString()}
                  icon={AlertCircle}
                  accent={(d.documentsExpired ?? 0) > 0}
                />
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge variant="outline" className="rounded-none">
                  Carrier review: {d.pendingCompliance}
                </Badge>
                <Badge variant="outline" className="rounded-none">
                  Credit apps: {d.pendingCredit}
                </Badge>
              </div>
            </div>
          ) : null}
        </PanelCard>

        {/* Support Panel */}
        <PanelCard title="Support" description="Queues requiring staff attention">
          {overview.isLoading ? (
            <Skeleton className="h-24 w-full rounded-none" />
          ) : d ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <StatCard
                  title="Stuck payouts"
                  value={d.stuckPayouts.toLocaleString()}
                  icon={Banknote}
                  accent={d.stuckPayouts > 0}
                  onClick={onJumpTab ? () => onJumpTab("payouts") : undefined}
                />
                <StatCard
                  title="Credit pending"
                  value={d.pendingCredit.toLocaleString()}
                  icon={CreditCard}
                  onClick={onJumpTab ? () => onJumpTab("credit") : undefined}
                />
              </div>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Headphones className="h-3.5 w-3.5" />
                Route customer support escalations through info@haulbrokr.com
              </p>
            </div>
          ) : null}
        </PanelCard>
      </div>

      {/* Marketplace Health Panel */}
      <PanelCard title="Marketplace health" description="People, documents, and cancellation signals">
        {overview.isLoading ? (
          <Skeleton className="h-20 w-full rounded-none" />
        ) : d ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <StatCard title="Customers" value={d.newCustomers.toLocaleString()} icon={Briefcase} />
            <StatCard title="Carriers" value={d.newCarriers.toLocaleString()} icon={Truck} />
            <StatCard title="Drivers" value={d.drivers.toLocaleString()} icon={Activity} />
            <StatCard title="Open bins" value={d.openBinOrders.toLocaleString()} icon={PackageCheck} />
            <StatCard title="Cancelled" value={d.cancelledJobs.toLocaleString()} icon={AlertCircle} accent={d.cancelledJobs > 0} />
          </div>
        ) : null}
      </PanelCard>

      {/* Activity Feed + Timeline Drawer trigger */}
      <PanelCard title="Activity feed" description="Recent marketplace jobs">
        <ActivityFeed
          items={activityItems}
          isLoading={recentJobs.isLoading}
          emptyTitle="No recent jobs"
          emptyDescription="New jobs will appear here as customers post and awards complete."
        />
        {(recentJobs.data?.length ?? 0) > 0 ? (
          <button
            type="button"
            className="mt-4 text-xs font-semibold text-primary hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            onClick={() => {
              setSelectedJobId(recentJobs.data?.[0]?.id ?? null);
              setTimelineOpen(true);
            }}
          >
            Open timeline drawer for latest job
          </button>
        ) : null}
      </PanelCard>

      {/* Full analytics drill-downs */}
      <AdminInsights enabled={enabled} />

      {/* Timeline Drawer — PLACEHOLDER: full event timeline UI awaiting ChatGPT visual package */}
      <Sheet open={timelineOpen} onOpenChange={setTimelineOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md rounded-none">
          <SheetHeader>
            <SheetTitle>Job timeline</SheetTitle>
            <SheetDescription>
              {selectedJobId ? `Events for job #${selectedJobId}` : "Select a job to inspect its timeline."}
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-4 text-sm text-muted-foreground">
            <p>
              Timeline events are recorded server-side for status changes, tickets, and proof uploads.
              A full visual timeline will render here in the final design package.
            </p>
            {selectedJobId ? (
              <ul className="space-y-2 border-l-2 border-primary/30 pl-4">
                <li><span className="font-medium text-foreground">Created</span> — job posted and awarded</li>
                <li><span className="font-medium text-foreground">In progress</span> — driver field events</li>
                <li><span className="font-medium text-foreground">Completed</span> — proof and payout</li>
              </ul>
            ) : null}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
