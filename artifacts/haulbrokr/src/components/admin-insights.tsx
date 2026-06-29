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
  MapPin, ArrowRight, Search, ChevronRight, Building2, Phone, Mail, Globe, Loader2,
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, LineChart, Line,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, Legend,
} from "recharts";

// Ã¢ÂÂÃ¢ÂÂ Types returned by the expanded /admin endpoints Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ
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
  [city, state].filter(Boolean).join(", ") || "Ã¢ÂÂ";
const dateFmt = (s?: string) => (s ? new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "Ã¢ÂÂ");

type Drill =
  | { kind: "jobs"; status: string; title: string }
  | { kind: "requests"; status: string; title: string }
  | { kind: "people"; role: string; title: string }
  | null;

// Ã¢ÂÂÃ¢ÂÂ Clickable metric card Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ
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

// Ã¢ÂÂÃ¢ÂÂ Drill-down dialog Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ
function DrillDialog({ drill, onClose }: { drill: Drill; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [selectedPersonId, setSelectedPersonId] = useState<number | null>(null);
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
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, location, materialÃ¢ÂÂ¦" className="pl-8 rounded-none" />
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
                    <td className="py-2 font-medium">#{r.id}<div className="text-xs text-muted-foreground capitalize">{r.materialType} ÃÂ· {String(r.truckType).replace(/_/g, " ")}</div></td>
                    <td><div>{r.customerName ?? "Ã¢ÂÂ"}</div><div className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="w-3 h-3" />{loc(r.customerCity, r.customerState)}</div></td>
                    <td><div>{r.providerName ?? "Ã¢ÂÂ"}</div><div className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="w-3 h-3" />{loc(r.providerCity, r.providerState)}</div></td>
                    <td className="text-xs max-w-[200px]"><div className="truncate" title={r.pickupAddress}>Ã¢ÂÂ {r.pickupAddress}</div><div className="truncate" title={r.deliveryAddress}>Ã¢ÂÂ {r.deliveryAddress}</div></td>
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
                    <td className="py-2 font-medium">#{r.id}<div className="text-xs text-muted-foreground capitalize">{r.materialType} ÃÂ· {r.quantityTons} tons ÃÂ· {r.trucksNeeded} trucks</div></td>
                    <td><div>{r.customerName ?? "Ã¢ÂÂ"}</div><div className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="w-3 h-3" />{loc(r.customerCity, r.customerState)}</div></td>
                    <td className="text-xs max-w-[220px]"><div className="truncate" title={r.pickupAddress}>Ã¢ÂÂ {r.pickupAddress}</div><div className="truncate" title={r.deliveryAddress}>Ã¢ÂÂ {r.deliveryAddress}</div></td>
                    <td className="text-right tabular-nums">{r.budgetPerHour ? money(Number(r.budgetPerHour)) : "Ã¢ÂÂ"}</td>
                    <td className="pl-3"><Badge variant="outline" className="rounded-none capitalize">{String(r.status).replace(/_/g, " ")}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : drill?.kind === "people" ? (
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-muted-foreground border-b">
                <tr><th className="text-left py-2">Company</th><th className="text-left">Contact</th><th className="text-left">Location</th><th className="text-left">Email</th><th className="text-left">Phone</th><th></th></tr>
              </thead>
              <tbody>
                {(people.data ?? []).filter((r) => match(r.companyName, r.contactName, r.email, r.city)).map((r) => (
                  <tr key={r.id} onClick={() => setSelectedPersonId(r.id)} className="border-b last:border-0 hover:bg-muted/60 cursor-pointer">
                    <td className="py-2 font-medium">{r.companyName}{r.mcNumber ? <div className="text-xs text-muted-foreground">MC# {r.mcNumber}</div> : null}</td>
                    <td>{r.contactName ?? "Ã¢ÂÂ"}</td>
                    <td><div className="text-xs flex items-center gap-1"><MapPin className="w-3 h-3" />{loc(r.city, r.state)}</div></td>
                    <td className="text-xs">{r.email ?? "Ã¢ÂÂ"}</td>
                    <td className="text-xs">{r.phone ?? "Ã¢ÂÂ"}</td>
                    <td className="text-right pr-1"><ChevronRight className="w-4 h-4 text-muted-foreground inline" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </div>
        <PersonDetail id={selectedPersonId} onClose={() => setSelectedPersonId(null)} />
      </DialogContent>
    </Dialog>
  );
}

// Ã¢ÂÂÃ¢ÂÂ Main insights dashboard Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ
interface TimeseriesPoint {
  bucket: string; label: string; jobs: number; gmv: number; brokerFees: number;
  completed: number; customers: number; providers: number; drivers: number;
}
interface TimeseriesResp { months: number; series: TimeseriesPoint[]; }

const COLORS = {
  gmv: "#2563eb", broker: "#16a34a", jobs: "#f59e0b", completed: "#0ea5e9",
  customers: "#6366f1", providers: "#ef4444", drivers: "#a855f7",
};
const STATUS_COLORS = ["#16a34a", "#f59e0b", "#0ea5e9", "#ef4444", "#94a3b8"];

function ChartCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <Card className="rounded-none">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{title}</CardTitle>
        {subtitle ? <p className="text-xs text-muted-foreground">{subtitle}</p> : null}
      </CardHeader>
      <CardContent className="h-64">{children}</CardContent>
    </Card>
  );
}

function AdminCharts({ enabled, overview }: { enabled: boolean; overview: AdminOverviewV2 }) {
  const [months, setMonths] = useState(6);
  const ts = useQuery({
    queryKey: ["admin-timeseries", months],
    queryFn: () => apiFetch<TimeseriesResp>(`/admin/timeseries?months=${months}`),
    enabled,
  });

  const series = ts.data?.series ?? [];
  const usd = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n || 0);

  const statusData = [
    { name: "Completed", value: overview.completedJobs, fill: STATUS_COLORS[0] },
    { name: "Accepted", value: overview.acceptedJobs, fill: STATUS_COLORS[1] },
    { name: "In progress", value: overview.inProgressJobs, fill: STATUS_COLORS[2] },
    { name: "Cancelled", value: overview.cancelledJobs, fill: STATUS_COLORS[3] },
  ].filter((s) => s.value > 0);

  const peopleData = [
    { name: "Customers", value: overview.newCustomers },
    { name: "Carriers", value: overview.newCarriers },
    { name: "Drivers", value: overview.drivers },
    { name: "Supervisors", value: overview.supervisors },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Trends</h2>
        <div className="flex gap-1">
          {[3, 6, 12].map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMonths(m)}
              className={`px-3 py-1 text-xs border rounded-none ${months === m ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted"}`}
            >
              {m}m
            </button>
          ))}
        </div>
      </div>

      {ts.isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-64 w-full" />)}</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartCard title="Revenue over time" subtitle="GMV billed and your 15% broker fee per month">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                <defs>
                  <linearGradient id="gGmv" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={COLORS.gmv} stopOpacity={0.4} /><stop offset="95%" stopColor={COLORS.gmv} stopOpacity={0} /></linearGradient>
                  <linearGradient id="gBroker" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={COLORS.broker} stopOpacity={0.5} /><stop offset="95%" stopColor={COLORS.broker} stopOpacity={0} /></linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => "$" + (v >= 1000 ? (v / 1000).toFixed(0) + "k" : v)} />
                <RTooltip formatter={(v: number, n: string) => [usd(v), n === "gmv" ? "GMV" : "Broker fee"]} />
                <Legend formatter={(v) => (v === "gmv" ? "GMV" : "Broker fee")} />
                <Area type="monotone" dataKey="gmv" stroke={COLORS.gmv} fill="url(#gGmv)" strokeWidth={2} />
                <Area type="monotone" dataKey="brokerFees" stroke={COLORS.broker} fill="url(#gBroker)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Jobs over time" subtitle="Jobs created vs hauls completed per month">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={series} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                <RTooltip />
                <Legend formatter={(v) => (v === "jobs" ? "Created" : "Completed")} />
                <Bar dataKey="jobs" fill={COLORS.jobs} radius={[2, 2, 0, 0]} />
                <Bar dataKey="completed" fill={COLORS.completed} radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Job status mix" subtitle="Current distribution of all jobs">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={45} paddingAngle={2}>
                  {statusData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                </Pie>
                <RTooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Network by role" subtitle="Accounts on the platform">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={peopleData} layout="vertical" margin={{ top: 8, right: 16, left: 20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                <XAxis type="number" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="name" fontSize={11} tickLine={false} axisLine={false} width={80} />
                <RTooltip />
                <Bar dataKey="value" fill={COLORS.customers} radius={[0, 2, 2, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      )}
    </div>
  );
}

