import { format } from "date-fns";
import { Link } from "wouter";
import { Activity, ArrowUpRight, Radio } from "lucide-react";
import type { OperationsCenterData } from "@/lib/operations-types";

interface LiveOperationsStreamProps {
  events: OperationsCenterData["liveStream"];
}

export function LiveOperationsStream({ events }: LiveOperationsStreamProps) {
  if (events.length === 0) {
    return (
      <div className="text-center py-10 text-muted-foreground">
        <Activity className="mx-auto h-8 w-8 mb-3 opacity-20" />
        <p className="text-sm">No live activity yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-1 max-h-[360px] overflow-y-auto">
      {events.map((event) => {
        const inner = (
          <>
            <div className="relative flex-shrink-0">
              <Radio className="h-4 w-4 text-primary" />
              <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium leading-tight truncate">{event.description}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {format(new Date(event.createdAt), "MMM d, h:mm:ss a")}
              </p>
            </div>
            {event.href && <ArrowUpRight className="h-4 w-4 flex-shrink-0 text-muted-foreground" />}
          </>
        );
        const className = "flex items-center gap-3 py-2.5 px-3 hover:bg-muted/30 transition-colors rounded-lg border-b border-border/30 last:border-0";
        return event.href ? (
          <Link key={event.id} href={event.href} className={className}>
            {inner}
          </Link>
        ) : (
          <div key={event.id} className={className}>
            {inner}
          </div>
        );
      })}
    </div>
  );
}
