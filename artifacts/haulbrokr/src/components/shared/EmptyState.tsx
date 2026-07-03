import type { ReactNode } from "react";
import { Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface EmptyStateProps {
  title?: string;
  description?: ReactNode;
  icon?: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export function EmptyState({
  title = "Nothing here yet",
  description,
  icon,
  actionLabel,
  onAction,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-16 px-4 text-center border-2 border-dashed rounded-none text-muted-foreground",
        className,
      )}
      role="status"
    >
      <div className="mb-3 opacity-40" aria-hidden="true">
        {icon ?? <Inbox className="w-8 h-8" />}
      </div>
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {description ? <p className="text-sm mt-1 max-w-md">{description}</p> : null}
      {actionLabel && onAction ? (
        <Button className="mt-4 rounded-none" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}
