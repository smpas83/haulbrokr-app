import type { ReactNode } from "react";
import { MapPin } from "lucide-react";

import { cn } from "@/lib/utils";

export function MapContainer({
  children,
  className,
  placeholder = "Map preview",
}: {
  children?: ReactNode;
  className?: string;
  placeholder?: string;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden border-2 border-border bg-muted min-h-[160px] flex items-center justify-center",
        className,
      )}
      role="img"
      aria-label={placeholder}
    >
      {children ?? (
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <MapPin className="h-8 w-8 opacity-40" aria-hidden />
          <span className="text-xs font-semibold uppercase tracking-wider">{placeholder}</span>
        </div>
      )}
    </div>
  );
}
