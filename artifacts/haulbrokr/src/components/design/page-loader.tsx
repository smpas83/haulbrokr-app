import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

interface PageLoaderProps {
  message?: string;
  className?: string;
}

export function PageLoader({ message = "Loading...", className }: PageLoaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center min-h-[50vh] gap-4 animate-fade-in",
        className
      )}
      role="status"
      aria-live="polite"
    >
      <Spinner className="h-8 w-8 text-primary" />
      {message && (
        <p className="text-sm text-muted-foreground font-medium">{message}</p>
      )}
    </div>
  );
}
