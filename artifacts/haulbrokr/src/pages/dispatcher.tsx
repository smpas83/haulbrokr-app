import { lazy, Suspense, useDeferredValue, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { format } from "date-fns";
import {
  Bell,
  Briefcase,
  Building2,
  ChevronRight,
  ClipboardList,
  CreditCard,
  DollarSign,
  Filter,
  Loader2,
  Map,
  Menu,
  Search,
  Settings,
  SlidersHorizontal,
  Timer,
  Truck,
  User,
  Users,
} from "lucide-react";
import {
  JobRequestInputMaterialType,
  JobRequestInputTruckType,
  ListDumpSitesType,
  ListJobsStatus,
  ListRequestsStatus,
  useGetDashboardActivity,
  useGetDashboardStats,
  useListDumpSites,
  useListDumpSiteStates,
  useListJobs,
  useListJobStatusUpdates,
  useListOrgMembers,
  useListRequests,
  useListTrucks,
  type ActivityItem,
  type DumpSite,
  type Job,
  type JobStatusUpdate,
  type ListDumpSitesParams,
  type ListJobsParams,
  type ListRequestsParams,
  type ListTrucksParams,
  type OrgMember,
  type Truck as FleetTruck,
} from "@workspace/api-client-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const OperationsMap = lazy(() => import("@/components/dispatcher/operations-map"));

const NAV_ITEMS = [
  { label: "Current Dispatch", icon: Map, href: "/dispatcher", enabled: true },
  { label: "Live Fleet", icon: Truck, href: "/fleet", enabled: true },
  { label: "Drivers", icon: User, href: "/company", enabled: true },
  { label: "Jobs", icon: Briefcase, href: "/jobs", enabled: true },
  { label: "Facilities", icon: Building2, href: "/dispatcher", enabled: false },
  { label: "Customers", icon: Users, href: "/requests", enabled: true },
  { label: "Vendors", icon: ClipboardList, href: "/company", enabled: true },
  { label: "Analytics", icon: SlidersHorizontal, href: "/dashboard", enabled: true },
  { label: "Payments", icon: CreditCard, href: "/factoring", enabled: true },
  { label: "Notifications", icon: Bell, href: "/dispatcher", enabled: false },
  { label: "Settings", icon: Settings, href: "/account", enabled: true },
] as const;

type FeedItem = {
  id: string;
  label: string;
  detail: string;
  createdAt: string;
  href?: string;
};

type SearchItem = {
  id: string;
  group: "Jobs" | "Drivers" | "Facilities" | "Customers" | "Fleet" | "Vendors";
  label: string;
  detail: string;
  href: string;
};

function formatLabel(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function matchesQuery(query: string, ...values: Array<string | number | null | undefined>) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  return values.some((value) => String(value ?? "").toLowerCase().includes(normalized));
}

function liveQueryOptions(refetchInterval: number) {
  return { query: { refetchInterval } as any };
}

function timelineQueryOptions(enabled: boolean, refetchInterval: number) {
  return { query: { enabled, refetchInterval } as any };
}

function toActivityLabel(activity: ActivityItem) {
  const map: Partial<Record<ActivityItem["type"], string>> = {
    bid_accepted: "Driver accepted",
    job_accepted: "Driver accepted",
    job_started: "Departed",
    job_completed: "Payment initiated",
    payment_requires_action: "Broker approval",
    payment_failed: "Payment initiated",
    application_approved: "Broker approval",
    payout_delayed: "Payment initiated",
    payout_stuck_alert: "Payment initiated",
  };
  return map[activity.type] ?? formatLabel(activity.type);
}

function toStatusLabel(update: JobStatusUpdate) {
  const map: Partial<Record<JobStatusUpdate["status"], string>> = {
    arrived: "Driver arrived",
    loading: "Loading",
    loaded: "Departed",
    dumping: "Facility arrival",
    checked_in: "Facility arrival",
    ticket_uploaded: "Scale ticket uploaded",
    completed: "Payment completed",
  };
  return map[update.status] ?? formatLabel(update.status);
}

function KpiCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <Card className="rounded-none border-2 shadow-none">
      <CardHeader className="p-3 pb-1">
        <CardTitle className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent className="p-3 pt-0">
        <div className="text-2xl font-black">{value}</div>
        {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function DispatcherNav({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  return (
    <aside
      className={cn(
        "hidden shrink-0 border-2 border-border bg-card lg:flex lg:flex-col motion-reduce:transition-none",
        collapsed ? "w-16" : "w-56",
      )}
      aria-label="Dispatcher navigation"
    >
      <div className="flex h-12 items-center justify-between border-b-2 border-border px-3">
        {!collapsed && <span className="text-xs font-black uppercase tracking-wider">Command</span>}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-none"
          onClick={onToggle}
          aria-label={collapsed ? "Expand dispatcher navigation" : "Collapse dispatcher navigation"}
          aria-expanded={!collapsed}
        >
          <Menu className="h-4 w-4" />
        </Button>
      </div>
      <nav className="flex-1 space-y-1 p-2">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const className = cn(
            "flex w-full items-center gap-3 px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none",
            item.label === "Current Dispatch"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
            collapsed && "justify-center px-2",
            !item.enabled && "cursor-not-allowed opacity-50 hover:bg-transparent hover:text-muted-foreground",
          );
          const content = (
            <>
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </>
          );
          return item.enabled ? (
            <Link key={item.label} href={item.href} className={className} aria-label={item.label}>
              {content}
            </Link>
          ) : (
            <button key={item.label} type="button" className={className} disabled aria-label={`${item.label} unavailable`}>
              {content}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}

function FilterSelect({
  label,
  value,
  onValueChange,
  children,
  disabled,
}: {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <div className="min-w-[150px] flex-1">
      <label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-muted-foreground">{label}</label>
      <Select value={value} onValueChange={onValueChange} disabled={disabled}>
        <SelectTrigger className="h-9 rounded-none border-2 text-xs" aria-label={`${label} filter`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="rounded-none border-2">{children}</SelectContent>
      </Select>
    </div>
  );
}

function ActivityFeed({ items, loading }: { items: FeedItem[]; loading: boolean }) {
  return (
    <aside className="h-full overflow-hidden border-2 border-border bg-card" aria-label="Activity feed">
      <div className="border-b-2 border-border p-4">
        <h2 className="font-black tracking-tight">Activity Feed</h2>
        <p className="text-xs text-muted-foreground">Driver, facility, broker, invoice, and payment events.</p>
      </div>
      <div className="h-[calc(100%-73px)] overflow-auto p-3">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((item) => <Skeleton key={item} className="h-16 rounded-none" />)}
          </div>
        ) : items.length > 0 ? (
          <div className="space-y-2">
            {items.map((item) => {
              const content = (
                <div className="border-2 border-border bg-background p-3 transition-colors hover:border-primary motion-reduce:transition-none">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-bold">{item.label}</p>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{item.detail}</p>
                  <p className="mt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {format(new Date(item.createdAt), "MMM d, h:mm a")}
                  </p>
                </div>
              );
              return item.href ? (
                <Link key={item.id} href={item.href} aria-label={`${item.label}: ${item.detail}`}>
                  {content}
                </Link>
              ) : (
                <div key={item.id}>{content}</div>
              );
            })}
          </div>
        ) : (
          <div className="border-2 border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No live activity returned.
          </div>
        )}
      </div>
    </aside>
  );
}

function TimelineDrawer({
  job,
  updates,
  loading,
}: {
  job?: Job;
  updates: JobStatusUpdate[];
  loading: boolean;
}) {
  return (
    <Drawer>
      <DrawerTrigger asChild>
        <Button type="button" variant="outline" className="rounded-none border-2 font-bold" data-testid="dispatcher-timeline-trigger">
          Operational Timeline
        </Button>
      </DrawerTrigger>
      <DrawerContent className="max-h-[82vh] rounded-none border-2">
        <DrawerHeader>
          <DrawerTitle>Operational Timeline</DrawerTitle>
          <DrawerDescription>
            {job ? `JOB-${job.id.toString().padStart(4, "0")} status updates from the timeline API.` : "Select an active job to view timeline updates."}
          </DrawerDescription>
        </DrawerHeader>
        <div className="overflow-auto px-4 pb-6">
          {loading ? (
            <div className="space-y-3">{[1, 2, 3].map((item) => <Skeleton key={item} className="h-16 rounded-none" />)}</div>
          ) : updates.length > 0 ? (
            <ol className="space-y-3" aria-label="Job timeline">
              {updates.map((update) => (
                <li key={update.id} className="border-l-2 border-primary pl-4">
                  <div className="border-2 border-border bg-card p-3">
                    <p className="font-bold">{toStatusLabel(update)}</p>
                    <p className="text-sm text-muted-foreground">{update.note || update.actorName || "No note provided"}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{format(new Date(update.createdAt), "MMM d, yyyy h:mm a")}</p>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <div className="border-2 border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              No timeline updates returned for the selected job.
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}

function SearchDialog({
  open,
  onOpenChange,
  items,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: SearchItem[];
}) {
  const [, setLocation] = useLocation();

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search jobs, drivers, facilities, customers, fleet, vendors..." aria-label="Global dispatcher search" />
      <CommandList>
        <CommandEmpty>No loaded API records match.</CommandEmpty>
        {(["Jobs", "Drivers", "Facilities", "Customers", "Fleet", "Vendors"] as const).map((group) => {
          const groupItems = items.filter((item) => item.group === group).slice(0, 8);
          if (groupItems.length === 0) return null;
          return (
            <CommandGroup key={group} heading={group}>
              {groupItems.map((item) => (
                <CommandItem
                  key={item.id}
                  value={`${item.group} ${item.label} ${item.detail}`}
                  onSelect={() => {
                    onOpenChange(false);
                    setLocation(item.href);
                  }}
                >
                  <Search className="h-4 w-4" />
                  <span>{item.label}</span>
                  <span className="ml-auto truncate text-xs text-muted-foreground">{item.detail}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          );
        })}
      </CommandList>
    </CommandDialog>
  );
}

export default function DispatcherPage() {
  const [navCollapsed, setNavCollapsed] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [truckAvailability, setTruckAvailability] = useState<string>("all");
  const [regionFilter, setRegionFilter] = useState<string>("all");
  const [facilityFilter, setFacilityFilter] = useState<string>("all");
  const [selectedJobId, setSelectedJobId] = useState<number | undefined>();
  const [localSearch, setLocalSearch] = useState("");
  const deferredSearch = useDeferredValue(localSearch);

  const jobParams = useMemo<ListJobsParams | undefined>(
    () => statusFilter !== "all" && statusFilter in ListJobsStatus ? { status: statusFilter as ListJobsParams["status"] } : undefined,
    [statusFilter],
  );
  const requestParams = useMemo<ListRequestsParams | undefined>(
    () => statusFilter !== "all" && statusFilter in ListRequestsStatus ? { status: statusFilter as ListRequestsParams["status"] } : undefined,
    [statusFilter],
  );
  const truckParams = useMemo<ListTrucksParams | undefined>(() => {
    if (truckAvailability === "available") return { available: true };
    if (truckAvailability === "unavailable") return { available: false };
    return undefined;
  }, [truckAvailability]);
  const dumpSiteParams = useMemo<ListDumpSitesParams | undefined>(() => {
    const params: ListDumpSitesParams = {};
    if (regionFilter !== "all") params.state = regionFilter;
    if (facilityFilter !== "all") params.type = facilityFilter as ListDumpSitesParams["type"];
    return Object.keys(params).length > 0 ? params : undefined;
  }, [facilityFilter, regionFilter]);

  const { data: trucks = [], isLoading: trucksLoading } = useListTrucks(truckParams, liveQueryOptions(15000));
  const { data: jobs = [], isLoading: jobsLoading } = useListJobs(jobParams, liveQueryOptions(15000));
  const { data: requests = [], isLoading: requestsLoading } = useListRequests(requestParams, liveQueryOptions(15000));
  const { data: facilities = [], isLoading: facilitiesLoading } = useListDumpSites(dumpSiteParams, liveQueryOptions(30000));
  const { data: regions = [] } = useListDumpSiteStates();
  const { data: activity = [], isLoading: activityLoading } = useGetDashboardActivity(liveQueryOptions(10000));
  const { data: stats } = useGetDashboardStats(liveQueryOptions(15000));
  const { data: membersResponse } = useListOrgMembers(liveQueryOptions(30000));

  const members = membersResponse?.members ?? [];
  const drivers = useMemo(() => members.filter((member) => member.role === "driver"), [members]);
  const selectedJob = useMemo(
    () => jobs.find((job) => job.id === selectedJobId) ?? jobs.find((job) => ["active", "accepted", "in_progress", "awarded"].includes(job.status)),
    [jobs, selectedJobId],
  );
  const { data: timelineUpdates = [], isLoading: timelineLoading } = useListJobStatusUpdates(
    selectedJob?.id ?? 0,
    timelineQueryOptions(!!selectedJob?.id, 10000),
  );

  useEffect(() => {
    if (!selectedJobId && selectedJob?.id) setSelectedJobId(selectedJob.id);
  }, [selectedJob?.id, selectedJobId]);

  const visibleJobs = useMemo(
    () =>
      jobs.filter((job) =>
        matchesQuery(deferredSearch, job.id, job.customerCompany, job.providerCompany, job.pickupAddress, job.deliveryAddress, job.materialType),
      ),
    [deferredSearch, jobs],
  );

  const feedItems = useMemo<FeedItem[]>(() => {
    const activityItems = activity.map((item) => ({
      id: `activity-${item.id}`,
      label: toActivityLabel(item),
      detail: item.description,
      createdAt: item.createdAt,
      href: item.relatedId ? `/jobs/${item.relatedId}` : undefined,
    }));
    const statusItems = timelineUpdates.map((update) => ({
      id: `status-${update.id}`,
      label: toStatusLabel(update),
      detail: update.note || update.actorName || `JOB-${update.jobId}`,
      createdAt: update.createdAt,
      href: `/jobs/${update.jobId}`,
    }));
    return [...statusItems, ...activityItems]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 24);
  }, [activity, timelineUpdates]);

  const searchItems = useMemo<SearchItem[]>(() => {
    const jobItems = jobs.map((job) => ({
      id: `job-${job.id}`,
      group: "Jobs" as const,
      label: `JOB-${job.id.toString().padStart(4, "0")}`,
      detail: `${job.customerCompany} · ${formatLabel(job.status)}`,
      href: `/jobs/${job.id}`,
    }));
    const driverItems = drivers.map((driver) => ({
      id: `driver-${driver.id}`,
      group: "Drivers" as const,
      label: driver.contactName || driver.companyName,
      detail: driver.email || driver.phone || "Driver",
      href: "/company",
    }));
    const facilityItems = facilities.map((facility) => ({
      id: `facility-${facility.id}`,
      group: "Facilities" as const,
      label: facility.name,
      detail: facility.fullAddress || `${facility.city}, ${facility.state}`,
      href: "/dispatcher",
    }));
    const customerItems = requests.map((request) => ({
      id: `customer-${request.id}`,
      group: "Customers" as const,
      label: request.customerCompany,
      detail: `${formatLabel(request.materialType)} · ${request.pickupAddress}`,
      href: `/requests/${request.id}`,
    }));
    const fleetItems = trucks.map((truck) => ({
      id: `truck-${truck.id}`,
      group: "Fleet" as const,
      label: truck.truckNumber ? `Truck ${truck.truckNumber}` : formatLabel(truck.truckType),
      detail: `${truck.ownerCompany} · ${truck.isAvailable ? "Available" : "Unavailable"}`,
      href: "/fleet",
    }));
    const vendorItems = members
      .filter((member) => member.role !== "driver")
      .map((member: OrgMember) => ({
        id: `vendor-${member.id}`,
        group: "Vendors" as const,
        label: member.companyName,
        detail: member.email || member.contactName || "Vendor",
        href: "/company",
      }));
    return [...jobItems, ...driverItems, ...facilityItems, ...customerItems, ...fleetItems, ...vendorItems];
  }, [drivers, facilities, jobs, members, requests, trucks]);

  const filteredSearchItems = useMemo(
    () => searchItems.filter((item) => matchesQuery(deferredSearch, item.label, item.detail, item.group)),
    [deferredSearch, searchItems],
  );

  const activeJobs = jobs.filter((job) => ["active", "accepted", "in_progress", "awarded"].includes(job.status));
  const availableTrucks = trucks.filter((truck) => truck.isAvailable).length;
  const averageEta = activeJobs.length
    ? `${Math.round(activeJobs.reduce((sum, job) => sum + job.estimatedHours, 0) / activeJobs.length)}h`
    : "—";
  const facilityWaitTime = facilitiesLoading ? "…" : facilities.some((facility) => !facility.isActive) ? "Delayed" : "Normal";
  const todayLoads = activeJobs.reduce((sum, job) => sum + job.trucksAssigned, 0);
  const pendingDispatch = requests.filter((request) => ["open", "bid_received", "bidding", "awarded"].includes(request.status)).length;
  const todaysRevenue = stats?.totalRevenue ?? jobs.reduce((sum, job) => sum + (job.totalAmount ?? 0), 0);

  const loading = trucksLoading || jobsLoading || requestsLoading || facilitiesLoading;

  return (
    <div className="flex h-[calc(100vh-8rem)] min-h-[760px] gap-4" data-testid="dispatcher-command-center">
      <DispatcherNav collapsed={navCollapsed} onToggle={() => setNavCollapsed((value) => !value)} />

      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <header className="border-2 border-border bg-card p-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h1 className="text-3xl font-black tracking-tight">Dispatcher Command Center</h1>
              <p className="text-sm text-muted-foreground">Live fleet, dispatch, facilities, timeline, notifications, and analytics.</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative min-w-[280px]">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={localSearch}
                  onChange={(event) => setLocalSearch(event.target.value)}
                  onFocus={() => setSearchOpen(true)}
                  className="h-10 rounded-none border-2 pl-9"
                  placeholder="Global search"
                  aria-label="Global search"
                  data-testid="dispatcher-global-search"
                />
              </div>
              <TimelineDrawer job={selectedJob} updates={timelineUpdates} loading={timelineLoading} />
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-8" role="region" aria-label="Dispatcher filters">
            <FilterSelect label="Status" value={statusFilter} onValueChange={setStatusFilter}>
              <SelectItem value="all">All Statuses</SelectItem>
              {Object.values(ListJobsStatus).map((status) => <SelectItem key={status} value={status}>{formatLabel(status)}</SelectItem>)}
            </FilterSelect>
            <FilterSelect label="Material" value="all" onValueChange={() => undefined} disabled>
              <SelectItem value="all">Backend filter pending</SelectItem>
              {Object.values(JobRequestInputMaterialType).map((material) => <SelectItem key={material} value={material}>{formatLabel(material)}</SelectItem>)}
            </FilterSelect>
            <FilterSelect label="Region" value={regionFilter} onValueChange={setRegionFilter}>
              <SelectItem value="all">All Regions</SelectItem>
              {regions.map((region) => <SelectItem key={region} value={region}>{region}</SelectItem>)}
            </FilterSelect>
            <FilterSelect label="Truck Type" value="all" onValueChange={() => undefined} disabled>
              <SelectItem value="all">Backend filter pending</SelectItem>
              {Object.values(JobRequestInputTruckType).map((truckType) => <SelectItem key={truckType} value={truckType}>{formatLabel(truckType)}</SelectItem>)}
            </FilterSelect>
            <FilterSelect label="Facility" value={facilityFilter} onValueChange={setFacilityFilter}>
              <SelectItem value="all">All Facilities</SelectItem>
              {Object.values(ListDumpSitesType).map((type) => <SelectItem key={type} value={type}>{formatLabel(type)}</SelectItem>)}
            </FilterSelect>
            <FilterSelect label="Customer" value="all" onValueChange={() => undefined} disabled>
              <SelectItem value="all">Backend filter pending</SelectItem>
            </FilterSelect>
            <FilterSelect label="Driver" value="all" onValueChange={() => undefined} disabled>
              <SelectItem value="all">Backend filter pending</SelectItem>
            </FilterSelect>
            <FilterSelect label="Fleet" value={truckAvailability} onValueChange={setTruckAvailability}>
              <SelectItem value="all">All Trucks</SelectItem>
              <SelectItem value="available">Available</SelectItem>
              <SelectItem value="unavailable">Unavailable</SelectItem>
            </FilterSelect>
          </div>
        </header>

        <ResizablePanelGroup direction="horizontal" className="min-h-0 flex-1">
          <ResizablePanel defaultSize={74} minSize={55}>
            <div className="flex h-full min-h-0 flex-col gap-4">
              <div className="min-h-0 flex-1">
                <Suspense fallback={<Skeleton className="h-full min-h-[520px] rounded-none" />}>
                  <OperationsMap
                    trucks={trucks as FleetTruck[]}
                    jobs={visibleJobs as Job[]}
                    facilities={facilities as DumpSite[]}
                    selectedJobId={selectedJob?.id}
                    onSelectJob={setSelectedJobId}
                  />
                </Suspense>
              </div>

              <section className="grid shrink-0 gap-3 lg:grid-cols-4 2xl:grid-cols-8" aria-label="Live KPI cards">
                <KpiCard label="Available Trucks" value={loading ? "…" : availableTrucks} sub={`${trucks.length} total`} />
                <KpiCard label="Drivers Online" value={drivers.length} sub="Org drivers" />
                <KpiCard label="Active Jobs" value={activeJobs.length} sub={`${jobs.length} total`} />
                <KpiCard label="Pending Dispatch" value={requestsLoading ? "…" : pendingDispatch} sub="Requests queue" />
                <KpiCard label="Today's Revenue" value={`$${todaysRevenue.toLocaleString()}`} sub="Live analytics" />
                <KpiCard label="Today's Loads" value={todayLoads} sub="Assigned trucks" />
                <KpiCard label="Average ETA" value={averageEta} sub="Active routes" />
                <KpiCard label="Facility Wait Time" value={facilityWaitTime} sub="Facility API" />
              </section>
            </div>
          </ResizablePanel>
          <ResizableHandle withHandle className="mx-2" />
          <ResizablePanel defaultSize={26} minSize={20} maxSize={40}>
            <ActivityFeed items={feedItems} loading={activityLoading || timelineLoading} />
          </ResizablePanel>
        </ResizablePanelGroup>

        <section className="sr-only" aria-live="polite">
          {filteredSearchItems.length} global search records loaded from existing APIs.
        </section>
      </div>

      <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} items={filteredSearchItems} />
    </div>
  );
}
