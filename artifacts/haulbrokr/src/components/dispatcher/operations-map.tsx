import { memo, useMemo } from "react";
import { AlertTriangle, Building2, MapPin, Navigation, Route, Timer, TrafficCone, Truck } from "lucide-react";
import type { DumpSite, Job, Truck as FleetTruck } from "@workspace/api-client-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type OperationsMapProps = {
  trucks: FleetTruck[];
  jobs: Job[];
  facilities: DumpSite[];
  selectedJobId?: number;
  onSelectJob: (jobId: number) => void;
};

function pinPosition(index: number, total: number) {
  const spread = Math.max(total, 1);
  return {
    left: `${12 + ((index * 17) % 74)}%`,
    top: `${18 + ((index * 23) % 62)}%`,
    zIndex: spread - index,
  };
}

function formatLabel(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function OperationsMap({ trucks, jobs, facilities, selectedJobId, onSelectJob }: OperationsMapProps) {
  const activeRoutes = useMemo(
    () => jobs.filter((job) => ["active", "accepted", "in_progress", "awarded"].includes(job.status)).slice(0, 8),
    [jobs],
  );
  const facilityMarkers = useMemo(() => facilities.filter((site) => site.isActive).slice(0, 8), [facilities]);
  const truckMarkers = useMemo(() => trucks.slice(0, 12), [trucks]);

  return (
    <section
      aria-label="Live operations map"
      className="relative h-full min-h-[520px] overflow-hidden border-2 border-border bg-card"
      data-testid="dispatcher-live-map"
    >
      <div className="absolute inset-0 bg-[linear-gradient(to_right,hsl(var(--border))_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border))_1px,transparent_1px)] bg-[size:48px_48px] opacity-40" />
      <div className="absolute inset-0 bg-gradient-to-br from-muted/60 via-transparent to-primary/5" />

      <div className="absolute left-4 top-4 z-20 flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="rounded-none border-2 bg-background/95 font-bold uppercase">
          <Navigation className="mr-1 h-3 w-3 text-primary" /> Live map
        </Badge>
        <Badge variant="outline" className="rounded-none border-2 bg-background/95 font-bold uppercase">
          <TrafficCone className="mr-1 h-3 w-3 text-amber-600" /> Traffic
        </Badge>
        <Badge variant="outline" className="rounded-none border-2 bg-background/95 font-bold uppercase">
          <Timer className="mr-1 h-3 w-3 text-blue-600" /> ETA
        </Badge>
      </div>

      <div className="absolute right-4 top-4 z-20 w-64 border-2 border-border bg-background/95 p-3 shadow-sm">
        <div className="text-xs font-black uppercase tracking-wider text-muted-foreground">Facility status</div>
        <div className="mt-2 space-y-2">
          {facilityMarkers.slice(0, 3).map((facility) => (
            <div key={facility.id} className="flex items-center justify-between gap-3 text-xs">
              <span className="truncate font-semibold">{facility.name}</span>
              <Badge variant={facility.isActive ? "default" : "secondary"} className="rounded-none text-[10px] uppercase">
                {facility.isActive ? "Open" : "Offline"}
              </Badge>
            </div>
          ))}
          {facilityMarkers.length === 0 && <p className="text-xs text-muted-foreground">No facilities returned.</p>}
        </div>
      </div>

      <svg className="absolute inset-0 z-10 h-full w-full" aria-hidden="true">
        {activeRoutes.map((job, index) => {
          const y = 24 + ((index * 11) % 52);
          const selected = job.id === selectedJobId;
          return (
            <path
              key={job.id}
              d={`M ${10 + index * 4} ${y} C ${32 + index * 3} ${y - 12}, ${58 - index * 2} ${y + 16}, ${86 - index * 3} ${y + 5}`}
              fill="none"
              stroke={selected ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))"}
              strokeDasharray={selected ? "0" : "8 6"}
              strokeLinecap="round"
              strokeWidth={selected ? 4 : 2}
              opacity={selected ? 0.9 : 0.4}
            />
          );
        })}
      </svg>

      {activeRoutes.map((job, index) => (
        <button
          key={`pickup-${job.id}`}
          type="button"
          style={pinPosition(index, activeRoutes.length)}
          className={cn(
            "absolute z-20 flex -translate-x-1/2 -translate-y-1/2 items-center gap-1 border-2 bg-background px-2 py-1 text-xs font-bold shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            job.id === selectedJobId ? "border-primary text-primary" : "border-border hover:border-primary",
          )}
          onClick={() => onSelectJob(job.id)}
          aria-label={`Select pickup for job ${job.id}`}
        >
          <MapPin className="h-3 w-3" /> JOB-{job.id}
        </button>
      ))}

      {activeRoutes.map((job, index) => (
        <button
          key={`dropoff-${job.id}`}
          type="button"
          style={pinPosition(index + 5, activeRoutes.length + 5)}
          className={cn(
            "absolute z-20 flex -translate-x-1/2 -translate-y-1/2 items-center gap-1 border-2 bg-background px-2 py-1 text-xs font-bold shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            job.id === selectedJobId ? "border-primary text-primary" : "border-border hover:border-primary",
          )}
          onClick={() => onSelectJob(job.id)}
          aria-label={`Select dropoff for job ${job.id}`}
        >
          <Building2 className="h-3 w-3" /> {formatLabel(job.materialType)}
        </button>
      ))}

      {truckMarkers.map((truck, index) => (
        <div
          key={truck.id}
          style={pinPosition(index + 2, truckMarkers.length + 2)}
          className={cn(
            "absolute z-30 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center border-2 bg-background shadow-sm",
            truck.isAvailable ? "border-green-500 text-green-600" : "border-muted-foreground/50 text-muted-foreground",
          )}
          title={truck.truckNumber ? `Truck ${truck.truckNumber}` : formatLabel(truck.truckType)}
          aria-label={truck.truckNumber ? `Truck ${truck.truckNumber}` : formatLabel(truck.truckType)}
        >
          <Truck className="h-4 w-4" />
        </div>
      ))}

      {facilityMarkers.map((facility, index) => (
        <div
          key={facility.id}
          style={pinPosition(index + 8, facilityMarkers.length + 8)}
          className="absolute z-20 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center border-2 border-blue-500 bg-background text-blue-600 shadow-sm"
          title={facility.fullAddress ?? facility.address}
          aria-label={`${facility.name} facility`}
        >
          <Building2 className="h-4 w-4" />
        </div>
      ))}

      <div className="absolute bottom-4 left-4 right-4 z-20 grid gap-3 md:grid-cols-3">
        <div className="border-2 border-border bg-background/95 p-3">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-muted-foreground">
            <Route className="h-3 w-3" /> Routes
          </div>
          <p className="mt-1 text-2xl font-black">{activeRoutes.length}</p>
        </div>
        <div className="border-2 border-border bg-background/95 p-3">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-muted-foreground">
            <Timer className="h-3 w-3" /> Average ETA
          </div>
          <p className="mt-1 text-2xl font-black">{activeRoutes.length ? `${Math.round(activeRoutes.reduce((sum, job) => sum + job.estimatedHours, 0) / activeRoutes.length)}h` : "—"}</p>
        </div>
        <div className="border-2 border-border bg-background/95 p-3">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-muted-foreground">
            <AlertTriangle className="h-3 w-3" /> Recommendations
          </div>
          <p className="mt-1 text-sm font-semibold">{trucks.filter((truck) => truck.isAvailable).length} trucks available for dispatch</p>
        </div>
      </div>
    </section>
  );
}

export default memo(OperationsMap);
