import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";
import { Link } from "wouter";

export default function NotFound() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background">
      <Card className="mx-4 w-full max-w-md rounded-none border-2">
        <CardContent className="pt-6">
          <div className="mb-4 flex gap-2">
            <AlertCircle className="h-8 w-8 text-destructive" aria-hidden="true" />
            <h1 className="text-2xl font-bold text-foreground">404 — Page Not Found</h1>
          </div>

          <p className="mt-4 text-sm text-muted-foreground">
            The page you&apos;re looking for doesn&apos;t exist or has been moved.
          </p>
          <Button asChild className="mt-6 rounded-none font-bold">
            <Link href="/">Return to HaulBrokr</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
