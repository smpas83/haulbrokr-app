import { Link } from "wouter";
import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { OperationInsight, InsightSeverity } from "@/lib/operations-types";

const SEVERITY_STYLES: Record<InsightSeverity, string> = {
  critical: "border-destructive/40 bg-destructive/10",
  high: "border-warning/40 bg-warning/10",
  medium: "border-primary/30 bg-primary/5",
  low: "border-border/50 bg-muted/20",
  info: "border-border/50 bg-muted/10",
};

const SEVERITY_LABEL: Record<InsightSeverity, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
  info: "Info",
};

interface InsightCardProps {
  insight: OperationInsight;
  compact?: boolean;
}

export function InsightCard({ insight, compact }: InsightCardProps) {
  return (
    <div className={cn("rounded-xl border p-4 transition-colors hover:border-primary/30", SEVERITY_STYLES[insight.severity])}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles className="h-4 w-4 text-primary shrink-0" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{insight.category}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border border-border/50">
            {SEVERITY_LABEL[insight.severity]}
          </span>
          <span className="text-[10px] text-muted-foreground">{insight.confidence}% conf.</span>
        </div>
      </div>
      <h3 className="text-sm font-semibold leading-snug">{insight.title}</h3>
      {!compact && <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{insight.description}</p>}
      <p className="text-xs font-medium text-foreground/80 mt-2">{insight.businessImpact}</p>
      {!compact && (
        <p className="text-xs text-muted-foreground mt-1">
          <span className="font-semibold text-foreground/70">Action: </span>
          {insight.recommendedAction}
        </p>
      )}
      {insight.actions.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {insight.actions.map((action) =>
            action.href ? (
              <Link key={action.label} href={action.href}>
                <Button size="sm" variant="outline" className="h-7 text-xs rounded-lg">
                  {action.label}
                  <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              </Link>
            ) : (
              <Button key={action.label} size="sm" variant="outline" className="h-7 text-xs rounded-lg">
                {action.label}
              </Button>
            ),
          )}
        </div>
      )}
    </div>
  );
}
