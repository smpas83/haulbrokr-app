import { Link } from "wouter";
import { format } from "date-fns";
import { ArrowUpRight, Activity } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { PageEmptyState } from "@/components/shared/page-states";

export interface ActivityItem {
  id: string | number;
  type: string;
  description: string;
  createdAt: string;
  relatedId?: number | null;
  relatedBinOrderId?: string | null;
}

interface ActivityFeedProps {
  activities?: ActivityItem[];
  isLoading?: boolean;
  limit?: number;
}

function getActivityMeta(activity: ActivityItem) {
  const isFailure =
    activity.type === "payment_failed" || activity.type === "application_rejected";
  const isActionNeeded =
    activity.type === "payment_requires_action" || activity.type === "payout_delayed";
  const isApproved = activity.type === "application_approved";
  const isBin = activity.type.startsWith("bin_");

  const dotClass = isFailure
    ? "bg-destructive"
    : isActionNeeded
      ? "bg-amber-500"
      : isApproved
        ? "bg-green-500"
        : isBin
          ? "bg-violet-500"
          : "bg-primary";

  const textClass = isFailure
    ? "text-destructive"
    : isActionNeeded
      ? "text-amber-600 dark:text-amber-400"
      : isApproved
        ? "text-green-600 dark:text-green-400"
        : "";

  const binHref =
    isBin && activity.relatedBinOrderId != null
      ? `/bins?order=${encodeURIComponent(activity.relatedBinOrderId)}`
      : null;
  const jobHref =
    (isFailure || isActionNeeded) && activity.relatedId != null
      ? `/jobs/${activity.relatedId}`
      : null;
  const href = binHref ?? jobHref;

  return { dotClass, textClass, href, isLink: href != null, isFailure, isActionNeeded };
}

/** Notification-style activity list backed by the dashboard activity API. */
export function ActivityFeed({ activities, isLoading, limit = 8 }: ActivityFeedProps) {
  if (isLoading) {
    return (
      <div className="space-y-4" aria-busy="true" aria-live="polite">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-12 w-full rounded-none" />
        ))}
      </div>
    );
  }

  if (!activities?.length) {
    return (
      <PageEmptyState
        icon={Activity}
        title="No recent activity"
        description="Dispatch updates, payments, and compliance events will appear here."
      />
    );
  }

  return (
    <div className="space-y-1" role="feed" aria-label="Recent activity">
      {activities.slice(0, limit).map((activity) => {
        const { dotClass, textClass, href, isLink, isFailure, isActionNeeded } =
          getActivityMeta(activity);

        const inner = (
          <>
            <div className={`h-2 w-2 shrink-0 rounded-full ${dotClass}`} aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className={`truncate text-sm font-medium leading-tight ${textClass}`}>
                {activity.description}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                <time dateTime={activity.createdAt}>
                  {format(new Date(activity.createdAt), "MMM d, h:mm a")}
                </time>
              </p>
            </div>
            {isLink && (
              <ArrowUpRight
                className={`h-4 w-4 shrink-0 ${
                  isFailure
                    ? "text-destructive"
                    : isActionNeeded
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-muted-foreground"
                }`}
                aria-hidden="true"
              />
            )}
          </>
        );

        const className =
          "flex items-center gap-4 border-b border-border/40 px-3 py-2.5 transition-colors last:border-0 hover:bg-muted/40";

        return isLink ? (
          <Link key={activity.id} href={href!} className={className}>
            {inner}
          </Link>
        ) : (
          <div key={activity.id} className={className}>
            {inner}
          </div>
        );
      })}
    </div>
  );
}
