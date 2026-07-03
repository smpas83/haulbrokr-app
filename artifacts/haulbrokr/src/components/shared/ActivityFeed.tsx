import { memo } from "react";
import { format } from "date-fns";
import { Link } from "wouter";
import { Activity, ArrowUpRight } from "lucide-react";
import type { ActivityItem } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { EmptyState } from "./EmptyState";
import { cn } from "@/lib/utils";

function getActivityDotClass(type: string) {
  if (type === "payment_failed" || type === "application_rejected") return "bg-destructive";
  if (type === "payment_requires_action" || type === "payout_delayed") return "bg-amber-500";
  if (type === "application_approved" || type === "job_completed") return "bg-green-500";
  if (type.startsWith("bin_")) return "bg-violet-500";
  return "bg-primary";
}

function getActivityTextClass(type: string) {
  if (type === "payment_failed" || type === "application_rejected") return "text-destructive";
  if (type === "payment_requires_action" || type === "payout_delayed") return "text-amber-600 dark:text-amber-400";
  if (type === "application_approved" || type === "job_completed") return "text-green-600 dark:text-green-400";
  return "";
}

function getActivityHref(activity: ActivityItem): string | null {
  if (activity.type.startsWith("bin_") && activity.relatedBinOrderId) {
    return `/bins?order=${encodeURIComponent(activity.relatedBinOrderId)}`;
  }
  if (activity.relatedId != null) {
    if (
      activity.type === "payment_failed" ||
      activity.type === "payment_requires_action" ||
      activity.type.startsWith("job_") ||
      activity.type.startsWith("bid_")
    ) {
      return `/jobs/${activity.relatedId}`;
    }
    return `/jobs/${activity.relatedId}`;
  }
  return null;
}

interface ActivityFeedProps {
  activities?: ActivityItem[];
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  limit?: number;
  animated?: boolean;
  className?: string;
}

export const ActivityFeed = memo(function ActivityFeed({
  activities,
  isLoading,
  isError,
  onRetry,
  limit = 12,
  animated = false,
  className,
}: ActivityFeedProps) {
  if (isLoading) {
    return (
      <div className={cn("space-y-3", className)} aria-busy="true" aria-label="Loading activity feed">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-14 w-full rounded-none" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className={cn("text-center py-6 space-y-3", className)}>
        <p className="text-sm text-destructive font-semibold">Failed to load activity</p>
        {onRetry && (
          <Button variant="outline" size="sm" className="rounded-none border-2" onClick={onRetry}>
            Retry
          </Button>
        )}
      </div>
    );
  }

  const items = activities?.slice(0, limit) ?? [];

  if (items.length === 0) {
    return (
      <EmptyState
        icon={Activity}
        title="No recent activity"
        description="Operations events will appear here as they happen."
        className={className}
      />
    );
  }

  return (
    <div
      className={cn("space-y-1", className)}
      role="feed"
      aria-label="Live activity feed"
      aria-live="polite"
    >
      {items.map((activity, index) => {
        const href = getActivityHref(activity);
        const dotClass = getActivityDotClass(activity.type);
        const textClass = getActivityTextClass(activity.type);
        const rowClass = cn(
          "flex items-center gap-4 py-2.5 px-3 hover:bg-muted/40 transition-colors border-b border-border/40 last:border-0",
          animated && "motion-safe:animate-in motion-safe:fade-in motion-reduce:animate-none",
          animated && index === 0 && "motion-safe:slide-in-from-top-1"
        );

        const inner = (
          <>
            <div className={cn("w-2 h-2 rounded-full flex-shrink-0", dotClass)} aria-hidden="true" />
            <div className="flex-1 min-w-0">
              <p className={cn("text-sm font-medium leading-tight truncate", textClass)}>
                {activity.description}
              </p>
              <time className="text-xs text-muted-foreground mt-0.5" dateTime={activity.createdAt}>
                {format(new Date(activity.createdAt), "MMM d, h:mm a")}
              </time>
            </div>
            {href && (
              <ArrowUpRight className="h-4 w-4 flex-shrink-0 text-muted-foreground" aria-hidden="true" />
            )}
          </>
        );

        return href ? (
          <Link key={activity.id} href={href} className={rowClass} role="article">
            {inner}
          </Link>
        ) : (
          <div key={activity.id} className={rowClass} role="article">
            {inner}
          </div>
        );
      })}
    </div>
  );
});
