import { useEffect, useState } from "react";
import { Link } from "wouter";
import {
  Crosshair,
  Navigation,
  Radio,
  Truck,
  MapPin,
  RefreshCw,
} from "lucide-react";
import { apiFetch } from "@/lib/apiFetch";
import { PageHeader } from "@/components/design";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusChip } from "@/components/design";
import { useFindMyLocation } from "@/hooks/useFindMyLocation";

interface DispatchJob {
  id: number;
  status: string;
  materialType: string;
  pickupAddress: string;
  deliveryAddress: string;
  position: { lat: number; lng: number; at: string } | null;
}

interface DispatchOverview {
  activeJobs: number;
  jobs: DispatchJob[];
  fleet: { id: number; truckType: string; isAvailable: boolean }[];
  updatedAt: string;
}

export default function DispatchPage() {
  const [data, setData] = useState<DispatchOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const {
    coords,
    error: locationError,
    following,
    locating,
    findLocation,
    recenter,
    stopFollowing,
  } = useFindMyLocation();
  const [mapCenter, setMapCenter] = useState<{
    lat: number;
    lng: number;
  } | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    apiFetch<DispatchOverview>("/dispatch/overview")
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (following && coords) {
      setMapCenter({ lat: coords.latitude, lng: coords.longitude });
    }
  }, [coords, following]);

  const handleFindMe = async () => {
    const found = await findLocation({ follow: true });
    if (found) setMapCenter({ lat: found.latitude, lng: found.longitude });
  };

  return (
    <div className="space-y-6 page-enter max-w-7xl mx-auto">
      <PageHeader
        title="Digital Twin"
        description="Live fleet dispatch overview — active jobs, truck positions, and fleet availability."
        actions={
          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCw
              className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        }
      />

      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading && !data ? (
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      ) : data ? (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="surface-panel rounded-xl p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Active Jobs
              </p>
              <p className="text-3xl font-bold stat-number mt-1">
                {data.activeJobs}
              </p>
            </div>
            <div className="surface-panel rounded-xl p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Fleet Available
              </p>
              <p className="text-3xl font-bold stat-number mt-1">
                {data.fleet.filter((t) => t.isAvailable).length}
              </p>
            </div>
            <div className="surface-panel rounded-xl p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                GPS Live
              </p>
              <p className="text-3xl font-bold stat-number mt-1 text-emerald-400">
                {data.jobs.filter((j) => j.position).length}
              </p>
            </div>
          </div>

          <div className="surface-panel rounded-xl p-6 min-h-[320px] relative overflow-hidden">
            <div className="absolute inset-0 opacity-20">
              {mapCenter && (
                <div
                  className="absolute h-4 w-4 rounded-full bg-blue-500 animate-pulse ring-4 ring-blue-400/30"
                  style={{
                    left: `${((mapCenter.lng + 125) / 60) * 100}%`,
                    top: `${((50 - mapCenter.lat) / 25) * 100}%`,
                  }}
                  title="Your location"
                />
              )}
              {data.jobs
                .filter((j) => j.position)
                .map((j) => (
                  <div
                    key={j.id}
                    className="absolute h-3 w-3 rounded-full bg-primary animate-pulse"
                    style={{
                      left: `${((j.position!.lng + 125) / 60) * 100}%`,
                      top: `${((50 - j.position!.lat) / 25) * 100}%`,
                    }}
                    title={`Job #${j.id}`}
                  />
                ))}
            </div>
            <div className="relative z-10 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-primary flex items-center gap-2">
                  <Radio className="h-4 w-4 animate-pulse" /> Live Fleet Map
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  {data.jobs.filter((j) => j.position).length} truck(s)
                  reporting GPS. Updated{" "}
                  {new Date(data.updatedAt).toLocaleTimeString()}.
                </p>
                {locationError && (
                  <p className="text-sm text-destructive mt-2">
                    {locationError}
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-2">
                {following && coords && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => recenter()}
                    disabled={locating}
                  >
                    <Crosshair className="h-4 w-4 mr-1" /> Re-center
                  </Button>
                )}
                <Button
                  variant={following ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    if (following) {
                      stopFollowing();
                      return;
                    }
                    void handleFindMe();
                  }}
                  disabled={locating}
                >
                  <Navigation className="h-4 w-4 mr-1" />
                  {following ? "Following" : "Find My Location"}
                </Button>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h2 className="text-lg font-semibold">Active Dispatches</h2>
            {data.jobs.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No active jobs. Browse the Load Board to find work.
              </p>
            ) : (
              data.jobs.map((job) => (
                <Link key={job.id} href={`/jobs/${job.id}`}>
                  <div className="rounded-xl border border-border/60 bg-card p-4 hover:border-primary/30 transition-colors cursor-pointer">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-xs text-muted-foreground">
                            JOB-{String(job.id).padStart(4, "0")}
                          </span>
                          <StatusChip status={job.status} />
                        </div>
                        <p className="font-semibold capitalize">
                          {job.materialType} Haul
                        </p>
                        <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                          <MapPin className="h-3.5 w-3.5" /> {job.pickupAddress}
                        </p>
                      </div>
                      <div className="text-right text-sm">
                        {job.position ? (
                          <span className="text-emerald-400 font-medium flex items-center gap-1">
                            <Radio className="h-3.5 w-3.5" /> GPS Live
                          </span>
                        ) : (
                          <span className="text-muted-foreground">
                            Awaiting GPS
                          </span>
                        )}
                        {job.position && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {job.position.lat.toFixed(4)},{" "}
                            {job.position.lng.toFixed(4)}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>

          {data.fleet.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Truck className="h-5 w-5" /> Fleet
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {data.fleet.map((t) => (
                  <div
                    key={t.id}
                    className="rounded-xl border border-border/60 p-4"
                  >
                    <p className="font-semibold capitalize">
                      {t.truckType.replace(/_/g, " ")}
                    </p>
                    <p
                      className={`text-sm mt-1 ${t.isAvailable ? "text-emerald-400" : "text-muted-foreground"}`}
                    >
                      {t.isAvailable ? "Available" : "On job"}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
