import { Badge } from "./Badge";
import { cn } from "@/lib/utils";
import { statusColor } from "@workspace/design-tokens";

export interface StatusPillProps {
  status: keyof typeof statusColor | string;
  className?: string;
}

export function StatusPill({ status, className }: StatusPillProps) {
  const color = statusColor[status as keyof typeof statusColor] ?? statusColor.completed;
  return (
    <Badge
      className={cn("border-transparent capitalize", className)}
      style={{ backgroundColor: `${color}20`, color }}
    >
      {status.replace(/_/g, " ")}
    </Badge>
  );
}
