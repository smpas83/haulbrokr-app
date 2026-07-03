import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "./EmptyState";
import { OfflineBanner } from "./OfflineBanner";
import { AppLoader } from "./AppLoader";
import { cn } from "@/lib/utils";

interface AsyncSectionProps {
  isLoading?: boolean;
  isError?: boolean;
  isEmpty?: boolean;
  onRetry?: () => void;
  emptyIcon?: React.ElementType;
  emptyTitle?: string;
  emptyDescription?: string;
  skeletonHeight?: string;
  showOffline?: boolean;
  className?: string;
  children: ReactNode;
}

export function AsyncSection({
  isLoading,
  isError,
  isEmpty,
  onRetry,
  emptyIcon,
  emptyTitle = "No data",
  emptyDescription,
  skeletonHeight = "h-32",
  showOffline = true,
  className,
  children,
}: AsyncSectionProps) {
  return (
    <section className={cn("space-y-3", className)}>
      {showOffline && <OfflineBanner />}
      {isLoading ? (
        <Skeleton className={cn("w-full rounded-none", skeletonHeight)} aria-busy="true" />
      ) : isError ? (
        <div className="flex flex-col items-center justify-center py-8 gap-3">
          <p className="text-sm text-destructive font-semibold">Failed to load section</p>
          {onRetry && (
            <Button variant="outline" size="sm" className="rounded-none border-2" onClick={onRetry}>
              Retry
            </Button>
          )}
        </div>
      ) : isEmpty ? (
        <EmptyState icon={emptyIcon} title={emptyTitle} description={emptyDescription} />
      ) : (
        children
      )}
    </section>
  );
}

export { AppLoader };
