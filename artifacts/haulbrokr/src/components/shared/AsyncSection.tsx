import type { ReactNode } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "./EmptyState";
import { cn } from "@/lib/utils";

export interface AsyncSectionProps {
  title?: string;
  description?: string;
  isLoading?: boolean;
  isError?: boolean;
  isEmpty?: boolean;
  errorMessage?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  onRetry?: () => void;
  skeletonRows?: number;
  children?: ReactNode;
  className?: string;
  actions?: ReactNode;
}

export function AsyncSection({
  title,
  description,
  isLoading,
  isError,
  isEmpty,
  errorMessage = "Something went wrong loading this section.",
  emptyTitle = "No data",
  emptyDescription,
  onRetry,
  skeletonRows = 3,
  children,
  className,
  actions,
}: AsyncSectionProps) {
  return (
    <section className={cn("space-y-3", className)} aria-busy={isLoading || undefined}>
      {(title || description || actions) && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            {title ? (
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                {title}
              </h2>
            ) : null}
            {description ? <p className="text-xs text-muted-foreground mt-0.5">{description}</p> : null}
          </div>
          {actions}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2" role="status" aria-label={`Loading ${title ?? "section"}`}>
          {Array.from({ length: skeletonRows }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-none" />
          ))}
        </div>
      ) : isError ? (
        <Alert variant="destructive" className="rounded-none border-2">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Unable to load</AlertTitle>
          <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>{errorMessage}</span>
            {onRetry ? (
              <Button variant="outline" size="sm" className="rounded-none shrink-0" onClick={onRetry}>
                <RefreshCw className="h-3.5 w-3.5 mr-1" /> Retry
              </Button>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : isEmpty ? (
        <EmptyState title={emptyTitle} description={emptyDescription} />
      ) : (
        children
      )}
    </section>
  );
}
