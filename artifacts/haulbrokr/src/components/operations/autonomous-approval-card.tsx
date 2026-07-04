import { useState } from "react";
import { Check, X, Play, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/apiFetch";
import type { AutonomousRecommendation } from "@/lib/operations-types";

const PRIORITY_STYLE = {
  critical: "border-destructive/40 bg-destructive/5",
  high: "border-warning/40 bg-warning/5",
  medium: "border-primary/30 bg-primary/5",
  low: "border-border/50 bg-muted/10",
};

interface AutonomousApprovalCardProps {
  recommendation: AutonomousRecommendation;
  onAction: () => void;
}

export function AutonomousApprovalCard({ recommendation, onAction }: AutonomousApprovalCardProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const act = async (action: "approve" | "reject" | "execute") => {
    setLoading(action);
    setError(null);
    try {
      if (action === "execute") {
        await apiFetch(`/autonomous/recommendations/${recommendation.id}/execute`, { method: "POST" });
      } else if (action === "approve") {
        await apiFetch(`/autonomous/recommendations/${recommendation.id}/approve`, { method: "POST" });
      } else {
        await apiFetch(`/autonomous/recommendations/${recommendation.id}/reject`, { method: "POST", body: JSON.stringify({ reason: "Dismissed by operator" }) });
      }
      onAction();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setLoading(null);
    }
  };

  const canExecute = recommendation.status === "approved" || recommendation.status === "modified";
  const isPending = recommendation.status === "pending";

  return (
    <div className={cn("rounded-xl border p-4", PRIORITY_STYLE[recommendation.priority])}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{recommendation.actionType.replace(/_/g, " ")}</p>
          <h3 className="text-sm font-semibold mt-0.5">{recommendation.title}</h3>
        </div>
        <div className="text-right shrink-0">
          <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border border-border/50">
            {recommendation.priority}
          </span>
          <p className="text-[10px] text-muted-foreground mt-1">{recommendation.confidence}% · ROI ${recommendation.estimatedRoi.toLocaleString()}</p>
        </div>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">{recommendation.description}</p>
      <p className="text-xs font-medium mt-2">{recommendation.businessImpact}</p>
      {error && <p className="text-xs text-destructive mt-2">{error}</p>}
      <div className="flex flex-wrap gap-2 mt-3">
        {isPending && (
          <>
            <Button size="sm" className="h-7 text-xs" disabled={!!loading} onClick={() => act("approve")}>
              <Check className="h-3 w-3 mr-1" /> Approve
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs" disabled={!!loading} onClick={() => act("reject")}>
              <X className="h-3 w-3 mr-1" /> Reject
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" disabled title="Modify via job detail after approve">
              <Pencil className="h-3 w-3 mr-1" /> Modify
            </Button>
          </>
        )}
        {canExecute && (
          <Button size="sm" className="h-7 text-xs" disabled={!!loading} onClick={() => act("execute")}>
            <Play className="h-3 w-3 mr-1" /> Execute
          </Button>
        )}
      </div>
    </div>
  );
}
