import type { ElementType, ReactNode } from "react";
import { AlertCircle, RefreshCw, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useOnlineStatus } from "@/hooks/use-online-status";

interface PageLoadingProps {
  rows?: number;
  className?: string;
  rowClassName?: string;
}

export function PageLoadingSkeleton({
  rows = 4,
  className = "h-40 w-full rounded-none",
  rowClassName,
}: PageLoadingProps) {
  return (
    <div className={rowClassName ?? "grid grid-cols-1 gap-4 lg:grid-cols-2"} aria-busy="true" aria-live="polite">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className={className} />
      ))}
    </div>
  );
}

interface PageErrorProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  retryLabel?: string;
}

export function PageErrorState({
  title = "Something went wrong",
  message = "We couldn't load this page. Check your connection and try again.",
  onRetry,
  retryLabel = "Try again",
}: PageErrorProps) {
  return (
    <Alert variant="destructive" className="rounded-none border-2">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <span>{message}</span>
        {onRetry && (
          <Button
            variant="outline"
            size="sm"
            className="rounded-none border-2 shrink-0"
            onClick={onRetry}
          >
            <RefreshCw className="mr-2 h-3.5 w-3.5" />
            {retryLabel}
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}

interface PageEmptyProps {
  icon: ElementType;
  title: string;
  description: string;
  action?: ReactNode;
}

export function PageEmptyState({ icon: Icon, title, description, action }: PageEmptyProps) {
  return (
    <Empty className="rounded-none border-2 border-dashed bg-card">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Icon className="h-6 w-6" />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      {action && <EmptyContent>{action}</EmptyContent>}
    </Empty>
  );
}

/** Sticky banner shown when the browser reports offline. */
export function OfflineBanner() {
  const online = useOnlineStatus();
  if (online) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="sticky top-0 z-50 flex items-center justify-center gap-2 border-b-2 border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm font-semibold text-amber-700 dark:text-amber-300"
    >
      <WifiOff className="h-4 w-4 shrink-0" aria-hidden="true" />
      You&apos;re offline. Changes will sync when your connection returns.
    </div>
  );
}
