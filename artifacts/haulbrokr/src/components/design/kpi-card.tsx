import { memo, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown } from "lucide-react";

interface KpiCardProps {
  title: string;
  value: string | number;
  icon: React.ElementType;
  accent?: boolean;
  sub?: string;
  trend?: { value: number; label?: string };
  className?: string;
}

export const KpiCard = memo(function KpiCard({ title, value, icon: Icon, accent, sub, trend, className }: KpiCardProps) {
  const isPositive = trend && trend.value >= 0;

  return (
    <Card
      className={cn(
        "group transition-all duration-200 hover-elevate hover:border-primary/20",
        accent && "border-primary/20 bg-primary/5",
        className
      )}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle
          className={cn(
            "text-xs font-semibold uppercase tracking-wider",
            accent ? "text-primary" : "text-muted-foreground"
          )}
        >
          {title}
        </CardTitle>
        <div
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
            accent ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
      </CardHeader>
      <CardContent>
        <div
          className={cn(
            "text-3xl font-bold stat-number tracking-tight",
            accent ? "text-primary" : "text-foreground"
          )}
        >
          {value}
        </div>
        {(sub || trend) && (
          <div className="flex items-center gap-2 mt-1.5">
            {trend && (
              <span
                className={cn(
                  "inline-flex items-center gap-0.5 text-xs font-medium",
                  isPositive ? "text-emerald-400" : "text-red-400"
                )}
              >
                {isPositive ? (
                  <TrendingUp className="h-3 w-3" />
                ) : (
                  <TrendingDown className="h-3 w-3" />
                )}
                {Math.abs(trend.value)}%
              </span>
            )}
            {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
});
