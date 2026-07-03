import { memo, useState } from "react";
import { Link } from "wouter";
import { format } from "date-fns";
import { User, Truck as TruckIcon, MapPin, ArrowRight } from "lucide-react";
import type { Job } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge, EmptyState, ProgressBar } from "@/components/shared";
import { cn } from "@/lib/utils";

interface DispatchQueueProps {
  jobs: Job[];
  ticketCounts: Record<number, number>;
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  onAssign?: (jobId: number) => void;
}

function recommendationScore(job: Job, ticketCount: number): number {
  if (ticketCount > 0) return 100;
  const urgency = job.status === "awarded" ? 90 : 70;
  return urgency;
}

export const DispatchQueue = memo(function DispatchQueue({
  jobs,
  ticketCounts,
  isLoading,
  isError,
  onRetry,
  onAssign,
}: DispatchQueueProps) {
  const [selectedId, setSelectedId] = useState<number | null>(null);

  if (isLoading) {
    return (
      <Card className="rounded-none border-2 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-bold">Dispatch Queue</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-none" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card className="rounded-none border-2 shadow-sm">
        <CardContent className="py-10 text-center space-y-3">
          <p className="text-sm text-destructive font-semibold">Failed to load dispatch queue</p>
          {onRetry && (
            <Button variant="outline" size="sm" className="rounded-none border-2" onClick={onRetry}>
              Retry
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  const queueJobs = jobs.filter((j) => ["awarded", "accepted", "active", "in_progress"].includes(j.status));

  return (
    <Card className="rounded-none border-2 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-bold">Dispatch Queue</CardTitle>
        <CardDescription>{queueJobs.length} jobs in queue — assign drivers and trucks</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {queueJobs.length === 0 ? (
          <EmptyState
            icon={TruckIcon}
            title="Queue is clear"
            description="No jobs pending dispatch assignment."
            className="border-0"
          />
        ) : (
          <ul className="divide-y divide-border" role="list" aria-label="Dispatch queue">
            {queueJobs.map((job) => {
              const ticketCount = ticketCounts[job.id] ?? 0;
              const score = recommendationScore(job, ticketCount);
              const needsAssign = ticketCount === 0;

              return (
                <li
                  key={job.id}
                  className={cn(
                    "p-4 hover:bg-muted/30 transition-colors",
                    selectedId === job.id && "bg-muted/40"
                  )}
                >
                  <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <Avatar className="h-10 w-10 rounded-none border border-border flex-shrink-0">
                        <AvatarFallback className="rounded-none bg-muted">
                          <User className="h-4 w-4" aria-hidden="true" />
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-1 text-sm">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Truck / Load</p>
                          <p className="font-semibold truncate">
                            {job.trucksAssigned} truck{job.trucksAssigned === 1 ? "" : "s"} · JOB-{String(job.id).padStart(4, "0")}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Material</p>
                          <p className="font-semibold capitalize truncate">{job.materialType}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Pickup</p>
                          <p className="truncate flex items-center gap-1">
                            <MapPin className="h-3 w-3 flex-shrink-0 text-primary" aria-hidden="true" />
                            {job.pickupAddress}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Dropoff</p>
                          <p className="truncate">{job.deliveryAddress}</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 lg:flex-shrink-0">
                      <div className="text-right">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">ETA / Date</p>
                        <p className="text-sm font-semibold tabular-nums">
                          {format(new Date(job.scheduledDate), "MMM d")} · {job.startTime}
                        </p>
                      </div>
                      <StatusBadge status={job.status} />
                      <div className="w-24">
                        <ProgressBar value={score} label="Score" showValue />
                      </div>
                      {needsAssign ? (
                        <Button
                          size="sm"
                          className="rounded-none font-bold"
                          onClick={() => {
                            setSelectedId(job.id);
                            onAssign?.(job.id);
                          }}
                        >
                          Quick Assign
                        </Button>
                      ) : (
                        <Link href={`/jobs/${job.id}`}>
                          <Button size="sm" variant="outline" className="rounded-none border-2 font-bold">
                            View
                            <ArrowRight className="ml-1 h-3 w-3" />
                          </Button>
                        </Link>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
});
