import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string | number;
  icon?: React.ElementType;
  accent?: boolean;
  sub?: string;
  className?: string;
  loading?: boolean;
}

export function StatCard({
  title,
  value,
  icon: Icon,
  accent,
  sub,
  className,
  loading,
}: StatCardProps) {
  if (loading) {
    return <Skeleton className={cn("h-[110px] w-full rounded-none", className)} aria-hidden="true" />;
  }

  return (
    <Card
      className={cn(
        "rounded-none border-2 shadow-sm",
        accent && "border-primary/30 bg-primary/5",
        className
      )}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle
          className={cn(
            "text-sm font-semibold uppercase tracking-wider",
            accent ? "text-primary" : "text-muted-foreground"
          )}
        >
          {title}
        </CardTitle>
        {Icon && (
          <Icon
            className={cn("h-4 w-4", accent ? "text-primary" : "text-muted-foreground")}
            aria-hidden="true"
          />
        )}
      </CardHeader>
      <CardContent>
        <div className={cn("text-3xl font-black tracking-tight", accent && "text-primary")}>
          {value}
        </div>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}
