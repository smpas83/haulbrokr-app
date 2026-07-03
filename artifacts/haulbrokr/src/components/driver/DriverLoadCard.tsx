import { memo } from "react";
import { Link } from "wouter";
import { format } from "date-fns";
import {
  ArrowRight,
  Clock,
  MapPin,
  Navigation,
  Package,
  Scale,
  Truck,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import {
  formatDeadline,
  formatDriverPay,
  navigationUrl,
  type DriverSafeJob,
} from "@/lib/driverJobView";

import { ProgressBar } from "../shared/ProgressBar";
import { StatusBadge } from "../shared/StatusBadge";

export type DriverLoadCardProps = {
  job: DriverSafeJob;
  section: "available" | "accepted" | "in_progress" | "completed";
  facilityInstructions?: string;
  distanceMiles?: number | null;
  etaLabel?: string | null;
  onAccept?: () => void;
  acceptPending?: boolean;
};

export const DriverLoadCard = memo(function DriverLoadCard({
  job,
  section,
  facilityInstructions,
  distanceMiles,
  etaLabel,
  onAccept,
  acceptPending,
}: DriverLoadCardProps) {
  const showAccept = section === "available" && onAccept;

  return (
    <Card className="rounded-none border-2 transition-colors hover:border-primary/40">
      <CardHeader className="space-y-3 border-b border-border/50 bg-muted/10 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">
                LOAD-{job.id.toString().padStart(4, "0")}
              </span>
              <StatusBadge status={job.status} />
            </div>
            <h3 className="text-lg font-bold capitalize">{job.materialType} Haul</h3>
          </div>
          <div className="text-right">
            <div className="text-2xl font-black text-primary tabular-nums">{formatDriverPay(job.driverPay)}</div>
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Driver pay</div>
          </div>
        </div>
        <ProgressBar value={section === "completed" ? 100 : section === "in_progress" ? 65 : section === "accepted" ? 30 : 10} />
      </CardHeader>

      <CardContent className="grid gap-4 p-5 sm:grid-cols-2">
        <InfoRow icon={MapPin} label="Pickup" value={job.pickupAddress} />
        <InfoRow icon={Truck} label="Dropoff facility" value={job.deliveryAddress} />
        <InfoRow icon={Package} label="Material" value={job.materialType} />
        <InfoRow
          icon={Scale}
          label="Load quantity"
          value={`${job.trucksAssigned} truck${job.trucksAssigned === 1 ? "" : "s"} · est. ${job.estimatedHours}h`}
        />
        <InfoRow icon={Clock} label="Deadline" value={formatDeadline(job)} />
        {distanceMiles != null ? (
          <InfoRow icon={Navigation} label="Distance" value={`${distanceMiles.toFixed(1)} mi`} />
        ) : (
          <InfoRow icon={Navigation} label="Distance" value="—" />
        )}
        {etaLabel ? <InfoRow icon={Clock} label="ETA" value={etaLabel} className="sm:col-span-2" /> : null}
        {facilityInstructions ? (
          <div className="sm:col-span-2 rounded-none border border-border bg-muted/20 p-3">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Facility instructions</p>
            <p className="mt-1 text-sm leading-relaxed">{facilityInstructions}</p>
          </div>
        ) : null}
      </CardContent>

      <CardFooter className="flex flex-col gap-2 border-t border-border bg-muted/20 p-4 sm:flex-row">
        {showAccept ? (
          <Button
            className="h-12 w-full rounded-none font-bold sm:flex-1"
            onClick={onAccept}
            disabled={acceptPending}
          >
            Accept Load
          </Button>
        ) : null}
        <Link href={`/jobs/${job.id}`} className={showAccept ? "w-full sm:flex-1" : "w-full"}>
          <Button variant="outline" className="h-12 w-full rounded-none border-2 font-bold group">
            View Details
            <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
          </Button>
        </Link>
        <Button
          variant="secondary"
          className="h-12 w-full rounded-none border-2 font-bold sm:w-auto"
          asChild
        >
          <a href={navigationUrl(job.pickupAddress)} target="_blank" rel="noopener noreferrer">
            <Navigation className="mr-2 h-4 w-4" aria-hidden />
            Navigate
          </a>
        </Button>
      </CardFooter>
    </Card>
  );
});

function InfoRow({
  icon: Icon,
  label,
  value,
  className,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="mb-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="flex items-start gap-2 text-sm font-semibold leading-snug">
        <Icon className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" aria-hidden />
        <span>{value}</span>
      </p>
    </div>
  );
}

export function formatJobEta(job: DriverSafeJob): string | null {
  if (!job.scheduledDate) return null;
  try {
    return format(new Date(job.scheduledDate), "MMM d, h:mm a");
  } catch {
    return null;
  }
}
