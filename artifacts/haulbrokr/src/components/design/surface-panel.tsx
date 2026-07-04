import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SurfacePanelProps {
  children: ReactNode;
  className?: string;
  /** Slightly elevated gunmetal panel for hero/map frames */
  elevated?: boolean;
  /** Interactive hover lift */
  interactive?: boolean;
}

/** Solid matte panel — no glass blur. Primary building block of the design system. */
export function SurfacePanel({ children, className, elevated, interactive }: SurfacePanelProps) {
  return (
    <div
      className={cn(
        elevated ? "surface-panel-elevated" : "surface-panel",
        interactive && "hover-elevate cursor-default",
        "rounded-2xl",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** @deprecated Use SurfacePanel — kept for backward compatibility */
export function GlassPanel({
  children,
  className,
  strong,
}: {
  children: ReactNode;
  className?: string;
  strong?: boolean;
  glow?: "blue" | "orange" | "none";
}) {
  return (
    <SurfacePanel elevated={strong} className={className}>
      {children}
    </SurfacePanel>
  );
}
