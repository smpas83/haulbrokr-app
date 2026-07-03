import { Link } from "wouter";
import { format } from "date-fns";
import { Briefcase, ArrowRight, HardHat, Truck, Clock } from "lucide-react";
import { useListJobs, useGetMyProfile } from "@workspace/api-client-react";

import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/status-badge";
import { PageHeader } from "@/components/shared/page-header";
import { PageEmptyState, PageLoadingSkeleton } from "@/components/shared/page-states";

export default function JobsPage() {
  const { data: profile } = useGetMyProfile();
  const { data: jobs, isLoading } = useListJobs();
  
  const isCustomer = profile?.role === "customer";

  return (
    <div className="mx-auto max-w-6xl animate-in fade-in space-y-6 duration-500">
      <PageHeader
        title="Active Jobs"
        description="Track and manage accepted hauling jobs."
      />

      {isLoading ? (
        <PageLoadingSkeleton rows={4} className="h-40 w-full rounded-none" />
      ) : jobs && jobs.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {jobs.map(job => (
            <div key={job.id} className="flex flex-col border-2 border-border bg-card transition-colors hover:border-primary/50">
              <div className="flex items-start justify-between border-b border-border/50 bg-muted/10 p-5">
                <div>
                  <div className="mb-1 flex items-center gap-2">
                    <span className="font-mono text-sm font-bold uppercase tracking-wider text-muted-foreground">JOB-{job.id.toString().padStart(4, '0')}</span>
                    <StatusBadge status={job.status} domain="job" className="border-2" />
                  </div>
                  <h3 className="text-lg font-bold capitalize text-foreground">{job.materialType} Haul</h3>
                </div>
                <div className="text-right">
                  <div className="text-xl font-black">${job.ratePerHour}<span className="text-sm font-medium text-muted-foreground">/hr</span></div>
                  <div className="mt-1 flex items-center justify-end gap-1 text-xs font-semibold text-muted-foreground">
                    <Truck className="h-3 w-3" /> {job.trucksAssigned} Trucks
                  </div>
                </div>
              </div>
              
              <div className="grid flex-1 grid-cols-2 gap-4 p-5">
                <div>
                  <p className="mb-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    {isCustomer ? "Provider" : "Customer"}
                  </p>
                  <p className="flex items-center gap-2 font-semibold">
                    {isCustomer ? <Truck className="h-4 w-4 text-primary" /> : <HardHat className="h-4 w-4 text-primary" />}
                    {isCustomer ? job.providerCompany : job.customerCompany}
                  </p>
                </div>
                
                <div>
                  <p className="mb-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">Date</p>
                  <p className="flex items-center gap-2 font-semibold">
                    <Clock className="h-4 w-4 text-primary" />
                    {format(new Date(job.scheduledDate), "MMM d, yyyy")}
                  </p>
                </div>
              </div>
              
              <div className="mt-auto border-t border-border bg-muted/30 p-4">
                <Link href={`/jobs/${job.id}`}>
                  <Button variant="outline" className="group w-full rounded-none border-2 font-bold">
                    View Dispatch Details
                    <ArrowRight className="ml-2 h-4 w-4 text-muted-foreground transition-colors group-hover:text-foreground" />
                  </Button>
                </Link>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <PageEmptyState
          icon={Briefcase}
          title="No active jobs"
          description={
            isCustomer
              ? "You don't have any active hauling jobs yet. Accept a bid on one of your open requests to create a job."
              : "You don't have any active hauling jobs yet. Place bids on open requests to secure work."
          }
          action={
            <Link href="/requests">
              <Button className="h-12 rounded-none px-8 font-bold">
                {isCustomer ? "View Requests" : "Browse Job Board"}
              </Button>
            </Link>
          }
        />
      )}
    </div>
  );
}
