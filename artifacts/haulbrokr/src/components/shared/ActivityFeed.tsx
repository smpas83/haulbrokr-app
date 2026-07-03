import { memo } from "react";
import { format } from "date-fns";
import { ArrowUpRight } from "lucide-react";
import { Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export interface ActivityFeedItem {
  id: string | number;
  description: string;
  createdAt: string;
  type?: string;
  href?: string | null;
  tone?: "default" | "success" | "warning" | "danger" | "info";
}

export interface ActivityFeedProps {
  items?: ActivityFeedItem[];
  isLoading?: boolean;
  limit?: number;
  emptyTitle?: string;
  emptyDescription?: string;
  className?: string;
}

function toneClasses(tone: ActivityFeedItem["tone"]) {
  switch (tone) {
    case "danger":
      return { dot: "bg-destructive", text: "text-destructive" };
    case "warning":
      return { dot: "bg-amber-500", text: "text-amber-600 dark:text-amber-400" };
    case "success":
      return { dot: "bg-green-500", text: "text-green-600 dark:text-green-400" };
    case "info":
      return { dot: "bg-violet-500", text: "text-violet-600 dark:text-violet-400" };
    default:
      return { dot: "bg-primary", text: "" };
  }
}

function ActivityFeedInner({
  items,
  isLoading,
  limit = 8,
  emptyTitle = "No recent activity",
  emptyDescription = "Actions will appear here as they happen.",
  className,
}: ActivityFeedProps) {
  if (isLoading) {
    return (
      <div className={cn("space-y-3", className)} aria-busy="true" aria-label="Loading activity">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-none" />
        ))}
      </div>
    );
  }

  const visible = (items ?? []).slice(0, limit);

  if (visible.length === 0) {
    return (
      <div className={cn("py-8 text-center text-sm text-muted-foreground", className)} role="status">
        <p className="font-medium text-foreground">{emptyTitle}</p>
        <p className="mt-1">{emptyDescription}</p>
      </div>
    );
  }

  return (
    <ul className={cn("space-y-1", className)} aria-label="Recent activity">
      {visible.map((activity) => {
        const { dot, text } = toneClasses(activity.tone);
        const inner = (
          <>
            <div className={cn("w-2 h-2 rounded-full flex-shrink-0", dot)} aria-hidden="true" />
            <div className="flex-1 min-w-0">
              <p className={cn("text-sm font-medium leading-tight truncate", text)}>
                {activity.description}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {format(new Date(activity.createdAt), "MMM d, h:mm a")}
              </p>
            </div>
            {activity.href ? (
              <ArrowUpRight className={cn("h-4 w-4 flex-shrink-0 text-muted-foreground", text)} aria-hidden="true" />
            ) : null}
          </>
        );

        return (
          <li key={activity.id}>
            {activity.href ? (
              <Link
                href={activity.href}
                className="flex items-center gap-3 py-2.5 px-1 -mx-1 hover:bg-muted/50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                {inner}
              </Link>
            ) : (
              <div className="flex items-center gap-3 py-2.5 px-1 -mx-1">{inner}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export const ActivityFeed = memo(ActivityFeedInner);
