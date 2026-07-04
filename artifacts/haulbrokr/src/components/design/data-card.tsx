import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface DataCardProps {
  children: ReactNode;
  className?: string;
  interactive?: boolean;
}

export function DataCard({ children, className, interactive = true }: DataCardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border/60 bg-card shadow-sm shadow-black/20 transition-all duration-200",
        interactive && "hover-elevate hover:border-primary/30",
        className
      )}
    >
      {children}
    </div>
  );
}
