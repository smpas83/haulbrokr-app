import { Spinner } from "@/components/ui/spinner";

interface AppLoaderProps {
  label?: string;
  className?: string;
}

/** Full-screen loading state used for auth shell and lazy route boundaries. */
export function AppLoader({ label = "Loading HaulBrokr", className }: AppLoaderProps) {
  return (
    <div
      className={`flex min-h-screen flex-col items-center justify-center gap-3 bg-background ${className ?? ""}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <Spinner className="h-8 w-8 text-primary" />
      <span className="sr-only">{label}</span>
    </div>
  );
}
