import { memo } from "react";
import { Link } from "wouter";
import {
  MessageSquare, Phone, Truck, User, Briefcase, Eye,
} from "lucide-react";
import type { Job, Truck as TruckType } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge, AsyncSection } from "@/components/shared";
import {
  findActiveJobForTruck,
  getDriverStatusFromJob,
  getTruckStatusLabel,
} from "@/lib/fleetDashboardView";
import { cn } from "@/lib/utils";

interface FleetGridProps {
  trucks: TruckType[];
  jobs: Job[];
  drivers: Array<{ id: number; contactName?: string | null; companyName?: string | null }>;
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  selectedTruckId?: number | null;
  onSelectTruck?: (truckId: number) => void;
}

function getDriverName(
  truck: TruckType,
  drivers: FleetGridProps["drivers"]
): string {
  if (!truck.assignedDriverId) return "Unassigned";
  const driver = drivers.find((d) => d.id === truck.assignedDriverId);
  return driver?.contactName || driver?.companyName || `Driver #${truck.assignedDriverId}`;
}

export const FleetGrid = memo(function FleetGrid({
  trucks,
  jobs,
  drivers,
  isLoading,
  isError,
  onRetry,
  selectedTruckId,
  onSelectTruck,
}: FleetGridProps) {
  return (
    <Card className="rounded-none border-2 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-bold">Fleet Grid</CardTitle>
        <CardDescription>All trucks — status, current job, and quick actions</CardDescription>
      </CardHeader>
      <CardContent>
        <AsyncSection
          isLoading={isLoading}
          isError={isError}
          isEmpty={!isLoading && !isError && trucks.length === 0}
          onRetry={onRetry}
          emptyIcon={Truck}
          emptyTitle="No trucks in fleet"
          emptyDescription="Add trucks to your fleet to start monitoring operations."
          skeletonHeight="h-48"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {trucks.map((truck) => {
              const activeJob = findActiveJobForTruck(truck, jobs);
              const driverName = getDriverName(truck, drivers);
              const driverStatus = getDriverStatusFromJob(activeJob);
              const isSelected = selectedTruckId === truck.id;

              return (
                <article
                  key={truck.id}
                  className={cn(
                    "border-2 border-border bg-card p-4 space-y-3 transition-colors",
                    isSelected && "border-primary/50 bg-primary/5",
                    onSelectTruck && "cursor-pointer hover:border-primary/30"
                  )}
                  onClick={() => onSelectTruck?.(truck.id)}
                  aria-label={`Truck ${truck.truckNumber ?? truck.id}`}
                  aria-selected={isSelected}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="bg-muted p-2">
                        <Truck className="h-5 w-5 text-primary" aria-hidden="true" />
                      </div>
                      <div>
                        <p className="font-black text-sm">
                          {truck.truckNumber ? `#${truck.truckNumber}` : `Truck ${truck.id}`}
                        </p>
                        <p className="text-xs text-muted-foreground capitalize">
                          {truck.truckType.replace(/_/g, " ")}
                        </p>
                      </div>
                    </div>
                    <StatusBadge status={getTruckStatusLabel(truck)} />
                  </div>

                  <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                    <div>
                      <dt className="font-bold uppercase tracking-wider text-muted-foreground">Driver</dt>
                      <dd className="font-semibold flex items-center gap-1 mt-0.5">
                        <User className="h-3 w-3" aria-hidden="true" />
                        {driverName}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-bold uppercase tracking-wider text-muted-foreground">Status</dt>
                      <dd className="mt-0.5">
                        <StatusBadge status={driverStatus} />
                      </dd>
                    </div>
                    <div className="col-span-2">
                      <dt className="font-bold uppercase tracking-wider text-muted-foreground">Current Job</dt>
                      <dd className="font-semibold mt-0.5">
                        {activeJob
                          ? `JOB-${String(activeJob.id).padStart(4, "0")} · ${activeJob.materialType}`
                          : "—"}
                      </dd>
                    </div>
                    {activeJob && (
                      <>
                        <div>
                          <dt className="font-bold uppercase tracking-wider text-muted-foreground">Material</dt>
                          <dd className="font-semibold capitalize mt-0.5">{activeJob.materialType}</dd>
                        </div>
                        <div>
                          <dt className="font-bold uppercase tracking-wider text-muted-foreground">Destination</dt>
                          <dd className="font-semibold mt-0.5 truncate" title={activeJob.deliveryAddress}>
                            {activeJob.deliveryAddress}
                          </dd>
                        </div>
                        <div>
                          <dt className="font-bold uppercase tracking-wider text-muted-foreground">ETA</dt>
                          <dd className="font-semibold mt-0.5">
                            {/* PLACEHOLDER: ChatGPT visual package — live ETA from tracking API */}
                            {activeJob.scheduledDate
                              ? new Date(activeJob.scheduledDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })
                              : "—"}
                          </dd>
                        </div>
                        <div>
                          <dt className="font-bold uppercase tracking-wider text-muted-foreground">Location</dt>
                          <dd className="font-semibold mt-0.5 truncate" title={activeJob.pickupAddress}>
                            {activeJob.pickupAddress}
                          </dd>
                        </div>
                      </>
                    )}
                    <div>
                      <dt className="font-bold uppercase tracking-wider text-muted-foreground">Availability</dt>
                      <dd className="font-semibold mt-0.5">{truck.isAvailable ? "Available" : "In Use"}</dd>
                    </div>
                    <div>
                      <dt className="font-bold uppercase tracking-wider text-muted-foreground">Hours Worked</dt>
                      <dd className="font-semibold mt-0.5 text-muted-foreground">
                        {/* PLACEHOLDER: hours worked API pending */}
                        —
                      </dd>
                    </div>
                    <div className="col-span-2">
                      <dt className="font-bold uppercase tracking-wider text-muted-foreground">Vehicle Health</dt>
                      <dd className="font-semibold mt-0.5 text-muted-foreground">
                        {/* PLACEHOLDER: ChatGPT visual package — vehicle health telemetry */}
                        —
                      </dd>
                    </div>
                  </dl>

                  <div className="flex flex-wrap gap-1.5 pt-1 border-t border-border/50">
                    <Link href={`/fleet/${truck.id}/edit`} onClick={(e) => e.stopPropagation()}>
                      <Button variant="outline" size="sm" className="rounded-none border-2 h-8 text-xs font-bold">
                        <Eye className="h-3 w-3 mr-1" aria-hidden="true" />
                        View Truck
                      </Button>
                    </Link>
                    {truck.assignedDriverId && (
                      <Link href="/company" onClick={(e) => e.stopPropagation()}>
                        <Button variant="outline" size="sm" className="rounded-none border-2 h-8 text-xs font-bold">
                          <User className="h-3 w-3 mr-1" aria-hidden="true" />
                          View Driver
                        </Button>
                      </Link>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-none border-2 h-8 text-xs font-bold"
                      disabled
                      title="PLACEHOLDER: messaging API"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MessageSquare className="h-3 w-3 mr-1" aria-hidden="true" />
                      Message
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-none border-2 h-8 text-xs font-bold"
                      disabled
                      title="PLACEHOLDER: call driver API"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Phone className="h-3 w-3 mr-1" aria-hidden="true" />
                      Call
                    </Button>
                    {activeJob && (
                      <Link href={`/jobs/${activeJob.id}`} onClick={(e) => e.stopPropagation()}>
                        <Button variant="outline" size="sm" className="rounded-none border-2 h-8 text-xs font-bold">
                          <Briefcase className="h-3 w-3 mr-1" aria-hidden="true" />
                          View Job
                        </Button>
                      </Link>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </AsyncSection>
      </CardContent>
    </Card>
  );
});
