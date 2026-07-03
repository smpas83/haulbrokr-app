import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  formatStatusLabel,
  getStatusClasses,
  type StatusDomain,
  BIN_STATUS_LABELS,
} from "@/lib/status-styles";

interface StatusBadgeProps {
  status: string;
  domain: StatusDomain;
  label?: string;
  className?: string;
  size?: "sm" | "md";
}

/** Domain-aware status badge with consistent styling across screens. */
export function StatusBadge({
  status,
  domain,
  label,
  className,
  size = "sm",
}: StatusBadgeProps) {
  const display =
    label ??
    (domain === "bin" ? BIN_STATUS_LABELS[status] : formatStatusLabel(status));

  return (
    <Badge
      variant="outline"
      className={cn(
        "rounded-none border font-bold uppercase tracking-wider",
        size === "sm" ? "text-[10px]" : "text-xs px-3",
        getStatusClasses(domain, status),
        className,
      )}
    >
      {display}
    </Badge>
  );
}
