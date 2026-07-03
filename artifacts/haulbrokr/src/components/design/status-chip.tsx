import { cn } from "@/lib/utils";
import { getStatusColor } from "@/lib/design-tokens";

interface StatusChipProps {
  status: string;
  className?: string;
}

export function StatusChip({ status, className }: StatusChipProps) {
  const label = status.replace(/_/g, " ");

  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-semibold uppercase tracking-wide border",
        getStatusColor(status),
        className
      )}
    >
      {label}
    </span>
  );
}
