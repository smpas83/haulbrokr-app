import { cn } from "@/lib/utils";
import type { BusinessHealthScores } from "@/lib/operations-types";

interface BusinessHealthPanelProps {
  scores: BusinessHealthScores;
}

const SCORE_ITEMS: { key: keyof BusinessHealthScores; label: string }[] = [
  { key: "revenue", label: "Revenue" },
  { key: "fleet", label: "Fleet" },
  { key: "customer", label: "Customer" },
  { key: "vendor", label: "Vendor" },
  { key: "compliance", label: "Compliance" },
  { key: "dispatch", label: "Dispatch" },
  { key: "driver", label: "Driver" },
  { key: "aiConfidence", label: "AI Confidence" },
];

function scoreColor(score: number) {
  if (score >= 80) return "text-emerald-400";
  if (score >= 60) return "text-warning";
  return "text-destructive";
}

export function BusinessHealthPanel({ scores }: BusinessHealthPanelProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="surface-panel rounded-xl p-5 col-span-2 sm:col-span-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Company Health</p>
          <p className={cn("text-4xl font-bold stat-number mt-1", scoreColor(scores.overall))}>{scores.overall}</p>
          <p className="text-xs text-muted-foreground mt-1">Composite business score</p>
        </div>
        <div className="surface-panel rounded-xl p-5 col-span-2 sm:col-span-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Operational Score</p>
          <p className={cn("text-4xl font-bold stat-number mt-1", scoreColor(scores.operational))}>{scores.operational}</p>
          <p className="text-xs text-muted-foreground mt-1">Dispatch + fleet + approvals</p>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {SCORE_ITEMS.map(({ key, label }) => (
          <div key={key} className="rounded-xl border border-border/50 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
            <p className={cn("text-xl font-bold stat-number mt-0.5", scoreColor(scores[key] as number))}>
              {scores[key]}
            </p>
            <div className="mt-2 h-1 rounded-full bg-muted/50 overflow-hidden">
              <div className="h-full rounded-full bg-primary" style={{ width: `${scores[key]}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
