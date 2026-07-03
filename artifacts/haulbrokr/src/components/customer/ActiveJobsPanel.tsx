import { memo } from "react";
import { Briefcase } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared";
import { ActiveJobCard } from "./ActiveJobCard";
import { redactJobForCustomer, type CustomerJobView } from "@/lib/customerJobView";
import type { Job } from "@workspace/api-client-react";
import { Link } from "wouter";

interface ActiveJobsPanelProps {
  jobs: Job[];
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  selectedJobId?: number | null;
  onSelectJob?: (jobId: number) => void;
}

export const ActiveJobsPanel = memo(function ActiveJobsPanel({
  jobs,
  isLoading,
  isError,
  onRetry,
  selectedJobId,
  onSelectJob,
}: ActiveJobsPanelProps) {
  const safeJobs: CustomerJobView[] = jobs.map(redactJobForCustomer);

  return (
    <Card className="rounded-none border-2 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-bold">Active Jobs</CardTitle>
        <CardDescription>Live hauls in progress — driver pay and pricing hidden</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" aria-busy="true">
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-64 w-full rounded-none" />
            ))}
          </div>
        ) : isError ? (
          <div className="text-center py-8 space-y-3">
            <p className="text-sm text-destructive font-semibold">Failed to load active jobs</p>
            {onRetry && (
              <Button variant="outline" size="sm" className="rounded-none border-2" onClick={onRetry}>
                Retry
              </Button>
            )}
          </div>
        ) : safeJobs.length === 0 ? (
          <EmptyState
            icon={Briefcase}
            title="No active jobs"
            description="Accept a bid on an open request to start tracking hauls here."
            action={
              <Link href="/requests">
                <Button className="rounded-none font-bold">View Requests</Button>
              </Link>
            }
            className="border-0"
          />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {safeJobs.map((job) => (
              <ActiveJobCard
                key={job.id}
                job={job}
                selected={selectedJobId === job.id}
                onSelect={onSelectJob}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
});
