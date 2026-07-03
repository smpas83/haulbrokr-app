import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface AppLoaderProps {
  className?: string;
  label?: string;
}

export function AppLoader({ className, label = "Loading" }: AppLoaderProps) {
  return (
    <div
      className={cn("flex flex-col items-center justify-center gap-3 p-8", className)}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <Loader2 className="h-8 w-8 animate-spin text-primary motion-reduce:animate-none" aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </div>
  );
}
