import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

interface OfflineBannerProps {
  className?: string;
}

export function OfflineBanner({ className }: OfflineBannerProps) {
  const [offline, setOffline] = useState(
    typeof navigator !== "undefined" ? !navigator.onLine : false
  );

  useEffect(() => {
    const goOffline = () => setOffline(true);
    const goOnline = () => setOffline(false);
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, []);

  if (!offline) return null;

  return (
    <Alert
      role="alert"
      className={cn(
        "rounded-none border-2 border-destructive/50 bg-destructive/10",
        className
      )}
    >
      <WifiOff className="h-4 w-4 text-destructive" aria-hidden="true" />
      <AlertTitle className="text-destructive font-bold">You are offline</AlertTitle>
      <AlertDescription className="text-destructive/80">
        Live dispatch data may be stale. Reconnect to refresh operations.
      </AlertDescription>
    </Alert>
  );
}
