import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export interface NotificationProps {
  title: string;
  description?: string;
  variant?: "default" | "destructive";
  className?: string;
  action?: ReactNode;
}

export function Notification({ title, description, variant = "default", className, action }: NotificationProps) {
  return (
    <div
      className={cn(
        "rounded-lg border p-4 shadow-sm",
        variant === "destructive"
          ? "border-destructive/50 bg-destructive/10 text-destructive"
          : "border-border bg-card text-card-foreground",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium">{title}</p>
          {description ? <p className="text-sm text-muted-foreground mt-1">{description}</p> : null}
        </div>
        {action}
      </div>
    </div>
  );
}
