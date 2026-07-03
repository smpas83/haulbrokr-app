import { Spinner } from "@/components/ui/spinner";

export function AppLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <Spinner className="h-8 w-8 text-primary" />
    </div>
  );
}
