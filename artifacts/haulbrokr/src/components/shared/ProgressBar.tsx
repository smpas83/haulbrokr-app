import { memo } from "react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export interface ProgressBarProps {
  value: number;
  max?: number;
  label?: string;
  showValue?: boolean;
  className?: string;
}

function ProgressBarInner({ value, max = 100, label, showValue = true, className }: ProgressBarProps) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;

  return (
    <div className={cn("space-y-1.5", className)} role="group" aria-label={label}>
      {(label || showValue) && (
        <div className="flex items-center justify-between text-xs">
          {label ? <span className="font-medium text-muted-foreground">{label}</span> : <span />}
          {showValue ? <span className="tabular-nums font-semibold">{Math.round(pct)}%</span> : null}
        </div>
      )}
      <Progress value={pct} className="h-2 rounded-none" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} />
    </div>
  );
}

export const ProgressBar = memo(ProgressBarInner);
