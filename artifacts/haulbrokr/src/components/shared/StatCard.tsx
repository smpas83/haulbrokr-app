import type { ElementType } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function StatCard({
  title,
  value,
  icon: Icon,
  accent,
  sub,
  className,
}: {
  title: string;
  value: string | number;
  icon: ElementType;
  accent?: boolean;
  sub?: string;
  className?: string;
}) {
  return (
    <Card className={cn("rounded-none border-2", accent && "border-primary/30 bg-primary/5", className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle
          className={cn(
            "text-sm font-semibold uppercase tracking-wider",
            accent ? "text-primary" : "text-muted-foreground",
          )}
        >
          {title}
        </CardTitle>
        <Icon className={cn("h-4 w-4", accent ? "text-primary" : "text-muted-foreground")} aria-hidden />
      </CardHeader>
      <CardContent>
        <div className={cn("text-3xl font-black tracking-tight tabular-nums", accent && "text-primary")}>{value}</div>
        {sub ? <p className="mt-1 text-xs text-muted-foreground">{sub}</p> : null}
      </CardContent>
    </Card>
  );
}
