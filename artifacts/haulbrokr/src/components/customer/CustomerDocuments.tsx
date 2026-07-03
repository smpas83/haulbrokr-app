import { lazy, memo, Suspense } from "react";
import { FileText, Image, Receipt, Scale } from "lucide-react";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { AppLoader, EmptyState } from "@/components/shared";
import { useCustomerDocuments } from "@/hooks/useCustomerDashboardData";
import type { Job } from "@workspace/api-client-react";

const DOC_ICONS = {
  pod: Receipt,
  scale_ticket: Scale,
  bol: FileText,
  photo: Image,
} as const;

function DocumentsContent({ jobs }: { jobs: Job[] }) {
  const { data, isLoading, isError, refetch } = useCustomerDocuments(jobs);

  if (isLoading) {
    return (
      <div className="space-y-3" aria-busy="true">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-12 w-full rounded-none" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="text-center py-6 space-y-3">
        <p className="text-sm text-destructive font-semibold">Failed to load documents</p>
        <Button variant="outline" size="sm" className="rounded-none border-2" onClick={() => refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  if (!data?.length) {
    return (
      <EmptyState
        icon={FileText}
        title="No documents yet"
        description="POD, scale tickets, BOL, and photos appear here as drivers upload them."
        className="border-0 py-6"
      />
    );
  }

  return (
    <ul className="space-y-2" role="list" aria-label="Latest documents">
      {data.map((doc, i) => {
        const Icon = DOC_ICONS[doc.type];
        return (
          <li key={`${doc.jobId}-${doc.type}-${i}`}>
            <Link
              href={`/jobs/${doc.jobId}`}
              className="flex items-center gap-3 p-3 border border-border hover:bg-muted/30 transition-colors"
            >
              <Icon className="h-4 w-4 text-primary flex-shrink-0" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold truncate">{doc.label}</p>
                <p className="text-xs text-muted-foreground">{doc.jobLabel}</p>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

const LazyDocumentsContent = lazy(async () => ({
  default: DocumentsContent,
}));

interface CustomerDocumentsProps {
  jobs: Job[];
}

export const CustomerDocuments = memo(function CustomerDocuments({ jobs }: CustomerDocumentsProps) {
  return (
    <Card className="rounded-none border-2 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-bold">Documents</CardTitle>
        <CardDescription>Latest POD, scale tickets, BOL, and photos</CardDescription>
      </CardHeader>
      <CardContent>
        <Suspense fallback={<AppLoader className="min-h-[120px]" label="Loading documents" />}>
          <LazyDocumentsContent jobs={jobs} />
        </Suspense>
      </CardContent>
    </Card>
  );
});