interface ProfileDetailResp {
  profile: {
    id: number; role: string; companyName: string; dba: string | null; contactName: string | null;
    email: string | null; phone: string | null; website: string | null; address: string | null;
    city: string | null; state: string | null; zip: string | null; mcNumber: string | null;
    capacityTons: string | null; hourlyRate: string | null; equipmentTypes: string | null;
    paymentTerms: string | null; createdAt: string;
  };
  totals: { jobs: number; completed: number; gmv: number; brokerFee: number; providerEarned: number };
  jobs: Array<{
    id: number; status: string; paymentStatus: string; materialType: string;
    pickupAddress: string; deliveryAddress: string; scheduledDate: string; completedAt: string | null;
    gmv: number; brokerFee: number; providerNet: number; otherName: string | null; createdAt: string;
  }>;
}

const money2 = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n || 0);

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="border rounded-none p-3">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-lg font-bold tabular-nums">{value}</div>
    </div>
  );
}

function Field({ icon, label, value }: { icon?: React.ReactNode; label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2 text-sm">
      {icon ? <span className="text-muted-foreground mt-0.5">{icon}</span> : null}
      <span className="text-muted-foreground w-24 shrink-0">{label}</span>
      <span className="font-medium break-all">{value}</span>
    </div>
  );
}

