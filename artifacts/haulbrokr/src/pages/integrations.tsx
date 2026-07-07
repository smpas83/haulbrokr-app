import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { CheckCircle2, Link2, Link2Off, RefreshCw, Loader2, Plug, BookOpen, FileText, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { apiFetch } from "@/lib/apiFetch";

function QuickBooksCard() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [connectName, setConnectName] = useState("");
  const [open, setOpen] = useState(false);

  const { data: qb, isLoading } = useQuery({
    queryKey: ["qb-status"],
    queryFn: () => apiFetch("/quickbooks/status"),
  });

  const connect = useMutation({
    mutationFn: () => apiFetch("/quickbooks/connect", { method: "POST", body: JSON.stringify({ companyName: connectName }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["qb-status"] }); toast({ title: "QuickBooks linked (preview mode)" }); setOpen(false); },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  const disconnect = useMutation({
    mutationFn: () => apiFetch("/quickbooks/disconnect", { method: "POST" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["qb-status"] }); toast({ title: "QuickBooks disconnected" }); },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  const sync = useMutation({
    mutationFn: () => apiFetch("/quickbooks/sync", { method: "POST" }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["qb-status"] });
      toast({ title: `Sync complete — ${data.invoicesSynced} invoices synced` });
    },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  const isConnected = qb?.connected === true;

  return (
    <div className="bg-card border border-border/60 overflow-hidden">
      <div className="bg-secondary text-secondary-foreground p-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-[#2ca01c] p-2 rounded">
            <BookOpen className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-lg">QuickBooks Online</h3>
            <p className="text-sm text-secondary-foreground/70">Preview — connect stores your company; live invoice sync is coming soon</p>
          </div>
        </div>
        {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : (
          <Badge className={`rounded-xl border-2 font-bold text-xs ${isConnected ? "bg-green-100 text-green-800 border-green-200" : "bg-gray-100 text-gray-700 border-gray-200"}`}>
            {isConnected ? <><CheckCircle2 className="h-3 w-3 mr-1" />Connected</> : "Not Connected"}
          </Badge>
        )}
      </div>

      <div className="p-5 space-y-4">
        {isConnected ? (
          <>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-muted/30 p-3 border border-border text-center">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Company</p>
                <p className="font-bold text-sm truncate">{qb.companyName}</p>
              </div>
              <div className="bg-muted/30 p-3 border border-border text-center">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Invoices Synced</p>
                <p className="font-bold text-sm">{qb.invoicesSynced}</p>
              </div>
              <div className="bg-muted/30 p-3 border border-border text-center">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Last Sync</p>
                <p className="font-bold text-sm">{qb.lastSyncedAt ? format(new Date(qb.lastSyncedAt), "MMM d, h:mm a") : "Never"}</p>
              </div>
            </div>

            {qb.lastSyncStatus === "success" && (
              <Alert className="rounded-xl border-green-200 bg-green-50">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-700 text-sm">Last sync successful</AlertDescription>
              </Alert>
            )}

            <div className="flex gap-3">
              <Button className="flex-1 rounded-xl font-bold" disabled={sync.isPending} onClick={() => sync.mutate()}>
                {sync.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                Sync Now
              </Button>
              <Button variant="outline" className="rounded-xl border-2" disabled={disconnect.isPending} onClick={() => disconnect.mutate()}>
                {disconnect.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2Off className="h-4 w-4" />}
              </Button>
            </div>

            <div className="border-t border-border pt-4">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">What gets synced</p>
              <div className="space-y-1 text-sm text-muted-foreground">
                {["Completed job invoices → QuickBooks Invoices", "Payment records → QuickBooks Payments", "Operator payments → QuickBooks Bills", "Job metadata → QuickBooks Memo field"].map(item => (
                  <div key={item} className="flex items-center gap-2"><CheckCircle2 className="h-3 w-3 text-green-500 flex-shrink-0" />{item}</div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">Connect QuickBooks Online to automatically sync your HaulBrokr invoices, payments, and job records. No more manual data entry.</p>
            <div className="space-y-2 text-sm text-muted-foreground">
              {["Auto-create invoices for every completed job", "Track all operator payments in one place", "Reconcile payments with your bank automatically", "Export reports for tax preparation"].map(item => (
                <div key={item} className="flex items-center gap-2"><CheckCircle2 className="h-3 w-3 text-green-500 flex-shrink-0" />{item}</div>
              ))}
            </div>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button className="w-full rounded-xl font-bold bg-[#2ca01c] hover:bg-[#238016]"><Link2 className="mr-2 h-4 w-4" />Connect QuickBooks</Button>
              </DialogTrigger>
              <DialogContent className="rounded-xl border-2 max-w-sm">
                <DialogHeader><DialogTitle>Connect QuickBooks Online</DialogTitle></DialogHeader>
                <div className="space-y-4 mt-2">
                  <div><Label>QuickBooks Company Name</Label><Input className="rounded-xl mt-1" value={connectName} onChange={e => setConnectName(e.target.value)} placeholder="My Construction LLC" /></div>
                  <Button className="w-full rounded-xl font-bold bg-[#2ca01c] hover:bg-[#238016]" disabled={!connectName || connect.isPending} onClick={() => connect.mutate()}>
                    {connect.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Connect & Authorize
                  </Button>
                  <p className="text-xs text-muted-foreground text-center">You'll be redirected to QuickBooks to authorize access</p>
                </div>
              </DialogContent>
            </Dialog>
          </>
        )}
      </div>
    </div>
  );
}

function ComingSoonCard({ name, description, icon: Icon, color }: { name: string; description: string; icon: any; color: string }) {
  return (
    <div className="bg-card border border-dashed border-border/60 p-5 opacity-60">
      <div className="flex items-center gap-3 mb-3">
        <div className={`${color} p-2 rounded`}><Icon className="h-5 w-5 text-white" /></div>
        <div><h3 className="font-bold">{name}</h3><p className="text-xs text-muted-foreground">{description}</p></div>
      </div>
      <Badge variant="outline" className="rounded-xl text-xs">Coming Soon</Badge>
    </div>
  );
}

export default function IntegrationsPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-6 page-enter pb-12">
      <div>
        <h1 className="text-3xl font-black uppercase tracking-tight">Integrations</h1>
        <p className="text-muted-foreground mt-1">Connect your HaulBrokr account with the tools you already use</p>
      </div>

      <div className="space-y-4">
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Accounting</p>
        <QuickBooksCard />
      </div>

      <div className="space-y-4">
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Coming Soon</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ComingSoonCard name="Procore" description="Sync jobs with your construction projects" icon={BarChart3} color="bg-[#f47920]" />
          <ComingSoonCard name="Sage 300" description="Enterprise ERP integration" icon={FileText} color="bg-[#0073a8]" />
          <ComingSoonCard name="Relay Payments" description="Instant driver payments and fuel cards" icon={Plug} color="bg-[#6366f1]" />
          <ComingSoonCard name="Stripe Connect" description="Custom payout routing for brokers" icon={CheckCircle2} color="bg-[#635bff]" />
        </div>
      </div>
    </div>
  );
}
