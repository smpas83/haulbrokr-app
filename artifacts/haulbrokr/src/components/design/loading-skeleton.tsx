import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function KpiSkeletonGrid({ count = 4, className }: { count?: number; className?: string }) {
  return (
    <div className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-4", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="surface-panel rounded-2xl p-6 space-y-3">
          <Skeleton className="h-3 w-24 shimmer" />
          <Skeleton className="h-8 w-20 shimmer" />
          <Skeleton className="h-3 w-16 shimmer" />
        </div>
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="surface-panel rounded-2xl p-4 space-y-3">
      <Skeleton className="h-10 w-full shimmer rounded-lg" />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full shimmer rounded-lg" />
      ))}
    </div>
  );
}
