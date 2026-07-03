import { format } from "date-fns";
import { ArrowUpRight, Activity } from "lucide-react";
import { Link } from "wouter";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import { EmptyState } from "./EmptyState";

export type ActivityItem = {
  id: number | string;
  type: string;
  description: string;
  createdAt: string;
  relatedId?: number | null;
  relatedBinOrderId?: string | null;
  href?: string | null;
};

function resolveHref(activity: ActivityItem): string | null {
  if (activity.href) return activity.href;
  const isBin = activity.type.startsWith("bin_");
  if (isBin && activity.relatedBinOrderId) {
    return `/bins?order=${encodeURIComponent(activity.relatedBinOrderId)}`;
  }
  const isPayment = activity.type === "payment_failed" || activity.type === "payment_requires_action";
  if (isPayment && activity.relatedId != null) return `/jobs/${activity.relatedId}`;
  if (activity.relatedId != null && (activity.type.includes("job") || activity.type.includes("bid"))) {
    return `/jobs/${activity.relatedId}`;
  }
  return null;
}

function dotClass(type: string) {
  if (type === "payment_failed" || type === "application_rejected") return "bg-destructive";
  if (type === "payment_requires_action" || type === "payout_delayed") return "bg-amber-500";
  if (type === "application_approved") return "bg-green-500";
  if (type.startsWith("bin_")) return "bg-violet-500";
  return "bg-primary";
}

function textClass(type: string) {
  if (type === "payment_failed" || type === "application_rejected") return "text-destructive";
  if (type === "payment_requires_action" || type === "payout_delayed") return "text-amber-600 dark:text-amber-400";
  if (type === "application_approved") return "text-green-600 dark:text-green-400";
  return "";
}

export function ActivityFeed({
  activities,
  isLoading,
  title = "Recent Activity",
  description = "Latest actions on your account",
  limit = 8,
  className,
}: {
  activities?: ActivityItem[];
  isLoading?: boolean;
  title?: string;
  description?: string;
  limit?: number;
  className?: string;
}) {
  return (
    <Card className={cn("rounded-none border-2", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-bold">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-4" aria-busy="true">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full rounded-none" />
            ))}
          </div>
        ) : activities && activities.length > 0 ? (
          <div className="space-y-1">
            {activities.slice(0, limit).map((activity) => {
              const href = resolveHref(activity);
              const inner = (
                <>
                  <div className={cn("h-2 w-2 flex-shrink-0 rounded-full", dotClass(activity.type))} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className={cn("truncate text-sm font-medium leading-tight", textClass(activity.type))}>
                      {activity.description}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {format(new Date(activity.createdAt), "MMM d, h:mm a")}
                    </p>
                  </div>
                  {href ? (
                    <ArrowUpRight className="h-4 w-4 flex-shrink-0 text-muted-foreground" aria-hidden />
                  ) : null}
                </>
              );
              const rowClass =
                "flex items-center gap-4 border-b border-border/40 px-3 py-2.5 transition-colors last:border-0 hover:bg-muted/40";
              return href ? (
                <Link key={activity.id} href={href} className={rowClass}>
                  {inner}
                </Link>
              ) : (
                <div key={activity.id} className={rowClass}>
                  {inner}
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState
            icon={<Activity className="h-8 w-8 opacity-40" aria-hidden />}
            title="No recent activity"
            description="Updates from your loads and uploads will appear here."
            className="border-none bg-transparent p-6"
          />
        )}
      </CardContent>
    </Card>
  );
}
