import { lazy, Suspense, memo } from "react";
import { MapPin, Layers } from "lucide-react";
import type { Job } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "./EmptyState";
import { AppLoader } from "./AppLoader";
import { cn } from "@/lib/utils";

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  label: string;
  type: "truck" | "pickup" | "dropoff" | "cluster";
  status?: string;
}

interface MapContainerProps {
  jobs?: Job[];
  trucks?: { id: number; label: string; isAvailable: boolean }[];
  selectedJobId?: number | null;
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  className?: string;
}

/**
 * Web map placeholder — reuses job/truck data from existing APIs.
 * Full interactive map (markers, routes, geofence, weather layer) awaits
 * ChatGPT visual package / map provider integration.
 */
function MapPlaceholderContent({
  jobs = [],
  trucks = [],
  selectedJobId,
}: Pick<MapContainerProps, "jobs" | "trucks" | "selectedJobId">) {
  const activeJobs = jobs.filter((j) =>
    ["awarded", "accepted", "active", "in_progress"].includes(j.status)
  );

  return (
    <div className="relative h-full min-h-[320px] bg-muted/30 border-2 border-border overflow-hidden">
      <div
        className="absolute inset-0 opacity-20 bg-[linear-gradient(hsl(var(--border))_1px,transparent_1px),linear-gradient(90deg,hsl(var(--border))_1px,transparent_1px)] bg-[size:40px_40px]"
        aria-hidden="true"
      />

      <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
        <MapPin className="h-12 w-12 text-primary mb-4 opacity-60" aria-hidden="true" />
        <p className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
          Live Operations Map
        </p>
        <p className="text-xs text-muted-foreground mt-2 max-w-md">
          {/* PLACEHOLDER: ChatGPT visual package — interactive map with truck markers, routes, traffic, geofence, weather layer */}
          Map infrastructure placeholder. Job and fleet data loaded from existing APIs.
        </p>
      </div>

      <div className="absolute top-3 left-3 flex flex-wrap gap-2">
        <Badge variant="outline" className="rounded-none border-2 bg-card/90 backdrop-blur-sm">
          {trucks.length} trucks
        </Badge>
        <Badge variant="outline" className="rounded-none border-2 bg-card/90 backdrop-blur-sm">
          {activeJobs.length} active jobs
        </Badge>
        {selectedJobId && (
          <Badge variant="outline" className="rounded-none border-2 bg-primary/10 border-primary/30">
            Selected: JOB-{String(selectedJobId).padStart(4, "0")}
          </Badge>
        )}
      </div>

      <div className="absolute bottom-3 right-3">
        <Badge variant="outline" className="rounded-none border-2 bg-card/90 backdrop-blur-sm gap-1">
          <Layers className="h-3 w-3" aria-hidden="true" />
          Weather layer placeholder
        </Badge>
      </div>

      {activeJobs.length > 0 && (
        <ul className="absolute bottom-3 left-3 max-w-xs space-y-1" aria-label="Job locations">
          {activeJobs.slice(0, 3).map((job) => (
            <li
              key={job.id}
              className={cn(
                "text-xs px-2 py-1 bg-card/90 backdrop-blur-sm border border-border truncate",
                selectedJobId === job.id && "border-primary"
              )}
            >
              <span className="font-mono font-bold">JOB-{String(job.id).padStart(4, "0")}</span>
              {" · "}
              {job.pickupAddress}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const LazyMapContent = lazy(async () => ({
  default: MapPlaceholderContent,
}));

export const MapContainer = memo(function MapContainer({
  jobs,
  trucks,
  selectedJobId,
  isLoading,
  isError,
  onRetry,
  className,
}: MapContainerProps) {
  return (
    <Card className={cn("rounded-none border-2 shadow-sm overflow-hidden", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-bold">Live Operations Map</CardTitle>
        <CardDescription>
          Truck markers, routes, and facility overlays — awaiting map provider integration
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <Skeleton className="h-[360px] w-full rounded-none" aria-label="Loading map" />
        ) : isError ? (
          <div className="h-[360px] flex flex-col items-center justify-center gap-3 p-6">
            <p className="text-sm text-destructive font-semibold">Failed to load map data</p>
            {onRetry && (
              <button
                type="button"
                className="text-sm font-bold text-primary underline"
                onClick={onRetry}
              >
                Retry
              </button>
            )}
          </div>
        ) : !jobs?.length && !trucks?.length ? (
          <EmptyState
            icon={MapPin}
            title="No map data"
            description="Active jobs and fleet trucks will appear on the operations map."
            className="min-h-[320px] border-0"
          />
        ) : (
          <Suspense fallback={<AppLoader className="min-h-[360px]" label="Loading map" />}>
            <LazyMapContent jobs={jobs} trucks={trucks} selectedJobId={selectedJobId} />
          </Suspense>
        )}
      </CardContent>
    </Card>
  );
});
