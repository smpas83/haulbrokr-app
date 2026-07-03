import { memo } from "react";
import { MapPin, Clock } from "lucide-react";
import type { DumpSite } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { StatusBadge, EmptyState } from "@/components/shared";

interface FacilityStatusProps {
  facilities?: DumpSite[];
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
}

function facilityStatus(site: DumpSite): "open" | "busy" | "closed" {
  if (!site.isActive) return "closed";
  return "open"; // PLACEHOLDER: live wait-time API pending
}

export const FacilityStatus = memo(function FacilityStatus({
  facilities,
  isLoading,
  isError,
  onRetry,
}: FacilityStatusProps) {
  return (
    <Card className="rounded-none border-2 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-bold">Facility Status</CardTitle>
        <CardDescription>Nearest disposal facilities and wait times</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3" aria-busy="true">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full rounded-none" />
            ))}
          </div>
        ) : isError ? (
          <div className="text-center py-6 space-y-3">
            <p className="text-sm text-destructive font-semibold">Failed to load facilities</p>
            {onRetry && (
              <Button variant="outline" size="sm" className="rounded-none border-2" onClick={onRetry}>
                Retry
              </Button>
            )}
          </div>
        ) : !facilities?.length ? (
          <EmptyState
            icon={MapPin}
            title="No facilities"
            description="Facility directory data will appear here."
            className="border-0 py-6"
          />
        ) : (
          <ul className="space-y-2" role="list" aria-label="Facility status">
            {facilities.map((site) => {
              const status = facilityStatus(site);
              return (
                <li
                  key={site.id}
                  className="flex items-start justify-between gap-2 p-3 border border-border hover:bg-muted/30 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-bold truncate">{site.name}</p>
                    <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                      <MapPin className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
                      {site.city}, {site.state}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1 capitalize">
                      Accepts: {site.type.replace(/_/g, " ")}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <StatusBadge status={status} />
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" aria-hidden="true" />
                      {/* PLACEHOLDER: live wait time API */}
                      Wait —
                    </span>
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
