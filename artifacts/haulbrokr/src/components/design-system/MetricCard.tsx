import { Card, CardContent, CardHeader, CardTitle } from "./Card";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export interface MetricCardProps {
  label: string;
  value: ReactNode;
  description?: string;
  className?: string;
}

export function MetricCard({ label, value, description, className }: MetricCardProps) {
  return (
    <Card className={cn(className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description ? <p className="text-xs text-muted-foreground mt-1">{description}</p> : null}
      </CardContent>
    </Card>
  );
}
