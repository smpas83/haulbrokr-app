import { useEffect, useMemo, useRef, useState, type ElementType, type ReactNode } from "react";
import { Link } from "wouter";
import { format, formatDistanceToNow, isToday, parseISO } from "date-fns";
import {
  Activity,
  AlertCircle,
  ArrowUpRight,
  Bell,
  Briefcase,
  Building2,
  CheckCircle2,
  CircleCheck,
  Clock,
  CreditCard,
  DollarSign,
  Layers3,
  MapPin,
  Navigation,
  PackageCheck,
  RadioTower,
  Route,
  Settings,
  ShieldAlert,
  Star,
  Truck,
  Users,
  Wifi,
} from "lucide-react";
import {
  useGetAccountStatus,
  useGetDashboardActivity,
  useGetDashboardStats,
  useGetMyProfile,
  useListJobs,
  useListOrgMembers,
  useListTrucks,
  type ActivityItem,
  type Job,
  type OrgMember,
  type Truck as FleetTruck,
} from "@workspace/api-client-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

declare global {
  interface Window {
    google?: any;
    __haulbrokrGoogleMapsPromise?: Promise<void>;
  }
}

type Coordinate = {
  lat: number;
  lng: number;
};

type MapMarker = Coordinate & {
  id: string;
  label: string;
  kind: "truck" | "driver" | "pickup" | "delivery" | "job";
};

const LIVE_REFETCH_MS = 15_000;
const ACTIVE_JOB_STATUSES = new Set(["active", "awarded", "accepted", "in_progress"]);
const MAP_CLUSTER_THRESHOLD = 40;
const liveQueryOptions = { refetchInterval: LIVE_REFETCH_MS } as any;

