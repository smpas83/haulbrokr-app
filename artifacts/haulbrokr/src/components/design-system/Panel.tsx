import { cn } from "@/lib/utils";
import type { HTMLAttributes, ReactNode } from "react";

export interface PanelProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function Panel({ children, className, ...props }: PanelProps) {
  return (
    <div
      className={cn("rounded-lg border border-border bg-card p-4 shadow-sm", className)}
      {...props}
    >
      {children}
    </div>
  );
}
