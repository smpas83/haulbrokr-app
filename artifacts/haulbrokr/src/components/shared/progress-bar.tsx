import { cn } from "@/lib/utils";

interface ProgressBarProps {
  value: number;
  max?: number;
  className?: string;
  showLabel?: boolean;
  labelLeft?: string;
  labelRight?: string;
}

/** Accessible progress bar replacing inline width styles. */
export function ProgressBar({
  value,
  max = 100,
  className,
  showLabel,
  labelLeft,
  labelRight,
}: ProgressBarProps) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  const color =
    pct > 90 ? "bg-red-500" : pct > 70 ? "bg-amber-500" : "bg-green-500";

  return (
    <div className={cn("space-y-1", className)}>
      {showLabel && (labelLeft || labelRight) && (
        <div className="flex justify-between text-xs font-medium">
          {labelLeft && <span className="text-muted-foreground">{labelLeft}</span>}
          {labelRight && <span>{labelRight}</span>}
        </div>
      )}
      <div
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-2 w-full overflow-hidden bg-muted"
      >
        <div
          className={cn("h-full transition-all duration-300", color)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