function PersonDetail({ id, onClose }: { id: number | null; onClose: () => void }) {
  const detail = useQuery({
    queryKey: ["admin-profile", id],
    queryFn: () => apiFetch<ProfileDetailResp>(`/admin/profile/${id}`),
    enabled: id !== null,
  });
  const d = detail.data;
  const p = d?.profile;
  const isProvider = p?.role === "provider";

  return (
    <Dialog open={id !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl rounded-none max-h-[88vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            {p?.companyName ?? (detail.isLoading ? "Loading…" : "Details")}
            {p?.role ? <Badge variant="outline" className="rounded-none capitalize">{p.role}</Badge> : null}
          </DialogTitle>
          <DialogDescription>{p?.dba ? `DBA: ${p.dba}` : "Full profile and job history."}</DialogDescription>
        </DialogHeader>

        <div className="overflow-auto flex-1 space-y-5 -mx-1 px-1">
          {detail.isLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading details…</div>
          ) : !d ? (
            <div className="text-sm text-muted-foreground py-8 text-center">Couldn't load this profile.</div>
          ) : (
            <>
              {/* Totals */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Stat label="Total jobs" value={d.totals.jobs} />
                <Stat label="Completed" value={d.totals.completed} />
                <Stat label="Lifetime GMV" value={money2(d.totals.gmv)} />
                {isProvider
                  ? <Stat label="Carrier earned" value={money2(d.totals.providerEarned)} />
                  : <Stat label="Broker fees" value={money2(d.totals.brokerFee)} />}
              </div>

              {/* Contact + company info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2 border rounded-none p-4">
                <Field icon={<Users className="w-4 h-4" />} label="Contact" value={p?.contactName} />
                <Field icon={<Mail className="w-4 h-4" />} label="Email" value={p?.email} />
                <Field icon={<Phone className="w-4 h-4" />} label="Phone" value={p?.phone} />
                <Field icon={<Globe className="w-4 h-4" />} label="Website" value={p?.website} />
                <Field icon={<MapPin className="w-4 h-4" />} label="Address" value={[p?.address, loc(p?.city, p?.state), p?.zip].filter(Boolean).join(", ") || null} />
                <Field label="MC #" value={p?.mcNumber} />
                {isProvider ? <Field label="Capacity" value={p?.capacityTons ? `${p.capacityTons} tons` : null} /> : null}
                {isProvider ? <Field label="Hourly rate" value={p?.hourlyRate ? money2(Number(p.hourlyRate)) + "/hr" : null} /> : null}
                {isProvider ? <Field label="Equipment" value={p?.equipmentTypes} /> : null}
                <Field label="Payment terms" value={p?.paymentTerms} />
                <Field label="Joined" value={p?.createdAt ? dateFmt(p.createdAt) : null} />
              </div>

              {/* Job history */}
              <div>
                <div className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Job history ({d.jobs.length})
                </div>
                {d.jobs.length === 0 ? (
                  <div className="text-sm text-muted-foreground py-4 text-center border rounded-none">No jobs yet.</div>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="text-xs uppercase text-muted-foreground border-b">
                      <tr><th className="text-left py-2">Job</th><th className="text-left">{isProvider ? "Customer" : "Carrier"}</th><th className="text-left">Route</th><th className="text-right">GMV</th><th className="text-left pl-3">Status</th></tr>
                    </thead>
                    <tbody>
                      {d.jobs.map((j) => (
                        <tr key={j.id} className="border-b last:border-0">
                          <td className="py-2 font-medium">#{j.id}<div className="text-xs text-muted-foreground capitalize">{j.materialType}</div></td>
                          <td>{j.otherName ?? "—"}</td>
                          <td className="text-xs max-w-[200px]"><div className="truncate" title={j.pickupAddress}>↑ {j.pickupAddress}</div><div className="truncate" title={j.deliveryAddress}>↓ {j.deliveryAddress}</div></td>
                          <td className="text-right tabular-nums">{money2(j.gmv)}</td>
                          <td className="pl-3"><Badge variant="outline" className="rounded-none capitalize">{String(j.status).replace(/_/g, " ")}</Badge></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

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
      <AdminCharts enabled={enabled} overview={d} />
      <Section title="Money">
        <MetricCard accent icon={<DollarSign className="w-3.5 h-3.5" />} label="GMV (billed)" value={money(d.gmv)} hint="Total customer-billed" onClick={() => setDrill({ kind: "jobs", status: "", title: "All jobs (GMV)" })} />
        <MetricCard accent icon={<TrendingUp className="w-3.5 h-3.5" />} label="Broker-fee revenue" value={money(d.brokerFees)} hint="15% platform fee on all jobs" onClick={() => setDrill({ kind: "jobs", status: "", title: "All jobs (broker fees)" })} />
        <MetricCard accent icon={<Banknote className="w-3.5 h-3.5" />} label="Profit realised" value={money(d.realisedProfit)} hint="Broker fees on paid-out jobs" onClick={() => setDrill({ kind: "jobs", status: "completed", title: "Completed jobs" })} />
        <MetricCard icon={<Activity className="w-3.5 h-3.5" />} label="Avg job value" value={money(d.avgJobValue)} hint="GMV ÃÂ· total jobs" />
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
