import { memo } from "react";
import { Link } from "wouter";
import { format } from "date-fns";
import { ArrowRight, MapPin, Truck, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared";
import { formatJobEta, type CustomerJobView } from "@/lib/customerJobView";

interface ActiveJobCardProps {
  job: CustomerJobView;
  onSelect?: (jobId: number) => void;
  selected?: boolean;
}

export const ActiveJobCard = memo(function ActiveJobCard({
  job,
  onSelect,
  selected,
}: ActiveJobCardProps) {
  const eta = formatJobEta(job);

  return (
    <article
      className={`bg-card border-2 transition-colors flex flex-col ${
        selected ? "border-primary" : "border-border hover:border-primary/50"
      }`}
      aria-label={`Active job ${job.id}`}
    >
      <div className="p-4 border-b border-border/50 flex justify-between items-start bg-muted/10 gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-mono text-sm font-bold text-muted-foreground uppercase tracking-wider">
              JOB-{job.id.toString().padStart(4, "0")}
            </span>
            <StatusBadge status={job.status} />
          </div>
          <h3 className="text-base font-bold capitalize truncate">{job.materialType} Haul</h3>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-xs font-bold text-muted-foreground uppercase">ETA</p>
          <p className="text-sm font-black">{eta ?? "—"}</p>
        </div>
      </div>

      <div className="p-4 flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Driver / Carrier</p>
          <p className="font-semibold flex items-center gap-2 truncate">
            <User className="h-4 w-4 text-primary flex-shrink-0" aria-hidden="true" />
            {job.driverLabel}
          </p>
        </div>
        <div>
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Truck</p>
          <p className="font-semibold flex items-center gap-2 capitalize">
            <Truck className="h-4 w-4 text-primary flex-shrink-0" aria-hidden="true" />
            {job.truckType.replace(/_/g, " ")} × {job.trucksAssigned}
          </p>
        </div>
        <div>
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Material / Qty</p>
          <p className="font-semibold capitalize">{job.materialType}</p>
        </div>
        <div>
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Scheduled</p>
          <p className="font-semibold">{format(new Date(job.scheduledDate), "MMM d, yyyy")}</p>
        </div>
        <div className="sm:col-span-2">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Pickup</p>
          <p className="font-medium flex items-start gap-2 text-muted-foreground">
            <MapPin className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" aria-hidden="true" />
            <span className="line-clamp-2">{job.pickupAddress}</span>
          </p>
        </div>
        <div className="sm:col-span-2">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Dropoff</p>
          <p className="font-medium flex items-start gap-2 text-muted-foreground">
            <MapPin className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" aria-hidden="true" />
            <span className="line-clamp-2">{job.deliveryAddress}</span>
          </p>
        </div>
      </div>

      <div className="p-3 bg-muted/30 border-t border-border mt-auto flex gap-2">
        {onSelect && (
          <Button
            variant="ghost"
            size="sm"
            className="rounded-none font-bold text-xs"
            onClick={() => onSelect(job.id)}
          >
            Highlight on Map
          </Button>
        )}
        <Link href={`/jobs/${job.id}`} className="flex-1">
          <Button variant="outline" className="w-full rounded-none border-2 font-bold group">
            View Details
            <ArrowRight className="ml-2 h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" aria-hidden="true" />
          </Button>
        </Link>
      </div>
    </article>
  );
});
