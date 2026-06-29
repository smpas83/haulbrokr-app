import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/apiFetch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  DollarSign, TrendingUp, Banknote, Briefcase, Activity, PackageCheck,
  ClipboardList, FileStack, XCircle, Truck, Users, UserCog, HardHat,
  MapPin, ArrowRight, Search,
} from "lucide-react";

// ── Types returned by the expanded /admin endpoints ──────────────────────────
export interface AdminOverviewV2 {
  gmv: number; brokerFees: number; realisedProfit: number; realisedGmv: number; avgJobValue: number;
  requestsPosted: number; openRequests: number; totalJobs: number; acceptedJobs: number;
  activeJobs: number; inProgressJobs: number; completedJobs: number; cancelledJobs: number;
  newCarriers: number; newCustomers: number; drivers: number; supervisors: number;
  stuckPayouts: number; pendingCompliance: number; pendingCredit: number; openBinOrders: number;
}
interface JobRow {
  id: number; status: string; paymentStatus: string; materialType: string; truckType: string;
  pickupAddress: string; deliveryAddress: string; scheduledDate: string;
  gmv: number; brokerFee: number; providerNet: number;
  customerId: number; providerId: number;
  customerName: string | null; customerCity: string | null; customerState: string | null;
  providerName: string | null; providerCity: string | null; providerState: string | null;
  createdAt: string;
}
interface RequestRow {
  id: number; status: string; materialType: string; truckType: string; quantityTons: string;
  pickupAddress: string; deliveryAddress: string; budgetPerHour: string | null;
  scheduledDate: string; trucksNeeded: number; customerId: number;
  customerName: string | null; customerCity: string | null; customerState: string | null; createdAt: string;
}
interface PersonRow {
  id: number; role: string; companyName: string; contactName: string | null; email: string | null;
  phone: string | null; city: string | null; state: string | null; mcNumber: string | null; createdAt: string;
}

const money = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n || 0);
const loc = (city?: string | null, state?: string | null) =>
  [city, state].filter(Boolean).join(", ") || "—";
