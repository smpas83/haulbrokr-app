import { Link } from "wouter";
import { Truck, AlertTriangle, Fuel, DollarSign } from "lucide-react";
import { StatusChip } from "@/components/design";
import type { OperationsCenterData } from "@/lib/operations-types";

interface DispatchOptimizerPanelProps {
  suggestions: OperationsCenterData["dispatchSuggestions"];
}

const RISK_COLOR = {
  low: "text-emerald-400",
  medium: "text-warning",
  high: "text-destructive",
} as const;

export function DispatchOptimizerPanel({ suggestions }: DispatchOptimizerPanelProps) {
  if (suggestions.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        No active jobs to optimize. Assign trucks when jobs are in progress.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {suggestions.map((s) => (
        <div key={s.jobId} className="rounded-xl border border-border/50 p-4 hover:border-primary/30 transition-colors">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <Link href={`/jobs/${s.jobId}`}>
                <span className="text-sm font-semibold hover:text-primary cursor-pointer">
                  Job #{s.jobId} — {s.materialType}
                </span>
              </Link>
              <p className="text-xs text-muted-foreground truncate mt-0.5">{s.pickupAddress}</p>
            </div>
            <StatusChip status={s.lateRisk === "high" ? "cancelled" : s.lateRisk === "medium" ? "bidding" : "accepted"} />
          </div>
          <div className="grid grid-cols-2 gap-3 mt-3 text-xs">
            <div className="flex items-center gap-2">
              <Truck className="h-3.5 w-3.5 text-primary" />
              <span>
                Best: <span className="font-semibold">{s.recommendedTruckLabel ?? "None"}</span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Truck className="h-3.5 w-3.5 text-muted-foreground" />
              <span>
                Backup: <span className="font-semibold">{s.backupTruckLabel ?? "—"}</span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <DollarSign className="h-3.5 w-3.5 text-emerald-400" />
              <span>Est. profit: <span className="font-semibold">${s.estimatedProfit.toLocaleString()}</span></span>
            </div>
            <div className="flex items-center gap-2">
              <Fuel className="h-3.5 w-3.5 text-accent" />
              <span>Fuel est.: <span className="font-semibold">${s.estimatedFuelCost}</span></span>
            </div>
          </div>
          {s.conflicts.length > 0 && (
            <div className="mt-2 flex items-start gap-2 text-xs text-warning">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>{s.conflicts.join(" · ")}</span>
            </div>
          )}
          <p className={`text-[10px] font-semibold uppercase tracking-wider mt-2 ${RISK_COLOR[s.lateRisk]}`}>
            Late risk: {s.lateRisk}
          </p>
        </div>
      ))}
    </div>
  );
}
