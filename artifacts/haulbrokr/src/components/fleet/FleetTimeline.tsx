import { lazy, memo, Suspense } from "react";
import { format } from "date-fns";
import { ChevronDown, ChevronUp, ListChecks } from "lucide-react";
import type { Job, Truck } from "@workspace/api-client-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, AppLoader } from "@/components/shared";
import { useFleetTimeline } from "@/hooks/useFleetDashboardData";
import { cn } from "@/lib/utils";

function TimelineContent({ trucks, jobs }: { trucks: Truck[]; jobs: Job[] }) {
  const { data, isLoading, isError, refetch } = useFleetTimeline(trucks, jobs);

  if (isLoading) {
    return (
      <div className="space-y-3 p-4" aria-busy="true">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-12 w-full rounded-none" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-4 text-center space-y-2">
        <p className="text-sm text-destructive font-semibold">Failed to load timeline</p>
        <Button variant="outline" size="sm" className="rounded-none border-2" onClick={() => refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  const groups = data ?? [];
  const hasEvents = groups.some((g) => g.updates.length > 0);

  if (!hasEvents) {
    return (
      <EmptyState
        icon={ListChecks}
        title="No timeline events"
        description="Driver shift, job acceptance, quarry check-in, load, delivery, and payment events will appear grouped by truck."
        className="border-0 py-6"
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <div className="flex gap-6 p-4 min-w-max">
        {groups.map(({ truck, job, updates }) => (
          <div
            key={truck.id}
            className="w-72 flex-shrink-0 border border-border bg-card/50 backdrop-blur-sm"
            role="group"
            aria-label={`Timeline for truck ${truck.truckNumber ?? truck.id}`}
          >
            <div className="px-3 py-2 border-b border-border bg-muted/30">
              <p className="text-xs font-mono font-bold">
                {truck.truckNumber ? `#${truck.truckNumber}` : `Truck ${truck.id}`}
              </p>
              <p className="text-xs text-muted-foreground capitalize truncate">
                {job
                  ? `${job.materialType} · JOB-${String(job.id).padStart(4, "0")}`
                  : truck.isAvailable ? "Available" : "Idle"}
              </p>
            </div>
            <ol className="p-3 space-y-2 max-h-40 overflow-y-auto">
              {updates.length === 0 ? (
                <li className="text-xs text-muted-foreground">No events yet</li>
              ) : (
                updates.map((u: { id: number; status: string; createdAt: string; note?: string | null }) => (
                  <li key={u.id} className="flex items-start gap-2 text-xs">
                    <span className="w-2 h-2 rounded-full bg-primary mt-1 flex-shrink-0" aria-hidden="true" />
                    <div>
                      <p className="font-bold capitalize">{u.status.replace(/_/g, " ")}</p>
                      <time className="text-muted-foreground" dateTime={u.createdAt}>
                        {format(new Date(u.createdAt), "MMM d, h:mm a")}
                      </time>
                      {u.note && <p className="text-muted-foreground mt-0.5">{u.note}</p>}
                    </div>
                  </li>
                ))
              )}
            </ol>
          </div>
        ))}
      </div>
    </div>
  );
}

const LazyTimelineContent = lazy(async () => ({
  default: TimelineContent,
}));

interface FleetTimelineProps {
  trucks: Truck[];
  jobs: Job[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const FleetTimeline = memo(function FleetTimeline({
  trucks,
  jobs,
  open,
  onOpenChange,
}: FleetTimelineProps) {
  return (
    <Collapsible open={open} onOpenChange={onOpenChange}>
      <div className="border-t-2 border-border bg-card/80 backdrop-blur-sm">
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className="w-full h-10 rounded-none justify-between px-4 font-bold text-sm"
            aria-expanded={open}
          >
            <span className="flex items-center gap-2">
              <ListChecks className="h-4 w-4" aria-hidden="true" />
              Fleet Timeline
            </span>
            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent
          className={cn(
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "motion-reduce:animate-none"
          )}
        >
          <Suspense fallback={<AppLoader className="min-h-[120px]" label="Loading timeline" />}>
            <LazyTimelineContent trucks={trucks} jobs={jobs} />
          </Suspense>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
});
