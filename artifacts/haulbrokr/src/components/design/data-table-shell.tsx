import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface DataTableShellProps {
  children: ReactNode;
  className?: string;
}

/** Premium table container — consistent borders, scroll, and elevation */
export function DataTableShell({ children, className }: DataTableShellProps) {
  return (
    <div className={cn("surface-panel rounded-2xl overflow-hidden", className)}>
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}
