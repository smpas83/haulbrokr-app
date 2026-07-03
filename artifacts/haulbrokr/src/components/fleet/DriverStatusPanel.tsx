import { memo, useMemo } from "react";
import { Users } from "lucide-react";
import type { Job, Truck } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge, AsyncSection } from "@/components/shared";
import { findActiveJobForTruck, getDriverStatusFromJob } from "@/lib/fleetDashboardView";

interface DriverStatusPanelProps {
  trucks: Truck[];
  jobs: Job[];
  drivers: Array<{ id: number; contactName?: string | null; companyName?: string | null }>;
  complianceStatus?: string;
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
}

const STATUS_BUCKETS = [
  "Online",
  "Driving",
  "Loading",
  "At Facility",
  "Off Duty",
  "Unavailable",
] as const;

export const DriverStatusPanel = memo(function DriverStatusPanel({
  trucks,
  jobs,
  drivers,
  complianceStatus,
  isLoading,
  isError,
  onRetry,
}: DriverStatusPanelProps) {
  const driverRows = useMemo(() => {
    return drivers.map((driver) => {
      const assignedTruck = trucks.find((t) => t.assignedDriverId === driver.id);
      const activeJob = assignedTruck ? findActiveJobForTruck(assignedTruck, jobs) : undefined;
      const status = assignedTruck
        ? getDriverStatusFromJob(activeJob)
        : "Unavailable";

      return {
        id: driver.id,
        name: driver.contactName || driver.companyName || `Driver #${driver.id}`,
        status,
        truckNumber: assignedTruck?.truckNumber,
      };
    });
  }, [drivers, trucks, jobs]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    STATUS_BUCKETS.forEach((s) => { counts[s] = 0; });
    driverRows.forEach((d) => {
      const key = STATUS_BUCKETS.find((s) => s === d.status) ?? "Unavailable";
      counts[key] = (counts[key] ?? 0) + 1;
    });
    return counts;
  }, [driverRows]);

  return (
    <Card className="rounded-none border-2 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-bold flex items-center gap-2">
          <Users className="h-4 w-4" aria-hidden="true" />
          Driver Status
        </CardTitle>
        <CardDescription>Online, driving, loading, and compliance overview</CardDescription>
      </CardHeader>
      <CardContent>
        <AsyncSection
          isLoading={isLoading}
          isError={isError}
          isEmpty={!isLoading && !isError && drivers.length === 0}
          onRetry={onRetry}
          emptyIcon={Users}
          emptyTitle="No drivers"
          emptyDescription="Invite drivers from the Company page to assign them to trucks."
          skeletonHeight="h-40"
        >
          <div className="flex flex-wrap gap-2 mb-4">
            {STATUS_BUCKETS.map((status) => (
              <div key={status} className="flex items-center gap-1.5 text-xs">
                <StatusBadge status={status} />
                <span className="font-bold tabular-nums">{statusCounts[status] ?? 0}</span>
              </div>
            ))}
          </div>

          <ul className="space-y-2 max-h-48 overflow-y-auto" aria-label="Driver list">
            {driverRows.map((driver) => (
              <li
                key={driver.id}
                className="flex items-center justify-between gap-2 py-2 px-3 border border-border/50 bg-muted/20 text-sm"
              >
                <div className="min-w-0">
                  <p className="font-semibold truncate">{driver.name}</p>
                  {driver.truckNumber && (
                    <p className="text-xs text-muted-foreground">Truck #{driver.truckNumber}</p>
                  )}
                </div>
                <StatusBadge status={driver.status} />
              </li>
            ))}
          </ul>

          <dl className="mt-4 pt-4 border-t border-border space-y-2 text-xs">
            <div className="flex justify-between">
              <dt className="font-bold uppercase tracking-wider text-muted-foreground">Compliance Status</dt>
              <dd><StatusBadge status={complianceStatus ?? "pending"} /></dd>
            </div>
            <div className="flex justify-between">
              <dt className="font-bold uppercase tracking-wider text-muted-foreground">License Expiration</dt>
              <dd className="text-muted-foreground">{/* PLACEHOLDER: license expiration API */}—</dd>
            </div>
            <div className="flex justify-between">
              <dt className="font-bold uppercase tracking-wider text-muted-foreground">Medical Expiration</dt>
              <dd className="text-muted-foreground">{/* PLACEHOLDER: medical expiration API */}—</dd>
            </div>
            <div className="flex justify-between">
              <dt className="font-bold uppercase tracking-wider text-muted-foreground">DOT Status</dt>
              <dd><StatusBadge status={complianceStatus ?? "pending"} /></dd>
            </div>
          </dl>
        </AsyncSection>
      </CardContent>
    </Card>
  );
});
