import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { DollarSign, Clock, CheckCircle2, AlertCircle, Loader2, Zap, TrendingUp, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useGetMyProfile, useListJobs } from "@workspace/api-client-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { apiFetch } from "@/lib/apiFetch";
import { PageHeader } from "@/components/design";

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800 border-amber-200",
  approved: "bg-blue-100 text-blue-800 border-blue-200",
  funded: "bg-green-100 text-green-800 border-green-200",
  settled: "bg-gray-100 text-gray-800 border-gray-200",
  denied: "bg-red-100 text-red-800 border-red-200",
};

const STATUS_ICON: Record<string, any> = {
  pending: Clock,
  approved: CheckCircle2,
  funded: Zap,
  settled: CheckCircle2,
  denied: AlertCircle,
};

export default function FactoringPage() {
  const { data: profile } = useGetMyProfile();
  const { data: jobs = [] } = useListJobs({ status: "completed" } as any);
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["factoring"],
    queryFn: () => apiFetch("/factoring"),
    enabled: profile?.role === "provider",
  });

  const requestFunding = useMutation({
    mutationFn: (jobId: number) => apiFetch("/factoring", { method: "POST", body: JSON.stringify({ jobId }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["factoring"] });
      toast({ title: "Factoring request submitted", description: "Funds typically hit your account within 2 hours" });
    },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  if (profile?.role !== "provider") {
    return (
      <div className="text-center py-20">
        <DollarSign className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-xl font-bold">Invoice Factoring is for providers</h2>
        <p className="text-muted-foreground mt-2">Switch to a provider account to access same-day advances.</p>
      </div>
    );
  }

  const factoredJobIds = new Set(requests.map((r: any) => r.jobId));
  const eligibleJobs = (jobs as any[]).filter((j: any) =>
    (j.status === "completed" || j.status === "in_progress") && !factoredJobIds.has(j.id)
  );

  const totalAdvanced = requests.filter((r: any) => r.status !== "denied").reduce((s: number, r: any) => s + r.netAmount, 0);
  const pendingCount = requests.filter((r: any) => r.status === "pending").length;

  return (
    <div className="max-w-5xl mx-auto space-y-6 page-enter pb-12">
      <PageHeader
        eyebrow="Payments"
        title="Invoice Factoring"
        description="Get paid same-day on completed jobs — no waiting for net-30 invoices."
      />

      <Alert className="rounded-xl border-2 border-primary/30 bg-primary/5">
        <Zap className="h-4 w-4" />
        <AlertTitle className="font-bold">How it works</AlertTitle>
        <AlertDescription className="text-sm space-y-1 mt-1">
          <p>1. You complete a job — submit a factoring request to get paid immediately</p>
          <p>2. HaulBrokr advances <strong>97%</strong> of the invoice (3% same-day fee)</p>
          <p>3. Funds hit your wallet within 2 hours. HaulBrokr collects from the customer at net-30</p>
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-card border border-border/60 p-4 text-center">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Total Advanced</p>
          <p className="text-3xl font-black text-primary">${totalAdvanced.toLocaleString()}</p>
        </div>
        <div className="bg-card border border-border/60 p-4 text-center">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Requests</p>
          <p className="text-3xl font-black">{requests.length}</p>
        </div>
        <div className="bg-card border border-border/60 p-4 text-center">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Pending</p>
          <p className="text-3xl font-black text-amber-600">{pendingCount}</p>
        </div>
      </div>

      {eligibleJobs.length > 0 && (
        <div>
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Eligible for Advance ({eligibleJobs.length} jobs)</p>
          <div className="space-y-2">
            {eligibleJobs.map((job: any) => {
              const invoiceAmt = job.totalAmount || job.ratePerHour * 8;
              const net = invoiceAmt * 0.97;
              return (
                <div key={job.id} className="flex items-center justify-between bg-card border border-border/60 p-4 hover:border-primary/40 transition-colors">
                  <div>
                    <p className="font-bold">JOB-{String(job.id).padStart(4, "0")} — {job.materialType} Haul</p>
                    <p className="text-sm text-muted-foreground mt-0.5">Invoice: <strong>${invoiceAmt.toLocaleString()}</strong> → You receive <strong className="text-green-600">${net.toFixed(2)}</strong> today (3% fee)</p>
                  </div>
                  <Button
                    size="sm"
                    className="rounded-xl font-bold ml-4"
                    disabled={requestFunding.isPending}
                    onClick={() => requestFunding.mutate(job.id)}
                  >
                    {requestFunding.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Zap className="h-3 w-3 mr-1" />}
                    Get Paid Now
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div>
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Factoring History</p>
        {isLoading ? (
          <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-16" />)}</div>
        ) : requests.length === 0 ? (
          <div className="border border-dashed border-border/60 p-10 text-center">
            <DollarSign className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
            <p className="font-bold">No factoring requests yet</p>
            <p className="text-sm text-muted-foreground mt-1">Complete a job and request same-day funding above</p>
          </div>
        ) : (
          <div className="space-y-2">
            {requests.map((r: any) => {
              const Icon = STATUS_ICON[r.status] ?? Clock;
              return (
                <div key={r.id} className="flex items-center justify-between bg-card border border-border/60 p-4">
                  <div className="flex items-center gap-3">
                    <Icon className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-bold">JOB-{String(r.jobId).padStart(4,"0")} — Invoice ${r.invoiceAmount.toLocaleString()}</p>
                      <p className="text-sm text-muted-foreground">Advanced ${r.netAmount.toFixed(2)} (fee: ${r.feeAmount.toFixed(2)}) · {format(new Date(r.requestedAt), "MMM d, yyyy")}</p>
                    </div>
                  </div>
                  <Badge className={`rounded-xl border font-bold uppercase text-xs px-3 ${STATUS_COLORS[r.status]}`}>{r.status}</Badge>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
