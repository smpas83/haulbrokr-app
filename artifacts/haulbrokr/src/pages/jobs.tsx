import { Link } from "wouter";
import { format } from "date-fns";
import { Briefcase, ArrowRight, HardHat, Truck, Clock } from "lucide-react";
import { useListJobs, useGetMyProfile } from "@workspace/api-client-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader, StatusChip, EmptyState } from "@/components/design";

export default function JobsPage() {
  const { data: profile } = useGetMyProfile();
  const { data: jobs, isLoading } = useListJobs();
  
  const isCustomer = profile?.role === "customer";

  return (
    <div className="space-y-6 page-enter max-w-6xl mx-auto">
      <PageHeader
        title="Active Jobs"
        description="Track and manage accepted hauling jobs."
      />

      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-44 w-full rounded-xl" />)}
        </div>
      ) : jobs && jobs.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {jobs.map(job => (
            <div key={job.id} className="rounded-xl border border-border/60 bg-card hover:border-primary/30 hover:shadow-lg hover:shadow-black/10 transition-all flex flex-col">
              <div className="p-5 border-b border-border/40 flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-mono text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      JOB-{job.id.toString().padStart(4, '0')}
                    </span>
                    <StatusChip status={job.status} />
                  </div>
                  <h3 className="text-lg font-semibold capitalize">{job.materialType} Haul</h3>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold stat-number text-accent">
                    ${job.ratePerHour}
                    <span className="text-sm text-muted-foreground font-medium">/hr</span>
                  </div>
                  <div className="text-xs font-medium text-muted-foreground flex items-center gap-1 justify-end mt-1">
                    <Truck className="h-3 w-3" /> {job.trucksAssigned} Trucks
                  </div>
                </div>
              </div>
              
              <div className="p-5 flex-1 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                    {isCustomer ? "Provider" : "Customer"}
                  </p>
                  <p className="font-medium flex items-center gap-2 text-sm">
                    {isCustomer ? <Truck className="h-4 w-4 text-primary" /> : <HardHat className="h-4 w-4 text-primary" />}
                    {isCustomer ? job.providerCompany : job.customerCompany}
                  </p>
                </div>
                
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Date</p>
                  <p className="font-medium flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    {format(new Date(job.scheduledDate), "MMM d, yyyy")}
                  </p>
                </div>
              </div>
              
              <div className="p-4 border-t border-border/40 mt-auto">
                <Link href={`/jobs/${job.id}`}>
                  <Button variant="outline" className="w-full group">
                    View Dispatch Details
                    <ArrowRight className="ml-2 h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  </Button>
                </Link>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Briefcase}
          title="No active jobs"
          description={
            isCustomer 
              ? "You don't have any active hauling jobs yet. Accept a bid on one of your open requests to create a job." 
              : "You don't have any active hauling jobs yet. Place bids on open requests to secure work."
          }
          action={{ label: isCustomer ? "View Requests" : "Browse Load Board", href: "/requests" }}
        />
      )}
    </div>
  );
}