const darkMapStyles = [
  { elementType: "geometry", stylers: [{ color: "#111827" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#d1d5db" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#111827" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#374151" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#4b5563" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#020617" }] },
];

const dispatcherNav = [
  { label: "Dashboard", href: "/dashboard", icon: RadioTower },
  { label: "Active Jobs", href: "/jobs", icon: Briefcase },
  { label: "Dispatch Queue", href: "/requests", icon: Layers3 },
  { label: "Drivers", href: "/company", icon: Users },
  { label: "Fleet", href: "/fleet", icon: Truck },
  { label: "Customers", href: "/company", icon: Building2 },
  { label: "Vendors", href: "/company", icon: Building2 },
  { label: "Analytics", href: "/dashboard", icon: Activity },
  { label: "Payments", href: "/factoring", icon: CreditCard },
  { label: "Notifications", href: "#live-activity", icon: Bell },
  { label: "Settings", href: "/account", icon: Settings },
];

const mapLayers: Array<{ label: string; icon: ElementType; available: (context: { markers: MapMarker[]; activeJobs: Job[]; trucks: FleetTruck[] }) => boolean }> = [
  { label: "Truck markers", icon: Truck, available: ({ trucks }) => trucks.length > 0 },
  { label: "Driver markers", icon: Users, available: ({ markers }) => markers.some(m => m.kind === "driver") },
  { label: "Active jobs", icon: Briefcase, available: ({ activeJobs }) => activeJobs.length > 0 },
  { label: "Routes", icon: Route, available: () => false },
  { label: "Pickup pins", icon: MapPin, available: ({ markers }) => markers.some(m => m.kind === "pickup") },
  { label: "Delivery pins", icon: PackageCheck, available: ({ markers }) => markers.some(m => m.kind === "delivery") },
  { label: "ETA overlays", icon: Clock, available: () => false },
];

function formatNumber(value: number | undefined | null) {
  return (value ?? 0).toLocaleString();
}

function formatMoney(value: number | undefined | null) {
  return `$${Math.round(value ?? 0).toLocaleString()}`;
}

function formatLabel(value: string) {
  return value.replace(/_/g, " ");
}

function parseDate(value: string) {
  try {
    return parseISO(value);
  } catch {
    return new Date(value);
  }
}

function relativeTime(value: string) {
  try {
    return `${formatDistanceToNow(parseDate(value), { addSuffix: true })}`;
  } catch {
    return "recently";
  }
}

function readCoordinate(record: unknown, latKeys: string[], lngKeys: string[]): Coordinate | null {
  const source = record as Record<string, unknown>;
  const lat = latKeys.map(key => source[key]).find(value => typeof value === "number");
  const lng = lngKeys.map(key => source[key]).find(value => typeof value === "number");

  if (typeof lat !== "number" || typeof lng !== "number") return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

function buildMarkers(trucks: FleetTruck[], jobs: Job[], drivers: OrgMember[]) {
  const markers: MapMarker[] = [];

  trucks.forEach((truck) => {
    const point = readCoordinate(
      truck,
      ["currentLat", "latitude", "lat", "gpsLat"],
      ["currentLng", "currentLong", "longitude", "lng", "long", "gpsLng", "gpsLong"],
    );
    if (!point) return;
    markers.push({
      id: `truck-${truck.id}`,
      label: truck.truckNumber ? `Truck #${truck.truckNumber}` : `${formatLabel(truck.truckType)} truck`,
      kind: "truck",
      ...point,
    });
  });

  drivers.forEach((driver) => {
    const point = readCoordinate(
      driver,
      ["currentLat", "latitude", "lat", "gpsLat"],
      ["currentLng", "currentLong", "longitude", "lng", "long", "gpsLng", "gpsLong"],
    );
    if (!point) return;
    markers.push({
      id: `driver-${driver.id}`,
      label: driver.contactName || driver.companyName || `Driver #${driver.id}`,
      kind: "driver",
      ...point,
    });
  });

  jobs.forEach((job) => {
    const pickup = readCoordinate(
      job,
      ["pickupLat", "pickupLatitude"],
      ["pickupLng", "pickupLong", "pickupLongitude"],
    );
    if (pickup) {
      markers.push({
        id: `pickup-${job.id}`,
        label: `JOB-${String(job.id).padStart(4, "0")} pickup`,
        kind: "pickup",
        ...pickup,
      });
    }

    const delivery = readCoordinate(
      job,
      ["deliveryLat", "deliveryLatitude"],
      ["deliveryLng", "deliveryLong", "deliveryLongitude"],
    );
    if (delivery) {
      markers.push({
        id: `delivery-${job.id}`,
        label: `JOB-${String(job.id).padStart(4, "0")} delivery`,
        kind: "delivery",
        ...delivery,
      });
    }
  });

  return markers;
}

function clusterMarkers(markers: MapMarker[]) {
  if (markers.length <= MAP_CLUSTER_THRESHOLD) return markers;

  const clusters = new Map<string, MapMarker[]>();
  markers.forEach((marker) => {
    const key = `${marker.lat.toFixed(1)}:${marker.lng.toFixed(1)}`;
    clusters.set(key, [...(clusters.get(key) ?? []), marker]);
  });

  return Array.from(clusters.entries()).map(([key, group]) => {
    const lat = group.reduce((sum, marker) => sum + marker.lat, 0) / group.length;
    const lng = group.reduce((sum, marker) => sum + marker.lng, 0) / group.length;
    return {
      id: `cluster-${key}`,
      label: `${group.length} live assets`,
      kind: "job" as const,
      lat,
      lng,
    };
  });
}

function loadGoogleMaps(apiKey: string) {
  if (window.google?.maps) return Promise.resolve();
  if (window.__haulbrokrGoogleMapsPromise) return window.__haulbrokrGoogleMapsPromise;

  window.__haulbrokrGoogleMapsPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>("script[data-haulbrokr-google-maps]");
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Google Maps failed to load")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.dataset.haulbrokrGoogleMaps = "true";
    script.async = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly`;
    script.addEventListener("load", () => resolve(), { once: true });
    script.addEventListener("error", () => reject(new Error("Google Maps failed to load")), { once: true });
    document.head.appendChild(script);
  });

  return window.__haulbrokrGoogleMapsPromise;
}

function StatusBadge({ status }: { status: string }) {
  const className = {
    awarded: "bg-amber-100 text-amber-900 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800",
    accepted: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800",
    active: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800",
    in_progress: "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800",
    completed: "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800",
    declined: "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800",
    cancelled: "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800",
  }[status] ?? "bg-secondary text-secondary-foreground";

  return (
    <Badge variant="outline" className={cn("rounded-none border-2 font-bold uppercase text-[10px]", className)}>
      {formatLabel(status)}
    </Badge>
  );
}

function KpiCard({
  title,
  value,
  sub,
  icon: Icon,
  unavailable = false,
}: {
  title: string;
  value: string | number;
  sub: string;
  icon: ElementType;
  unavailable?: boolean;
}) {
  return (
    <Card className={cn("rounded-none border-2", unavailable && "border-dashed")}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">{title}</CardTitle>
        <Icon className={cn("h-4 w-4", unavailable ? "text-muted-foreground" : "text-primary")} aria-hidden="true" />
      </CardHeader>
      <CardContent>
        <div className={cn("text-2xl font-black tracking-tight", unavailable && "text-muted-foreground")}>{value}</div>
        <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
      </CardContent>
    </Card>
  );
}

function ActivityRow({ activity }: { activity: ActivityItem }) {
  const isFailure = activity.type === "payment_failed" || activity.type === "application_rejected";
  const isActionNeeded = activity.type === "payment_requires_action" || activity.type === "payout_delayed";
  const isApproved = activity.type === "application_approved";
  const isBin = activity.type.startsWith("bin_");
  const dotClass = isFailure
    ? "bg-destructive"
    : isActionNeeded
      ? "bg-amber-500"
      : isApproved
        ? "bg-green-500"
        : isBin
          ? "bg-violet-500"
          : "bg-primary";
  const textClass = isFailure
    ? "text-destructive"
    : isActionNeeded
      ? "text-amber-600 dark:text-amber-400"
      : isApproved
        ? "text-green-600 dark:text-green-400"
        : "";
  const binHref = isBin && activity.relatedBinOrderId != null
    ? `/bins?order=${encodeURIComponent(activity.relatedBinOrderId)}`
    : null;
  const jobHref = (isFailure || isActionNeeded || activity.type.startsWith("job_")) && activity.relatedId != null
    ? `/jobs/${activity.relatedId}`
    : null;
  const href = binHref ?? jobHref;
  const className = "group flex items-start gap-3 border-b border-border/50 px-3 py-3 transition-colors hover:bg-muted/40 last:border-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
  const inner = (
    <>
      <span className={cn("mt-1 h-2 w-2 flex-shrink-0 rounded-full", dotClass)} aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className={cn("block text-sm font-semibold leading-tight", textClass)}>{activity.description}</span>
        <span className="mt-1 block text-xs text-muted-foreground">
          {format(parseDate(activity.createdAt), "MMM d, h:mm a")} · {relativeTime(activity.createdAt)}
        </span>
      </span>
      {href && <ArrowUpRight className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground group-hover:text-foreground" aria-hidden="true" />}
    </>
  );

  return href ? (
    <Link href={href} className={className} aria-label={`Open related item for ${activity.description}`}>
      {inner}
    </Link>
  ) : (
    <div className={className}>{inner}</div>
  );
}

function EmptyState({ icon: Icon, title, children }: { icon: ElementType; title: string; children: ReactNode }) {
  return (
    <div className="flex min-h-36 flex-col items-center justify-center border-2 border-dashed border-border bg-muted/20 p-6 text-center">
      <Icon className="mb-3 h-8 w-8 text-muted-foreground" aria-hidden="true" />
      <p className="font-bold">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{children}</p>
    </div>
  );
}

function LiveOperationsMap({
  markers,
  activeJobs,
  trucks,
}: {
  markers: MapMarker[];
  activeJobs: Job[];
  trucks: FleetTruck[];
}) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerInstancesRef = useRef<any[]>([]);
  const [mapState, setMapState] = useState<"idle" | "loading" | "ready" | "missing-key" | "unavailable">("idle");
  const googleMapsKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || import.meta.env.VITE_GOOGLE_MAPS_BROWSER_KEY || "";
  const displayMarkers = useMemo(() => clusterMarkers(markers), [markers]);

  useEffect(() => {
    if (!googleMapsKey) {
      setMapState("missing-key");
      return;
    }
    if (!mapRef.current) return;

    let cancelled = false;
    setMapState("loading");

    loadGoogleMaps(googleMapsKey)
      .then(() => {
        if (cancelled || !mapRef.current || !window.google?.maps) return;
        const maps = window.google.maps;
        if (!mapInstanceRef.current) {
          mapInstanceRef.current = new maps.Map(mapRef.current, {
            center: { lat: 39.8283, lng: -98.5795 },
            disableDefaultUI: true,
            fullscreenControl: true,
            mapTypeControl: false,
            streetViewControl: false,
            styles: darkMapStyles,
            zoom: 4,
          });
        }
        setMapState("ready");
      })
      .catch(() => {
        if (!cancelled) setMapState("unavailable");
      });

    return () => {
      cancelled = true;
    };
  }, [googleMapsKey]);

  useEffect(() => {
    if (mapState !== "ready" || !mapInstanceRef.current || !window.google?.maps) return;
    const maps = window.google.maps;

    markerInstancesRef.current.forEach(marker => marker.setMap(null));
    markerInstancesRef.current = displayMarkers.map((marker) => {
      const instance = new maps.Marker({
        map: mapInstanceRef.current,
        position: { lat: marker.lat, lng: marker.lng },
        title: marker.label,
        label: marker.kind === "job" ? marker.label.split(" ")[0] : undefined,
      });
      return instance;
    });

    if (displayMarkers.length === 1) {
      mapInstanceRef.current.setCenter({ lat: displayMarkers[0].lat, lng: displayMarkers[0].lng });
      mapInstanceRef.current.setZoom(11);
    } else if (displayMarkers.length > 1) {
      const bounds = new maps.LatLngBounds();
      displayMarkers.forEach(marker => bounds.extend({ lat: marker.lat, lng: marker.lng }));
      mapInstanceRef.current.fitBounds(bounds);
    }
  }, [displayMarkers, mapState]);

  return (
    <Card className="flex min-h-[520px] flex-col overflow-hidden rounded-none border-2 lg:min-h-[680px]">
      <CardHeader className="border-b border-border/60">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-xl font-black">
              <MapPin className="h-5 w-5 text-primary" aria-hidden="true" />
              Live Fleet Map
            </CardTitle>
            <CardDescription>Google Maps command view for trucks, drivers, jobs, routes, pickup pins, delivery pins, and ETA overlays.</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2" aria-label="Map layer status">
            <Badge variant="outline" className="rounded-none border-2 font-bold uppercase text-[10px]">
              {displayMarkers.length} live markers
            </Badge>
            <Badge variant="outline" className="rounded-none border-2 font-bold uppercase text-[10px]">
              {activeJobs.length} active jobs
            </Badge>
            <Badge variant="outline" className="rounded-none border-2 font-bold uppercase text-[10px]">
              {trucks.length} trucks
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid flex-1 gap-0 p-0 lg:grid-cols-[1fr_18rem]">
        <div className="relative min-h-[420px] bg-slate-950" aria-label="Google Maps live operations map">
          <div ref={mapRef} className="absolute inset-0" />
          {mapState !== "ready" && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-950 p-6">
              <div className="max-w-md border-2 border-dashed border-border bg-card/95 p-6 text-center shadow-2xl">
                <RadioTower className="mx-auto mb-4 h-10 w-10 text-primary" aria-hidden="true" />
                <h2 className="text-lg font-black">Google Maps live layer pending</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  {mapState === "loading"
                    ? "Loading the Google Maps command view."
                    : mapState === "unavailable"
                      ? "Google Maps did not load in this environment."
                      : "Set VITE_GOOGLE_MAPS_API_KEY to render the live map."}
                </p>
              </div>
            </div>
          )}
          {mapState === "ready" && displayMarkers.length === 0 && (
            <div className="absolute inset-x-4 bottom-4 border-2 border-border bg-card/95 p-4 shadow-xl">
              <p className="text-sm font-bold">No live coordinates returned by the backend yet.</p>
              <p className="mt-1 text-xs text-muted-foreground">Fleet GPS, driver GPS, route polylines, and ETA overlays will render as soon as those fields are available on existing API responses.</p>
            </div>
          )}
        </div>
        <aside className="border-t border-border bg-muted/20 lg:border-l lg:border-t-0" aria-label="Map overlays">
          <div className="p-4">
            <h3 className="text-xs font-black uppercase tracking-wider text-muted-foreground">Live layers</h3>
            <div className="mt-3 space-y-2">
              {mapLayers.map(({ label, icon: Icon, available: isAvailable }) => {
                const available = isAvailable({ markers, activeJobs, trucks });
                return (
                  <div key={label} className="flex items-center justify-between border border-border bg-card px-3 py-2 text-sm">
                    <span className="flex items-center gap-2 font-semibold">
                      <Icon className={cn("h-4 w-4", available ? "text-primary" : "text-muted-foreground")} aria-hidden="true" />
                      {label}
                    </span>
                    <Badge variant={available ? "default" : "outline"} className="rounded-none text-[10px] font-bold uppercase">
                      {available ? "Live" : "API gap"}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </div>
        </aside>
      </CardContent>
    </Card>
  );
}

function ActiveJobCard({ job }: { job: Job }) {
  return (
    <Link href={`/jobs/${job.id}`} className="block border border-border bg-card p-3 transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-xs font-black text-muted-foreground">JOB-{String(job.id).padStart(4, "0")}</p>
          <h3 className="truncate text-sm font-black capitalize">{job.materialType} haul</h3>
        </div>
        <StatusBadge status={job.status} />
      </div>
      <div className="mt-3 grid gap-2 text-xs text-muted-foreground">
        <span className="truncate"><span className="font-bold text-foreground">Pickup:</span> {job.pickupAddress}</span>
        <span className="truncate"><span className="font-bold text-foreground">Delivery:</span> {job.deliveryAddress}</span>
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" aria-hidden="true" />
          {format(parseDate(job.scheduledDate), "MMM d")} at {job.startTime}
        </span>
      </div>
    </Link>
  );
}

export default function DashboardPage() {
  const { data: profile } = useGetMyProfile();
  const { data: stats, isLoading: statsLoading } = useGetDashboardStats({
    query: liveQueryOptions,
  });
  const { data: activities, isLoading: activityLoading } = useGetDashboardActivity({
    query: liveQueryOptions,
  });
  const { data: accountStatus } = useGetAccountStatus({
    query: liveQueryOptions,
  });
  const { data: trucks, isLoading: trucksLoading } = useListTrucks(undefined, {
    query: liveQueryOptions,
  });
  const { data: jobs, isLoading: jobsLoading } = useListJobs(undefined, {
    query: liveQueryOptions,
  });
  const { data: membersResp } = useListOrgMembers({
    query: {
      enabled: profile?.role !== "customer",
      refetchInterval: LIVE_REFETCH_MS,
    } as any,
  });

  const isCustomer = profile?.role === "customer";
  const isProvider = profile?.role === "provider";
  const canOperate = isCustomer
    ? accountStatus?.profileComplete
    : (accountStatus?.w9Status === "verified" && accountStatus?.insuranceStatus === "verified");

  const fleet = trucks ?? [];
  const allJobs = jobs ?? [];
  const drivers = (membersResp?.members ?? []).filter(member => member.role === "driver");
  const activeJobs = useMemo(
    () => allJobs.filter(job => ACTIVE_JOB_STATUSES.has(job.status)),
    [allJobs],
  );
  const todaysRevenue = useMemo(
    () => allJobs
      .filter(job => job.completedAt && isToday(parseDate(job.completedAt)))
      .reduce((sum, job) => sum + (job.providerNetAmount ?? job.totalAmount ?? 0), 0),
    [allJobs],
  );
  const liveMarkers = useMemo(() => buildMarkers(fleet, activeJobs, drivers), [fleet, activeJobs, drivers]);
  const availableTrucks = fleet.filter(truck => truck.isAvailable).length;
  const pendingDispatches = isProvider ? (stats?.pendingBids ?? 0) : (stats?.openRequests ?? 0);
  const dataLoading = statsLoading || trucksLoading || jobsLoading;

  return (
    <div className="animate-in fade-in duration-500">
      <div className="mb-4 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <Badge variant="outline" className="mb-2 rounded-none border-2 font-black uppercase tracking-wider">
            Live operations
          </Badge>
          <h1 className="text-3xl font-black tracking-tight md:text-4xl">Dispatcher Command Center</h1>
          <p className="mt-1 text-muted-foreground">
            Fleet, jobs, notifications, and KPIs for {profile?.companyName || profile?.contactName || "HaulBrokr dispatch"}.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/jobs">
            <Button className="rounded-none font-bold">
              <Briefcase className="mr-2 h-4 w-4" aria-hidden="true" />
              Active Jobs
            </Button>
          </Link>
          <Link href={isProvider ? "/fleet" : "/requests"}>
            <Button variant="outline" className="rounded-none border-2 font-bold">
              <Truck className="mr-2 h-4 w-4" aria-hidden="true" />
              {isProvider ? "Fleet" : "Dispatch Queue"}
            </Button>
          </Link>
        </div>
      </div>

      {accountStatus && !canOperate && (
        <Alert className="mb-4 rounded-none border-2 border-amber-500/50 bg-amber-500/10">
          <ShieldAlert className="h-4 w-4 text-amber-600" />
          <AlertTitle className="font-bold text-amber-700">Action Required</AlertTitle>
          <AlertDescription className="text-amber-700/80">
            {isProvider
              ? "Complete your W-9 and insurance verification to start bidding on jobs."
              : "Complete your profile to post job requests."}
            {" "}
            <Link href="/account" className="font-semibold underline">Go to Account</Link>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 xl:grid-cols-[13rem_minmax(0,1fr)_22rem]">
        <nav className="order-2 xl:order-1" aria-label="Dispatcher command center">
          <Card className="rounded-none border-2 xl:sticky xl:top-4">
            <CardHeader className="pb-3">
              <CardTitle className="text-xs font-black uppercase tracking-wider text-muted-foreground">Command</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 p-3 pt-0">
              {dispatcherNav.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className="flex items-center gap-3 px-3 py-2 text-sm font-bold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <item.icon className="h-4 w-4" aria-hidden="true" />
                  {item.label}
                </Link>
              ))}
            </CardContent>
          </Card>
        </nav>

        <main className="order-1 min-w-0 space-y-4 xl:order-2">
          {dataLoading ? (
            <Skeleton className="h-[680px] w-full rounded-none" />
          ) : (
            <LiveOperationsMap markers={liveMarkers} activeJobs={activeJobs} trucks={fleet} />
          )}

          <section aria-labelledby="dispatcher-kpis" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <h2 id="dispatcher-kpis" className="sr-only">Dispatcher KPIs</h2>
            <KpiCard title="Available Trucks" value={availableTrucks} sub={`${fleet.length} total trucks from fleet API`} icon={Truck} />
            <KpiCard title="Active Jobs" value={activeJobs.length} sub="Awarded, accepted, active, in progress" icon={Briefcase} />
            <KpiCard title="Drivers Online" value="--" sub="Online status API not available" icon={Wifi} unavailable />
            <KpiCard title="Average ETA" value="--" sub="ETA API not available" icon={Navigation} unavailable />
            <KpiCard title="Revenue Today" value={formatMoney(todaysRevenue)} sub="Completed today from jobs API" icon={DollarSign} />
            <KpiCard title="Pending Dispatches" value={pendingDispatches} sub={isProvider ? "Pending bids" : "Open requests"} icon={Layers3} />
            <KpiCard title="Completed Loads" value={formatNumber(stats?.completedJobs)} sub="Dashboard stats API" icon={CircleCheck} />
            <KpiCard title="Average Rating" value="--" sub="Global rating API not available" icon={Star} unavailable />
          </section>
        </main>

        <aside className="order-3 space-y-4" aria-label="Live operations panels">
          <Card id="live-activity" className="rounded-none border-2">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base font-black">
                    <Bell className="h-4 w-4 text-primary" aria-hidden="true" />
                    Live Activity Feed
                  </CardTitle>
                  <CardDescription>Dashboard activity updates every {LIVE_REFETCH_MS / 1000}s.</CardDescription>
                </div>
                <Badge variant="outline" className="rounded-none border-2 font-bold uppercase text-[10px]">Live</Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {activityLoading ? (
                <div className="space-y-3 p-4">
                  {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-14 w-full rounded-none" />)}
                </div>
              ) : activities && activities.length > 0 ? (
                <ScrollArea className="h-[360px]">
                  <div>
                    {activities.slice(0, 14).map(activity => <ActivityRow key={activity.id} activity={activity} />)}
                  </div>
                </ScrollArea>
              ) : (
                <div className="p-4">
                  <EmptyState icon={Activity} title="No recent activity">Activity, notifications, and payment events will appear here.</EmptyState>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-none border-2">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-black">
                <Briefcase className="h-4 w-4 text-primary" aria-hidden="true" />
                Job Progress
              </CardTitle>
              <CardDescription>Live job state from the jobs API.</CardDescription>
            </CardHeader>
            <CardContent>
              {jobsLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-28 w-full rounded-none" />)}
                </div>
              ) : activeJobs.length > 0 ? (
                <ScrollArea className="h-[340px] pr-3">
                  <div className="space-y-3">
                    {activeJobs.slice(0, 8).map(job => <ActiveJobCard key={job.id} job={job} />)}
                  </div>
                </ScrollArea>
              ) : (
                <EmptyState icon={CheckCircle2} title="No live jobs">Accepted and in-progress loads will appear here.</EmptyState>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-none border-2">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-black">
                <Truck className="h-4 w-4 text-primary" aria-hidden="true" />
                Fleet Availability
              </CardTitle>
              <CardDescription>Truck status from the fleet API.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Available</span>
                <span className="font-black">{availableTrucks}</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Assigned / offline</span>
                <span className="font-black">{Math.max(fleet.length - availableTrucks, 0)}</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Drivers on roster</span>
                <span className="font-black">{drivers.length || "--"}</span>
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}

