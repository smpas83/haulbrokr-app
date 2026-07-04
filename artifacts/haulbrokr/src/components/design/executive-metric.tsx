import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown } from "lucide-react";

interface ExecutiveMetricProps {
  label: string;
  value: string | number;
  icon?: React.ElementType;
  sub?: string;
  trend?: { value: number; label?: string };
  accent?: boolean;
  className?: string;
  children?: ReactNode;
}

/** Large executive KPI — mission control and analytics dashboards */
export function ExecutiveMetric({
  label,
  value,
  icon: Icon,
  sub,
  trend,
  accent,
  className,
  children,
}: ExecutiveMetricProps) {
  const isPositive = trend && trend.value >= 0;

  return (
    <div
      className={cn(
        "surface-panel rounded-2xl p-5 transition-all duration-200 hover:border-primary/20",
        accent && "border-primary/20 bg-primary/5",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
        {Icon && (
          <span
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-lg",
              accent ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
            )}
          >
            <Icon className="h-4 w-4" />
          </span>
        )}
      </div>
      <div className={cn("mt-2 text-3xl md:text-4xl font-bold stat-number tracking-tight", accent && "text-primary")}>
        {value}
      </div>
      {(sub || trend) && (
        <div className="flex items-center gap-2 mt-2">
          {trend && (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 text-xs font-medium",
                isPositive ? "text-emerald-400" : "text-red-400",
              )}
            >
              {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {Math.abs(trend.value)}%
              {trend.label && <span className="text-muted-foreground ml-1">{trend.label}</span>}
            </span>
          )}
          {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
        </div>
      )}
      {children}
    </div>
  );
}
