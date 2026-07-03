import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface AppLoaderProps {
  label?: string;
  className?: string;
  fullScreen?: boolean;
}

export function AppLoader({ label = "Loading", className, fullScreen = true }: AppLoaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 bg-background",
        fullScreen ? "min-h-screen" : "min-h-[40vh]",
        className,
      )}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </div>
  );
}
