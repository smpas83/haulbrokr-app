import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

export function AppLoader({ className, label = "Loading…" }: { className?: string; label?: string }) {
  return (
    <div
      className={cn("flex min-h-[40vh] flex-col items-center justify-center gap-3", className)}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <Loader2 className="h-8 w-8 animate-spin text-primary motion-reduce:animate-none" aria-hidden />
      <span className="sr-only">{label}</span>
    </div>
  );
}
