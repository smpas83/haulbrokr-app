import { cn } from "@/lib/utils";
import type { HTMLAttributes, ReactNode } from "react";

export interface MapContainerProps extends HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
}

/** Web map placeholder — styling neutral until design system defines map chrome. */
export function MapContainer({ children, className, ...props }: MapContainerProps) {
  return (
    <div
      className={cn(
        "relative w-full h-full min-h-[320px] rounded-lg border border-border bg-muted overflow-hidden",
        className,
      )}
      {...props}
    >
      {children ?? (
        <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm">
          Map view
        </div>
      )}
    </div>
  );
}