const dateFmt = (s?: string) => (s ? new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—");

type Drill =
  | { kind: "jobs"; status: string; title: string }
  | { kind: "requests"; status: string; title: string }
  | { kind: "people"; role: string; title: string }
  | null;

// ── Clickable metric card ────────────────────────────────────────────────────
function MetricCard({
  icon, label, value, hint, accent, onClick,
}: {
  icon: React.ReactNode; label: string; value: React.ReactNode; hint?: string; accent?: boolean; onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`text-left rounded-none border p-4 transition-colors w-full ${
        onClick ? "hover:border-primary hover:bg-muted/40 cursor-pointer" : "cursor-default"
      } ${accent ? "border-primary/40 bg-primary/5" : ""}`}
    >
      <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wider">
        {icon}{label}
      </div>
      <div className="mt-2 text-2xl font-bold tabular-nums">{value}</div>
      <div className="mt-1 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{hint ?? ""}</span>
        {onClick ? <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" /> : null}
      </div>
    </button>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">{title}</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">{children}</div>
    </div>
  );
}

// ── Drill-down dialog ────────────────────────────────────────────────────────
function DrillDialog({ drill, onClose }: { drill: Drill; onClose: () => void }) {
  const [q, setQ] = useState("");
  const open = !!drill;

  const jobs = useQuery({
    queryKey: ["admin-jobs", drill && "kind" in drill ? (drill as any).status : ""],
    queryFn: () => apiFetch<JobRow[]>(`/admin/jobs?status=${encodeURIComponent((drill as any).status)}`),
    enabled: open && drill?.kind === "jobs",
  });
  const requests = useQuery({
    queryKey: ["admin-requests", drill && drill.kind === "requests" ? drill.status : ""],
    queryFn: () => apiFetch<RequestRow[]>(`/admin/requests?status=${encodeURIComponent((drill as any).status)}`),
    enabled: open && drill?.kind === "requests",
  });
  const people = useQuery({
    queryKey: ["admin-people", drill && drill.kind === "people" ? drill.role : ""],
    queryFn: () => apiFetch<PersonRow[]>(`/admin/people?role=${encodeURIComponent((drill as any).role)}`),
    enabled: open && drill?.kind === "people",
  });

  const loading = jobs.isLoading || requests.isLoading || people.isLoading;
  const ql = q.trim().toLowerCase();
  const match = (...vals: (string | null | undefined)[]) =>
    !ql || vals.filter(Boolean).some((v) => String(v).toLowerCase().includes(ql));

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl rounded-none max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{drill?.title}</DialogTitle>
          <DialogDescription>Live records from your platform database.</DialogDescription>
        </DialogHeader>
        <div className="relative mb-2">
          <Search className="w-4 h-4 absolute left-2 top-2.5 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, location, material…" className="pl-8 rounded-none" />
        </div>
        <div className="overflow-auto flex-1 -mx-1 px-1">
          {loading ? (
            <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : drill?.kind === "jobs" ? (
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-muted-foreground border-b">
                <tr><th className="text-left py-2">Job</th><th className="text-left">Customer</th><th className="text-left">Carrier</th><th className="text-left">Route</th><th className="text-right">GMV</th><th className="text-right">Broker fee</th><th className="text-left pl-3">Status</th></tr>
              </thead>
              <tbody>
                {(jobs.data ?? []).filter((r) => match(r.customerName, r.providerName, r.materialType, r.pickupAddress, r.deliveryAddress)).map((r) => (
                  <tr key={r.id} className="border-b last:border-0 hover:bg-muted/40">
                    <td className="py-2 font-medium">#{r.id}<div className="text-xs text-muted-foreground capitalize">{r.materialType} · {String(r.truckType).replace(/_/g, " ")}</div></td>
                    <td><div>{r.customerName ?? "—"}</div><div className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="w-3 h-3" />{loc(r.customerCity, r.customerState)}</div></td>
                    <td><div>{r.providerName ?? "—"}</div><div className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="w-3 h-3" />{loc(r.providerCity, r.providerState)}</div></td>
                    <td className="text-xs max-w-[200px]"><div className="truncate" title={r.pickupAddress}>↑ {r.pickupAddress}</div><div className="truncate" title={r.deliveryAddress}>↓ {r.deliveryAddress}</div></td>
                    <td className="text-right tabular-nums">{money(r.gmv)}</td>
                    <td className="text-right tabular-nums text-primary font-medium">{money(r.brokerFee)}</td>
                    <td className="pl-3"><Badge variant="outline" className="rounded-none capitalize">{String(r.status).replace(/_/g, " ")}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : drill?.kind === "requests" ? (
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-muted-foreground border-b">
                <tr><th className="text-left py-2">Post</th><th className="text-left">Customer</th><th className="text-left">Route</th><th className="text-right">Budget/hr</th><th className="text-left pl-3">Status</th></tr>
              </thead>
              <tbody>
                {(requests.data ?? []).filter((r) => match(r.customerName, r.materialType, r.pickupAddress, r.deliveryAddress)).map((r) => (
                  <tr key={r.id} className="border-b last:border-0 hover:bg-muted/40">
                    <td className="py-2 font-medium">#{r.id}<div className="text-xs text-muted-foreground capitalize">{r.materialType} · {r.quantityTons} tons · {r.trucksNeeded} trucks</div></td>
                    <td><div>{r.customerName ?? "—"}</div><div className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="w-3 h-3" />{loc(r.customerCity, r.customerState)}</div></td>
                    <td className="text-xs max-w-[220px]"><div className="truncate" title={r.pickupAddress}>↑ {r.pickupAddress}</div><div className="truncate" title={r.deliveryAddress}>↓ {r.deliveryAddress}</div></td>
                    <td className="text-right tabular-nums">{r.budgetPerHour ? money(Number(r.budgetPerHour)) : "—"}</td>
                    <td className="pl-3"><Badge variant="outline" className="rounded-none capitalize">{String(r.status).replace(/_/g, " ")}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : drill?.kind === "people" ? (
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-muted-foreground border-b">
                <tr><th className="text-left py-2">Company</th><th className="text-left">Contact</th><th className="text-left">Location</th><th className="text-left">Email</th><th className="text-left">Phone</th></tr>
              </thead>
              <tbody>
                {(people.data ?? []).filter((r) => match(r.companyName, r.contactName, r.email, r.city)).map((r) => (
                  <tr key={r.id} className="border-b last:border-0 hover:bg-muted/40">
                    <td className="py-2 font-medium">{r.companyName}{r.mcNumber ? <div className="text-xs text-muted-foreground">MC# {r.mcNumber}</div> : null}</td>
                    <td>{r.contactName ?? "—"}</td>
                    <td><div className="text-xs flex items-center gap-1"><MapPin className="w-3 h-3" />{loc(r.city, r.state)}</div></td>
                    <td className="text-xs">{r.email ?? "—"}</td>
                    <td className="text-xs">{r.phone ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Main insights dashboard ──────────────────────────────────────────────────
export function AdminInsights({ enabled }: { enabled: boolean }) {
  const [drill, setDrill] = useState<Drill>(null);
  const overview = useQuery({
    queryKey: ["admin-overview-v2"],
    queryFn: () => apiFetch<AdminOverviewV2>("/admin/overview"),
    enabled,
  });

  if (overview.isLoading) {
    return <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">{Array.from({ length: 12 }).map((_, i) => <Skeleton key={i} className="h-28 w-full" />)}</div>;
  }
  const d = overview.data;
  if (!d) return <div className="text-sm text-muted-foreground py-8 text-center">Couldn't load platform stats. Try refreshing.</div>;

  return (
    <div className="space-y-6">
      <Section title="Money">
        <MetricCard accent icon={<DollarSign className="w-3.5 h-3.5" />} label="GMV (billed)" value={money(d.gmv)} hint="Total customer-billed" onClick={() => setDrill({ kind: "jobs", status: "", title: "All jobs (GMV)" })} />
        <MetricCard accent icon={<TrendingUp className="w-3.5 h-3.5" />} label="Broker-fee revenue" value={money(d.brokerFees)} hint="15% platform fee on all jobs" onClick={() => setDrill({ kind: "jobs", status: "", title: "All jobs (broker fees)" })} />
        <MetricCard accent icon={<Banknote className="w-3.5 h-3.5" />} label="Profit realised" value={money(d.realisedProfit)} hint="Broker fees on paid-out jobs" onClick={() => setDrill({ kind: "jobs", status: "completed", title: "Completed jobs" })} />
        <MetricCard icon={<Activity className="w-3.5 h-3.5" />} label="Avg job value" value={money(d.avgJobValue)} hint="GMV ÷ total jobs" />
      </Section>

      <Section title="Jobs funnel">
        <MetricCard icon={<ClipboardList className="w-3.5 h-3.5" />} label="Jobs posted" value={d.requestsPosted.toLocaleString()} hint={`${d.openRequests} still open`} onClick={() => setDrill({ kind: "requests", status: "", title: "Job posts (customer requests)" })} />
        <MetricCard icon={<FileStack className="w-3.5 h-3.5" />} label="Accepted" value={d.acceptedJobs.toLocaleString()} hint="Awarded + accepted" onClick={() => setDrill({ kind: "jobs", status: "accepted", title: "Accepted jobs" })} />
        <MetricCard icon={<Briefcase className="w-3.5 h-3.5" />} label="In progress" value={d.inProgressJobs.toLocaleString()} hint="Active hauls now" onClick={() => setDrill({ kind: "jobs", status: "in_progress", title: "In-progress jobs" })} />
        <MetricCard icon={<PackageCheck className="w-3.5 h-3.5" />} label="Completed" value={d.completedJobs.toLocaleString()} hint="Finished hauls" onClick={() => setDrill({ kind: "jobs", status: "completed", title: "Completed jobs" })} />
      </Section>

      <Section title="People">
        <MetricCard icon={<Users className="w-3.5 h-3.5" />} label="Customers" value={d.newCustomers.toLocaleString()} hint="Customer accounts" onClick={() => setDrill({ kind: "people", role: "customer", title: "Customers" })} />
        <MetricCard icon={<Truck className="w-3.5 h-3.5" />} label="Carriers (vendors)" value={d.newCarriers.toLocaleString()} hint="Provider accounts" onClick={() => setDrill({ kind: "people", role: "provider", title: "Carriers / vendors" })} />
        <MetricCard icon={<HardHat className="w-3.5 h-3.5" />} label="Drivers" value={d.drivers.toLocaleString()} hint="Driver accounts" onClick={() => setDrill({ kind: "people", role: "driver", title: "Drivers" })} />
        <MetricCard icon={<UserCog className="w-3.5 h-3.5" />} label="Supervisors" value={d.supervisors.toLocaleString()} hint="Site supervisors" onClick={() => setDrill({ kind: "people", role: "supervisor", title: "Supervisors" })} />
      </Section>

      {d.cancelledJobs > 0 && (
        <Section title="Attention">
          <MetricCard icon={<XCircle className="w-3.5 h-3.5" />} label="Cancelled / declined" value={d.cancelledJobs.toLocaleString()} onClick={() => setDrill({ kind: "jobs", status: "cancelled", title: "Cancelled / declined jobs" })} />
        </Section>
      )}

      <DrillDialog drill={drill} onClose={() => setDrill(null)} />
    </div>
  );
}
