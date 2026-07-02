import { AlertTriangle, Home, LifeBuoy } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AuthenticationUnavailable() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-secondary px-4 py-12">
      <div className="w-full max-w-lg border-2 border-border bg-card p-8 text-center shadow-sm">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center bg-primary/10 text-primary">
          <AlertTriangle className="h-7 w-7" />
        </div>
        <p className="mb-2 font-mono text-xs font-bold uppercase tracking-[0.24em] text-muted-foreground">
          Authentication unavailable
        </p>
        <h1 className="text-3xl font-black tracking-tight">
          Sign-in is temporarily unavailable.
        </h1>
        <p className="mt-4 text-muted-foreground">
          Public HaulBrokr pages are still available, but account access requires
          VITE_CLERK_PUBLISHABLE_KEY to be configured.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button asChild className="rounded-none font-bold">
            <a href="/">
              <Home className="mr-2 h-4 w-4" />
              Back home
            </a>
          </Button>
          <Button asChild variant="outline" className="rounded-none border-2 font-bold">
            <a href="/support">
              <LifeBuoy className="mr-2 h-4 w-4" />
              Contact support
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}
