import { Link } from "wouter";
import { format } from "date-fns";
import { Briefcase, ArrowRight, HardHat, Truck, Clock } from "lucide-react";
import { useListJobs, useGetMyProfile, type UserProfile } from "@workspace/api-client-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import DriverJobsBoard from "@/pages/driver/DriverJobsBoard";

export default function JobsPage() {
  const { data: profile } = useGetMyProfile();

  if (profile?.role === "driver") {
    return <DriverJobsBoard />;
  }

  return <StandardJobsPage profile={profile} />;
}

function StandardJobsPage({ profile }: { profile?: UserProfile | null }) {
  const { data: jobs, isLoading } = useListJobs();
  const isCustomer = profile?.role === "customer";

  const getStatusColor = (status: string) => {
    switch (status) {
      case "awarded": return "bg-amber-100 text-amber-900 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800";
      case "accepted":
      case "active": return "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800";
      case "declined":
      case "cancelled": return "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800";
      case "in_progress": return "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800";
      case "completed": return "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800";
      default: return "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700";
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-6xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Active Jobs</h1>
        <p className="text-muted-foreground">Track and manage accepted hauling jobs.</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-40 w-full rounded-none" />)}
        </div>
      ) : jobs && jobs.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {jobs.map(job => (
            <div key={job.id} className="bg-card border-2 border-border hover:border-primary/50 transition-colors flex flex-col">
              <div className="p-5 border-b border-border/50 flex justify-between items-start bg-muted/10">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-sm font-bold text-muted-foreground uppercase tracking-wider">JOB-{job.id.toString().padStart(4, '0')}</span>
                    <Badge variant="outline" className={`rounded-none border-2 font-bold uppercase text-[10px] ${getStatusColor(job.status)}`}>
                      {job.status.replace('_', ' ')}
                    </Badge>
                  </div>
                  <h3 className="text-lg font-bold capitalize text-foreground">{job.materialType} Haul</h3>
                </div>
                <div className="text-right">
                  <div className="text-xl font-black">${job.ratePerHour}<span className="text-sm text-muted-foreground font-medium">/hr</span></div>
                  <div className="text-xs font-semibold text-muted-foreground flex items-center gap-1 justify-end mt-1">
                    <Truck className="h-3 w-3" /> {job.trucksAssigned} Trucks
                  </div>
                </div>
              </div>
              
              <div className="p-5 flex-1 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">
                    {isCustomer ? "Provider" : "Customer"}
                  </p>
                  <p className="font-semibold flex items-center gap-2">
                    {isCustomer ? <Truck className="h-4 w-4 text-primary" /> : <HardHat className="h-4 w-4 text-primary" />}
                    {isCustomer ? job.providerCompany : job.customerCompany}
                  </p>
                </div>
                
                <div>
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Date</p>
                  <p className="font-semibold flex items-center gap-2">
                    <Clock className="h-4 w-4 text-primary" />
                    {format(new Date(job.scheduledDate), "MMM d, yyyy")}
                  </p>
                </div>
              </div>
              
              <div className="p-4 bg-muted/30 border-t border-border mt-auto">
                <Link href={`/jobs/${job.id}`}>
                  <Button variant="outline" className="w-full rounded-none border-2 font-bold group">
                    View Dispatch Details
                    <ArrowRight className="ml-2 h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                  </Button>
                </Link>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-card border-2 border-dashed border-border p-12 text-center">
          <Briefcase className="h-16 w-16 text-muted-foreground mx-auto mb-4 opacity-50" />
          <h3 className="text-xl font-bold mb-2">No active jobs</h3>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            {isCustomer 
              ? "You don't have any active hauling jobs yet. Accept a bid on one of your open requests to create a job." 
              : "You don't have any active hauling jobs yet. Place bids on open requests to secure work."}
          </p>
          <Link href="/requests">
            <Button className="font-bold rounded-none h-12 px-8">
              {isCustomer ? "View Requests" : "Browse Job Board"}
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}