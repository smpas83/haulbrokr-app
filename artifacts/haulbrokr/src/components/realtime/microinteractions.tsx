import { AlertCircle, Activity, RefreshCw, Truck } from "lucide-react";
import { memo, useEffect, useState } from "react";

import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (!window.matchMedia) return;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return reduced;
}

export function PageTransition({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("hb-page-transition", className)}>{children}</div>;
}

export const LiveStatValue = memo(function LiveStatValue({
  value,
  className,
}: {
  value: string | number;
  className?: string;
}) {
  return (
    <span key={String(value)} className={cn("hb-value-pop tabular-nums", className)}>
      {value}
    </span>
  );
});

export function LiveRefreshBadge({
  isFetching,
  label = "Live sync",
}: {
  isFetching?: boolean;
  label?: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 border-2 border-border bg-card px-3 py-1 text-xs font-bold uppercase tracking-wider text-muted-foreground",
        isFetching && "text-primary"
      )}
      aria-live="polite"
    >
      <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} />
      {isFetching ? "Updating" : label}
    </div>
  );
}

export function LoadingCardGrid({
  count = 4,
  className,
  itemClassName = "h-32",
}: {
  count?: number;
  className?: string;
  itemClassName?: string;
}) {
  return (
    <div className={cn("grid gap-4", className)} role="status" aria-label="Loading">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className={cn("w-full rounded-none", itemClassName)} />
      ))}
    </div>
  );
}

export function EmptyStatePanel({
  icon: Icon = Activity,
  title,
  description,
  children,
  className,
}: {
  icon?: React.ElementType;
  title: string;
  description?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <Empty className={cn("rounded-none border-2 border-border bg-card", className)}>
      <EmptyHeader>
        <EmptyMedia variant="icon" className="rounded-none">
          <Icon className="h-5 w-5" />
        </EmptyMedia>
        <EmptyTitle className="font-bold">{title}</EmptyTitle>
        {description && <EmptyDescription>{description}</EmptyDescription>}
      </EmptyHeader>
      {children && <EmptyContent>{children}</EmptyContent>}
    </Empty>
  );
}

export function ErrorStatePanel({
  title = "Could not load this view",
  description = "Refresh the page or try again in a moment.",
  className,
}: {
  title?: string;
  description?: string;
  className?: string;
}) {
  return (
    <EmptyStatePanel
      icon={AlertCircle}
      title={title}
      description={description}
      className={cn("border-destructive/40", className)}
    />
  );
}

export function RouteProgressPreview({
  status,
  label = "Live route",
  etaLabel,
}: {
  status?: string;
  label?: string;
  etaLabel?: string;
}) {
  const pct =
    status === "completed"
      ? 100
      : status === "in_progress"
        ? 72
        : status === "active" || status === "accepted"
          ? 38
          : 12;

  return (
    <div className="border-2 border-border bg-background p-4" aria-label={label}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
        {etaLabel && <span className="text-xs font-bold text-primary">{etaLabel}</span>}
      </div>
      <div className="relative h-10">
        <div className="absolute left-0 right-0 top-1/2 h-1 -translate-y-1/2 overflow-hidden bg-border">
          <div className="hb-route-progress h-full bg-primary" style={{ width: `${pct}%` }} />
        </div>
        <div className="absolute left-0 top-1/2 h-3 w-3 -translate-y-1/2 bg-primary ring-4 ring-background" />
        <div className="absolute right-0 top-1/2 h-3 w-3 -translate-y-1/2 border-2 border-primary bg-background ring-4 ring-background" />
        <Truck
          className="hb-truck-marker absolute top-1/2 h-6 w-6 -translate-y-1/2 text-primary"
          style={{ left: `calc(${pct}% - 12px)` }}
        />
      </div>
      <div className="mt-2 flex justify-between text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
        <span>Pickup</span>
        <span>Delivery</span>
      </div>
    </div>
  );
}
