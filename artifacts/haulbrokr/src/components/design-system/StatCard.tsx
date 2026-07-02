import { Card, CardContent } from "./Card";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export interface StatCardProps {
  icon?: LucideIcon;
  label: string;
  value: ReactNode;
  accent?: boolean;
  className?: string;
}

export function StatCard({ icon: Icon, label, value, accent, className }: StatCardProps) {
  return (
    <Card className={cn(accent && "bg-primary text-primary-foreground", className)}>
      <CardContent className="p-4 space-y-2">
        {Icon ? <Icon className="h-4 w-4" /> : null}
        <div className="text-2xl font-bold">{value}</div>
        <div className={cn("text-xs", accent ? "text-primary-foreground/80" : "text-muted-foreground")}>
          {label}
        </div>
      </CardContent>
    </Card>
  );
}
