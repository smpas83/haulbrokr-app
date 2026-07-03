import { memo, type ElementType, type ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface StatCardProps {
  title: string;
  value: ReactNode;
  icon?: ElementType<{ className?: string }>;
  accent?: boolean;
  sub?: string;
  onClick?: () => void;
  className?: string;
}

function StatCardInner({
  title,
  value,
  icon: Icon,
  accent,
  sub,
  onClick,
  className,
}: StatCardProps) {
  const content = (
    <>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle
          className={cn(
            "text-sm font-semibold uppercase tracking-wider",
            accent ? "text-primary" : "text-muted-foreground",
          )}
        >
          {title}
        </CardTitle>
        {Icon ? (
          <Icon className={cn("h-4 w-4", accent ? "text-primary" : "text-muted-foreground")} />
        ) : null}
      </CardHeader>
      <CardContent>
        <div className={cn("text-3xl font-black tracking-tight tabular-nums", accent && "text-primary")}>
          {value}
        </div>
        {sub ? <p className="text-xs text-muted-foreground mt-1">{sub}</p> : null}
      </CardContent>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn("text-left w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-primary", className)}
      >
        <Card
          className={cn(
            "rounded-none border-2 transition-colors hover:border-primary/50 hover:bg-muted/30",
            accent && "border-primary/30 bg-primary/5",
          )}
        >
          {content}
        </Card>
      </button>
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
      {content}
    </Card>
  );
}

export const StatCard = memo(StatCardInner);
