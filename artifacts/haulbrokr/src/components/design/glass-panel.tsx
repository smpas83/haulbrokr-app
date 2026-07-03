import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface GlassPanelProps {
  children: ReactNode;
  className?: string;
  strong?: boolean;
  glow?: "blue" | "orange" | "none";
}

export function GlassPanel({ children, className, strong, glow = "none" }: GlassPanelProps) {
  return (
    <div
      className={cn(
        strong ? "glass-panel-strong" : "glass-panel",
        "rounded-xl",
        glow === "blue" && "neon-blue",
        glow === "orange" && "neon-accent",
        className
      )}
    >
      {children}
    </div>
  );
}
