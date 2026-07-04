import { Link } from "wouter";
import { AlertCircle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background p-4">
      <div className="surface-panel rounded-2xl w-full max-w-md">
      <Card className="w-full border-0 shadow-none bg-transparent">
        <CardContent className="pt-8 pb-8 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10 mx-auto mb-6">
            <AlertCircle className="h-8 w-8 text-destructive" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">404</h1>
          <p className="mt-2 text-lg font-medium text-muted-foreground">Page not found</p>
          <p className="mt-4 text-sm text-muted-foreground leading-relaxed">
            The page you're looking for doesn't exist or has been moved.
          </p>
          <Button asChild className="mt-8">
            <Link href="/">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Return to HaulBrokr
            </Link>
          </Button>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
