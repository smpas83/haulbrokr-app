import { WifiOff } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

export function OfflineBanner({ className, onRetry }: { className?: string; onRetry?: () => void }) {
  return (
    <Alert
      className={cn("rounded-none border-2 border-destructive/50 bg-destructive/10", className)}
      role="alert"
    >
      <WifiOff className="h-4 w-4 text-destructive" aria-hidden />
      <AlertTitle className="font-bold text-destructive">You&apos;re offline</AlertTitle>
      <AlertDescription className="text-destructive/90">
        Some data may be stale. Check your connection
        {onRetry ? (
          <>
            {" "}
            or{" "}
            <button type="button" onClick={onRetry} className="font-semibold underline">
              try again
            </button>
            .
          </>
        ) : (
          "."
        )}
      </AlertDescription>
    </Alert>
  );
}
