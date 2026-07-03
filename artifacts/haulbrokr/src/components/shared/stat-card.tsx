import type { ElementType, ReactNode } from "react";
import { createElement, isValidElement } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type StatCardVariant = "default" | "compact";

interface StatCardProps {
  title?: string;
  label?: string;
  value: ReactNode;
  icon?: ElementType | ReactNode;
  accent?: boolean;
  sub?: string;
  hint?: string;
  variant?: StatCardVariant;
  className?: string;
}

function renderIcon(icon: ElementType | ReactNode | undefined, className: string) {
  if (!icon) return null;
  if (isValidElement(icon)) return icon;
  return createElement(icon as ElementType, { className });
}

/** KPI stat tile shared across dashboard and admin command center. */
export function StatCard({
  title,
  label,
  value,
  icon,
  accent,
  sub,
  hint,
  variant = "default",
  className,
}: StatCardProps) {
  const heading = title ?? label ?? "";
  const iconElement = renderIcon(
    icon,
    cn("h-4 w-4", accent ? "text-primary" : "text-muted-foreground"),
  );

  if (variant === "compact") {
    return (
      <Card className={cn("rounded-none border-2", className)}>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {iconElement} {heading}
          </div>
          <div className={cn("mt-2 text-2xl font-bold tracking-tight", accent && "text-primary")}>
            {value}
          </div>
          {(hint ?? sub) && (
            <div className="mt-1 text-xs text-muted-foreground">{hint ?? sub}</div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      className={cn(
        "rounded-none border-2",
        accent && "border-primary/30 bg-primary/5",
        className,
      )}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle
          className={cn(
            "text-sm font-semibold uppercase tracking-wider",
            accent ? "text-primary" : "text-muted-foreground",
          )}
        >
          {heading}
        </CardTitle>
        {iconElement}
      </CardHeader>
      <CardContent>
        <div className={cn("text-3xl font-black tracking-tight", accent && "text-primary")}>
          {value}
        </div>
        {(sub ?? hint) && (
          <p className="mt-1 text-xs text-muted-foreground">{sub ?? hint}</p>
        )}
      </CardContent>
    </Card>
  );
}
