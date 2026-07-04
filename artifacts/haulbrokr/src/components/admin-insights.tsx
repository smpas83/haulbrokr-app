import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/apiFetch";
import {
  getGetAdminOverviewQueryKey,
  useReviewProviderComplianceDocument,
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DollarSign,
  TrendingUp,
  Banknote,
  Briefcase,
  Activity,
  PackageCheck,
  ClipboardList,
  FileStack,
  XCircle,
  Truck,
  Users,
  UserCog,
  HardHat,
  MapPin,
  ArrowRight,
  Search,
  ChevronRight,
  Building2,
  Phone,
  Mail,
  Globe,
  Loader2,
  Download,
  CalendarRange,
  ShieldCheck,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
  Legend,
} from "recharts";

// Types returned by the expanded /admin endpoints ──────────────────────────
export interface AdminOverviewV2 {
  gmv: number;
  brokerFees: number;
  realisedProfit: number;
  realisedGmv: number;
  avgJobValue: number;
  requestsPosted: number;
  openRequests: number;
  totalJobs: number;
  acceptedJobs: number;
  activeJobs: number;
  inProgressJobs: number;
  completedJobs: number;
  cancelledJobs: number;
  newCarriers: number;
  newCustomers: number;
  drivers: number;
  supervisors: number;
  stuckPayouts: number;
  pendingCompliance: number;
  pendingCredit: number;
  openBinOrders: number;
  documentsPending: number;
  documentsExpired: number;
}
interface JobRow {
  id: number;
  status: string;
  paymentStatus: string;
  materialType: string;
  truckType: string;
  pickupAddress: string;
  deliveryAddress: string;
  scheduledDate: string;
  gmv: number;
  brokerFee: number;
  providerNet: number;
  customerId: number;
  providerId: number;
  customerName: string | null;
  customerCity: string | null;
  customerState: string | null;
  providerName: string | null;
  providerCity: string | null;
  providerState: string | null;
  createdAt: string;
}
interface RequestRow {
  id: number;
  status: string;
  materialType: string;
  truckType: string;
  quantityTons: string;
  pickupAddress: string;
  deliveryAddress: string;
  budgetPerHour: string | null;
  scheduledDate: string;
  trucksNeeded: number;
  customerId: number;
  customerName: string | null;
  customerCity: string | null;
  customerState: string | null;
  createdAt: string;
}
interface PersonRow {
  id: number;
  role: string;
  companyName: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  mcNumber: string | null;
  createdAt: string;
}
interface DocRow {
  id: number;
  profileId: number;
  docType: string;
  status: string;
  fileName: string | null;
  objectPath: string | null;
  docNumber: string | null;
  expiry: string | null;
  reviewNote: string | null;
  uploadedAt: string | null;
  verifiedAt: string | null;
  updatedAt: string | null;
  companyName: string | null;
  contactName: string | null;
  email: string | null;
  role: string | null;
  city: string | null;
  state: string | null;
}

const money = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n || 0);
const loc = (city?: string | null, state?: string | null) =>
  [city, state].filter(Boolean).join(", ") || "—";
// CSV export helpers — turn an array of flat row objects into a downloadable file.
function toCSV(rows: Record<string, any>[]): string {
  if (!rows.length) return "";
  const set = new Set<string>();
  for (const r of rows) {
    for (const k of Object.keys(r)) set.add(k);
  }
  const cols = Array.from(set);
  const esc = (v: any) => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  return [
    cols.join(","),
    ...rows.map((r) => cols.map((c) => esc(r[c])).join(",")),
  ].join("\n");
}
function downloadCSV(filename: string, rows: Record<string, any>[]) {
  const blob = new Blob([toCSV(rows)], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const dateFmt = (s?: string) =>
  s
    ? new Date(s).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "—";

// Document presentation helpers ─────────────────────────────────────────────
const DOC_LABELS: Record<string, string> = {
  w9: "W-9",
  coi: "Insurance (COI)",
  dot_authority: "DOT authority",
  dot_medical_card: "DOT medical card",
  mc_authority: "MC authority",
  cdl_front: "CDL (front)",
  cdl_back: "CDL (back)",
  dl_front: "Driver license (front)",
  dl_back: "Driver license (back)",
  drug_test: "Drug test",
  mvr: "MVR",
  ssn_card: "SSN card",
  background_check: "Background check",
  twic: "TWIC",
  business_license: "Business license",
  vehicle_registration: "Vehicle registration",
  equipment_list: "Equipment list",
  signed_carrier_agreement: "Carrier agreement",
  voided_check: "Voided check",
  ach_authorization: "ACH authorization",
  safety_rating: "Safety rating",
  bond: "Bond",
  cos: "Certificate of Status (COS)",
  po_template: "PO template",
  tax_exempt_certificate: "Tax-exempt certificate",
};
const docLabel = (t: string) =>
  DOC_LABELS[t] ??
  t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

function formatDocStatus(status: string): string {
  if (status === "uploaded" || status === "pending") return "Pending review";
  if (status === "verified" || status === "approved") return "Approved";
  if (status === "rejected") return "Rejected";
  if (status === "missing" || status === "not_submitted") return "Missing";
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// objectPath is stored as "/objects/<...>"; the server streams it from
// /api/storage/objects/<...> with the same BASE_URL prefix apiFetch uses.
function docHref(objectPath: string | null): string | null {
  if (!objectPath) return null;
  const base = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
  const rel = objectPath.replace(/^\/objects\//, "");
  return `${base}/api/storage/objects/${rel}`;
}

const isExpired = (expiry: string | null) =>
  !!expiry && new Date(expiry).getTime() < Date.now();

function DocStatusBadge({
  status,
  expiry,
}: {
  status: string;
  expiry?: string | null;
}) {
  if (isExpired(expiry ?? null) && status === "verified") {
    return (
      <Badge
        variant="outline"
        className="rounded-none border-amber-500 text-amber-600"
      >
        Expired
      </Badge>
    );
  }
  const map: Record<string, string> = {
    verified: "border-green-600 text-green-700",
    uploaded: "border-blue-500 text-blue-600",
    rejected: "border-red-500 text-red-600",
    missing: "border-muted-foreground/40 text-muted-foreground",
  };
  const cls = map[status] ?? "border-muted-foreground/40 text-muted-foreground";
  return (
    <Badge variant="outline" className={`rounded-none ${cls}`}>
      {formatDocStatus(status)}
    </Badge>
  );
}

type Drill =
  | { kind: "jobs"; status: string; title: string }
  | { kind: "requests"; status: string; title: string }
  | { kind: "people"; role: string; title: string }
  | { kind: "documents"; status: string; docType?: string; title: string }
  | null;

// ── Clickable metric card ────────────────────────────────────────────────────
function MetricCard({
  icon,
  label,
  value,
  hint,
  accent,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  hint?: string;
  accent?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`text-left rounded-none border p-4 transition-colors w-full ${
        onClick
          ? "hover:border-primary hover:bg-muted/40 cursor-pointer"
          : "cursor-default"
      } ${accent ? "border-primary/40 bg-primary/5" : ""}`}
    >
      <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wider">
        {icon}
        {label}
      </div>
      <div className="mt-2 text-2xl font-bold tabular-nums">{value}</div>
      <div className="mt-1 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{hint ?? ""}</span>
        {onClick ? (
          <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
        ) : null}
      </div>
    </button>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
        {title}
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {children}
      </div>
    </div>
  );
}

function invalidateAdminDashboardQueries(
  qc: ReturnType<typeof useQueryClient>,
) {
  qc.invalidateQueries({ queryKey: getGetAdminOverviewQueryKey() });
  qc.invalidateQueries({ queryKey: ["admin-documents"] });
  qc.invalidateQueries({ queryKey: ["admin-profile"] });
}

function DocReviewButtons({
  profileId,
  docType,
  status,
  onDone,
}: {
  profileId: number;
  docType: string;
  status: string;
  onDone?: () => void;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const review = useReviewProviderComplianceDocument();

  if (status !== "uploaded") return null;

  const act = (action: "approve" | "reject") => {
    review.mutate(
      { profileId, docType, data: { action } },
      {
        onSuccess: () => {
          invalidateAdminDashboardQueries(qc);
          toast({
            title:
              action === "approve"
                ? `${docLabel(docType)} approved`
                : `${docLabel(docType)} rejected`,
          });
          onDone?.();
        },
        onError: () =>
          toast({ title: "Action failed", variant: "destructive" }),
      },
    );
  };

  return (
    <div
      className="flex items-center gap-1"
      onClick={(e) => e.stopPropagation()}
    >
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-7 rounded-none text-xs"
        disabled={review.isPending}
        onClick={() => act("approve")}
      >
        <ShieldCheck className="w-3 h-3 mr-1" /> Approve
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-7 rounded-none text-xs text-destructive"
        disabled={review.isPending}
        onClick={() => act("reject")}
      >
        <XCircle className="w-3 h-3 mr-1" /> Reject
      </Button>
    </div>
  );
}

// ── Drill-down dialog ────────────────────────────────────────────────────────
function DrillDialog({
  drill,
  onClose,
}: {
  drill: Drill;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const [selectedPersonId, setSelectedPersonId] = useState<number | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null);
  const open = !!drill;

  const jobs = useQuery({
    queryKey: [
      "admin-jobs",
      drill && "kind" in drill ? (drill as any).status : "",
    ],
    queryFn: () =>
      apiFetch<JobRow[]>(
        `/admin/jobs?status=${encodeURIComponent((drill as any).status)}`,
      ),
    enabled: open && drill?.kind === "jobs",
  });
  const requests = useQuery({
    queryKey: [
      "admin-requests",
      drill && drill.kind === "requests" ? drill.status : "",
    ],
    queryFn: () =>
      apiFetch<RequestRow[]>(
        `/admin/requests?status=${encodeURIComponent((drill as any).status)}`,
      ),
    enabled: open && drill?.kind === "requests",
  });
  const people = useQuery({
    queryKey: [
      "admin-people",
      drill && drill.kind === "people" ? drill.role : "",
    ],
    queryFn: () =>
      apiFetch<PersonRow[]>(
        `/admin/people?role=${encodeURIComponent((drill as any).role)}`,
      ),
    enabled: open && drill?.kind === "people",
  });
  const documents = useQuery({
    queryKey: [
      "admin-documents",
      drill && drill.kind === "documents"
        ? `${drill.status}|${drill.docType ?? ""}`
        : "",
    ],
    queryFn: () =>
      apiFetch<DocRow[]>(
        `/admin/documents?status=${encodeURIComponent((drill as any).status)}&type=${encodeURIComponent((drill as any).docType ?? "")}`,
      ),
    enabled: open && drill?.kind === "documents",
  });

  const loading =
    jobs.isLoading ||
    requests.isLoading ||
    people.isLoading ||
    documents.isLoading;
  const ql = q.trim().toLowerCase();
  const match = (...vals: (string | null | undefined)[]) =>
    !ql ||
    vals.filter(Boolean).some((v) => String(v).toLowerCase().includes(ql));

  const activeRows: Record<string, any>[] =
    drill?.kind === "jobs"
      ? (jobs.data ?? []).filter((r) =>
          match(
            r.customerName,
            r.providerName,
            r.materialType,
            r.pickupAddress,
            r.deliveryAddress,
          ),
        )
      : drill?.kind === "requests"
        ? (requests.data ?? []).filter((r) =>
            match(
              r.customerName,
              r.materialType,
              r.pickupAddress,
              r.deliveryAddress,
            ),
          )
        : drill?.kind === "people"
          ? (people.data ?? []).filter((r) =>
              match(r.companyName, r.contactName, r.email, r.city),
            )
          : drill?.kind === "documents"
            ? (documents.data ?? [])
                .filter((r) =>
                  match(
                    r.companyName,
                    r.contactName,
                    r.email,
                    r.docType,
                    r.fileName,
                  ),
                )
                .map((r) => ({
                  id: r.id,
                  company: r.companyName,
                  role: r.role,
                  document: docLabel(r.docType),
                  status: r.status,
                  fileName: r.fileName,
                  docNumber: r.docNumber,
                  expiry: r.expiry ? dateFmt(r.expiry) : "",
                  updated: r.updatedAt ? dateFmt(r.updatedAt) : "",
                }))
            : [];

  const handleExport = () => {
    const stamp = new Date().toISOString().slice(0, 10);
    const base = (drill?.title ?? "export")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    downloadCSV(`haulbrokr-${base}-${stamp}.csv`, activeRows);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl rounded-none max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <DialogTitle>{drill?.title}</DialogTitle>
              <DialogDescription>
                {loading
                  ? "Loading…"
                  : `${activeRows.length} record${activeRows.length === 1 ? "" : "s"} · live from your database`}
              </DialogDescription>
            </div>
            <button
              type="button"
              onClick={handleExport}
              disabled={loading || activeRows.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs border rounded-none hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
            >
              <Download className="w-3.5 h-3.5" /> Export CSV
            </button>
          </div>
        </DialogHeader>
        <div className="relative mb-2">
          <Search className="w-4 h-4 absolute left-2 top-2.5 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name, location, material…"
            className="pl-8 rounded-none"
          />
        </div>
        <div className="overflow-auto flex-1 -mx-1 px-1">
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : drill?.kind === "jobs" ? (
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-muted-foreground border-b">
                <tr>
                  <th className="text-left py-2">Job</th>
                  <th className="text-left">Customer</th>
                  <th className="text-left">Carrier</th>
                  <th className="text-left">Route</th>
                  <th className="text-right">GMV</th>
                  <th className="text-right">Broker fee</th>
                  <th className="text-left pl-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {(jobs.data ?? [])
                  .filter((r) =>
                    match(
                      r.customerName,
                      r.providerName,
                      r.materialType,
                      r.pickupAddress,
                      r.deliveryAddress,
                    ),
                  )
                  .map((r) => (
                    <tr
                      key={r.id}
                      onClick={() => setSelectedJobId(r.id)}
                      className="border-b last:border-0 hover:bg-muted/60 cursor-pointer"
                    >
                      <td className="py-2 font-medium">
                        #{r.id}
                        <div className="text-xs text-muted-foreground capitalize">
                          {r.materialType} ·{" "}
                          {String(r.truckType).replace(/_/g, " ")}
                        </div>
                      </td>
                      <td>
                        <div>{r.customerName ?? "—"}</div>
                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {loc(r.customerCity, r.customerState)}
                        </div>
                      </td>
                      <td>
                        <div>{r.providerName ?? "—"}</div>
                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {loc(r.providerCity, r.providerState)}
                        </div>
                      </td>
                      <td className="text-xs max-w-[200px]">
                        <div className="truncate" title={r.pickupAddress}>
                          ↑ {r.pickupAddress}
                        </div>
                        <div className="truncate" title={r.deliveryAddress}>
                          ↓ {r.deliveryAddress}
                        </div>
                      </td>
                      <td className="text-right tabular-nums">
                        {money(r.gmv)}
                      </td>
                      <td className="text-right tabular-nums text-primary font-medium">
                        {money(r.brokerFee)}
                      </td>
                      <td className="pl-3">
                        <Badge
                          variant="outline"
                          className="rounded-none capitalize"
                        >
                          {String(r.status).replace(/_/g, " ")}
                        </Badge>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          ) : drill?.kind === "requests" ? (
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-muted-foreground border-b">
                <tr>
                  <th className="text-left py-2">Post</th>
                  <th className="text-left">Customer</th>
                  <th className="text-left">Route</th>
                  <th className="text-right">Budget/hr</th>
                  <th className="text-left pl-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {(requests.data ?? [])
                  .filter((r) =>
                    match(
                      r.customerName,
                      r.materialType,
                      r.pickupAddress,
                      r.deliveryAddress,
                    ),
                  )
                  .map((r) => (
                    <tr
                      key={r.id}
                      className="border-b last:border-0 hover:bg-muted/40"
                    >
                      <td className="py-2 font-medium">
                        #{r.id}
                        <div className="text-xs text-muted-foreground capitalize">
                          {r.materialType} · {r.quantityTons} tons ·{" "}
                          {r.trucksNeeded} trucks
                        </div>
                      </td>
                      <td>
                        <div>{r.customerName ?? "—"}</div>
                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {loc(r.customerCity, r.customerState)}
                        </div>
                      </td>
                      <td className="text-xs max-w-[220px]">
                        <div className="truncate" title={r.pickupAddress}>
                          ↑ {r.pickupAddress}
                        </div>
                        <div className="truncate" title={r.deliveryAddress}>
                          ↓ {r.deliveryAddress}
                        </div>
                      </td>
                      <td className="text-right tabular-nums">
                        {r.budgetPerHour ? money(Number(r.budgetPerHour)) : "—"}
                      </td>
                      <td className="pl-3">
                        <Badge
                          variant="outline"
                          className="rounded-none capitalize"
                        >
                          {String(r.status).replace(/_/g, " ")}
                        </Badge>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          ) : drill?.kind === "people" ? (
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-muted-foreground border-b">
                <tr>
                  <th className="text-left py-2">Company</th>
                  <th className="text-left">Contact</th>
                  <th className="text-left">Location</th>
                  <th className="text-left">Email</th>
                  <th className="text-left">Phone</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {(people.data ?? [])
                  .filter((r) =>
                    match(r.companyName, r.contactName, r.email, r.city),
                  )
                  .map((r) => (
                    <tr
                      key={r.id}
                      onClick={() => setSelectedPersonId(r.id)}
                      className="border-b last:border-0 hover:bg-muted/60 cursor-pointer"
                    >
                      <td className="py-2 font-medium">
                        {r.companyName}
                        {r.mcNumber ? (
                          <div className="text-xs text-muted-foreground">
                            MC# {r.mcNumber}
                          </div>
                        ) : null}
                      </td>
                      <td>{r.contactName ?? "—"}</td>
                      <td>
                        <div className="text-xs flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {loc(r.city, r.state)}
                        </div>
                      </td>
                      <td className="text-xs">{r.email ?? "—"}</td>
                      <td className="text-xs">{r.phone ?? "—"}</td>
                      <td className="text-right pr-1">
                        <ChevronRight className="w-4 h-4 text-muted-foreground inline" />
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          ) : drill?.kind === "documents" ? (
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-muted-foreground border-b">
                <tr>
                  <th className="text-left py-2">Document</th>
                  <th className="text-left">Company</th>
                  <th className="text-left">Expiry</th>
                  <th className="text-left pl-3">Status</th>
                  <th className="text-right pr-1">File</th>
                </tr>
              </thead>
              <tbody>
                {(documents.data ?? [])
                  .filter((r) =>
                    match(
                      r.companyName,
                      r.contactName,
                      r.email,
                      r.docType,
                      r.fileName,
                    ),
                  )
                  .map((r) => {
                    const href = docHref(r.objectPath);
                    return (
                      <tr
                        key={r.id}
                        className="border-b last:border-0 hover:bg-muted/60"
                      >
                        <td className="py-2 font-medium">
                          {docLabel(r.docType)}
                          {r.docNumber ? (
                            <div className="text-xs text-muted-foreground">
                              #{r.docNumber}
                            </div>
                          ) : null}
                        </td>
                        <td
                          onClick={() => setSelectedPersonId(r.profileId)}
                          className="cursor-pointer"
                        >
                          <div>{r.companyName ?? "—"}</div>
                          <div className="text-xs text-muted-foreground capitalize">
                            {r.role ?? ""}
                          </div>
                        </td>
                        <td
                          className={`text-xs ${isExpired(r.expiry) ? "text-amber-600 font-medium" : ""}`}
                        >
                          {r.expiry ? dateFmt(r.expiry) : "—"}
                        </td>
                        <td className="pl-3">
                          <div className="flex flex-col gap-1.5">
                            <DocStatusBadge
                              status={r.status}
                              expiry={r.expiry}
                            />
                            <DocReviewButtons
                              profileId={r.profileId}
                              docType={r.docType}
                              status={r.status}
                              onDone={() => documents.refetch()}
                            />
                          </div>
                        </td>
                        <td className="text-right pr-1">
                          {href ? (
                            <a
                              href={href}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-primary hover:underline text-xs"
                            >
                              <FileStack className="w-3.5 h-3.5" /> View
                            </a>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              —
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          ) : null}
        </div>
        <PersonDetail
          id={selectedPersonId}
          onClose={() => setSelectedPersonId(null)}
        />
        <JobDetail id={selectedJobId} onClose={() => setSelectedJobId(null)} />
      </DialogContent>
    </Dialog>
  );
}

// ── Main insights dashboard ──────────────────────────────────────────────────
interface TimeseriesPoint {
  bucket: string;
  label: string;
  jobs: number;
  gmv: number;
  brokerFees: number;
  completed: number;
  customers: number;
  providers: number;
  drivers: number;
}
interface TimeseriesResp {
  months: number;
  series: TimeseriesPoint[];
}

const COLORS = {
  gmv: "#2563eb",
  broker: "#16a34a",
  jobs: "#f59e0b",
  completed: "#0ea5e9",
  customers: "#6366f1",
  providers: "#ef4444",
  drivers: "#a855f7",
};
const STATUS_COLORS = ["#16a34a", "#f59e0b", "#0ea5e9", "#ef4444", "#94a3b8"];

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="rounded-none">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </CardTitle>
        {subtitle ? (
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        ) : null}
      </CardHeader>
      <CardContent className="h-64">{children}</CardContent>
    </Card>
  );
}

function AdminCharts({
  enabled,
  overview,
}: {
  enabled: boolean;
  overview: AdminOverviewV2;
}) {
  const [months, setMonths] = useState(6);
  const [custom, setCustom] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const customActive = custom && !!from && !!to && from <= to;
  const tsUrl = customActive
    ? `/admin/timeseries?from=${from}&to=${to}`
    : `/admin/timeseries?months=${months}`;
  const ts = useQuery({
    queryKey: [
      "admin-timeseries",
      customActive ? `${from}_${to}` : `m${months}`,
    ],
    queryFn: () => apiFetch<TimeseriesResp>(tsUrl),
    enabled,
  });

  const series = ts.data?.series ?? [];
  const usd = (n: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(n || 0);

  const statusData = [
    {
      name: "Completed",
      value: overview.completedJobs,
      fill: STATUS_COLORS[0],
    },
    { name: "Accepted", value: overview.acceptedJobs, fill: STATUS_COLORS[1] },
    {
      name: "In progress",
      value: overview.inProgressJobs,
      fill: STATUS_COLORS[2],
    },
    {
      name: "Cancelled",
      value: overview.cancelledJobs,
      fill: STATUS_COLORS[3],
    },
  ].filter((s) => s.value > 0);

  const peopleData = [
    { name: "Customers", value: overview.newCustomers },
    { name: "Carriers", value: overview.newCarriers },
    { name: "Drivers", value: overview.drivers },
    { name: "Supervisors", value: overview.supervisors },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Trends
        </h2>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex gap-1">
            {[3, 6, 12].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setCustom(false);
                  setMonths(m);
                }}
                className={`px-3 py-1 text-xs border rounded-none ${!customActive && months === m ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted"}`}
              >
                {m}m
              </button>
            ))}
            <button
              type="button"
              onClick={() => setCustom((c) => !c)}
              className={`flex items-center gap-1 px-3 py-1 text-xs border rounded-none ${customActive ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted"}`}
            >
              <CalendarRange className="w-3.5 h-3.5" /> Custom
            </button>
          </div>
          {custom && (
            <div className="flex items-center gap-1 text-xs">
              <Input
                type="date"
                value={from}
                max={to || undefined}
                onChange={(e) => setFrom(e.target.value)}
                className="h-8 rounded-none w-[140px]"
              />
              <span className="text-muted-foreground">→</span>
              <Input
                type="date"
                value={to}
                min={from || undefined}
                onChange={(e) => setTo(e.target.value)}
                className="h-8 rounded-none w-[140px]"
              />
            </div>
          )}
        </div>
      </div>

      {ts.isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-64 w-full" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartCard
            title="Revenue over time"
            subtitle="GMV billed and your 15% broker fee per month"
          >
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={series}
                margin={{ top: 8, right: 8, left: -8, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="gGmv" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor={COLORS.gmv}
                      stopOpacity={0.4}
                    />
                    <stop offset="95%" stopColor={COLORS.gmv} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gBroker" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor={COLORS.broker}
                      stopOpacity={0.5}
                    />
                    <stop
                      offset="95%"
                      stopColor={COLORS.broker}
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="hsl(var(--border))"
                />
                <XAxis
                  dataKey="label"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) =>
                    "$" + (v >= 1000 ? (v / 1000).toFixed(0) + "k" : v)
                  }
                />
                <RTooltip
                  formatter={(v: number, n: string) => [
                    usd(v),
                    n === "gmv" ? "GMV" : "Broker fee",
                  ]}
                />
                <Legend
                  formatter={(v) => (v === "gmv" ? "GMV" : "Broker fee")}
                />
                <Area
                  type="monotone"
                  dataKey="gmv"
                  stroke={COLORS.gmv}
                  fill="url(#gGmv)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="brokerFees"
                  stroke={COLORS.broker}
                  fill="url(#gBroker)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard
            title="Jobs over time"
            subtitle="Jobs created vs hauls completed per month"
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={series}
                margin={{ top: 8, right: 8, left: -8, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="hsl(var(--border))"
                />
                <XAxis
                  dataKey="label"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <RTooltip />
                <Legend
                  formatter={(v) => (v === "jobs" ? "Created" : "Completed")}
                />
                <Bar dataKey="jobs" fill={COLORS.jobs} radius={[2, 2, 0, 0]} />
                <Bar
                  dataKey="completed"
                  fill={COLORS.completed}
                  radius={[2, 2, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard
            title="Job status mix"
            subtitle="Current distribution of all jobs"
          >
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  innerRadius={45}
                  paddingAngle={2}
                >
                  {statusData.map((e, i) => (
                    <Cell key={i} fill={e.fill} />
                  ))}
                </Pie>
                <RTooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard
            title="Network by role"
            subtitle="Accounts on the platform"
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={peopleData}
                layout="vertical"
                margin={{ top: 8, right: 16, left: 20, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="hsl(var(--border))"
                  horizontal={false}
                />
                <XAxis
                  type="number"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  width={80}
                />
                <RTooltip />
                <Bar
                  dataKey="value"
                  fill={COLORS.customers}
                  radius={[0, 2, 2, 0]}
                />
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
    id: number;
    role: string;
    companyName: string;
    dba: string | null;
    contactName: string | null;
    email: string | null;
    phone: string | null;
    website: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
    zip: string | null;
    mcNumber: string | null;
    capacityTons: string | null;
    hourlyRate: string | null;
    equipmentTypes: string | null;
    paymentTerms: string | null;
    createdAt: string;
  };
  totals: {
    jobs: number;
    completed: number;
    gmv: number;
    brokerFee: number;
    providerEarned: number;
  };
  jobs: Array<{
    id: number;
    status: string;
    paymentStatus: string;
    materialType: string;
    pickupAddress: string;
    deliveryAddress: string;
    scheduledDate: string;
    completedAt: string | null;
    gmv: number;
    brokerFee: number;
    providerNet: number;
    otherName: string | null;
    createdAt: string;
  }>;
  documents: Array<{
    id: number;
    docType: string;
    status: string;
    fileName: string | null;
    objectPath: string | null;
    docNumber: string | null;
    expiry: string | null;
    reviewNote: string | null;
    uploadedAt: string | null;
    verifiedAt: string | null;
    updatedAt: string | null;
  }>;
}

const money2 = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n || 0);

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="border rounded-none p-3">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="text-lg font-bold tabular-nums">{value}</div>
    </div>
  );
}

function Field({
  icon,
  label,
  value,
}: {
  icon?: React.ReactNode;
  label: string;
  value?: string | null;
}) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2 text-sm">
      {icon ? (
        <span className="text-muted-foreground mt-0.5">{icon}</span>
      ) : null}
      <span className="text-muted-foreground w-24 shrink-0">{label}</span>
      <span className="font-medium break-all">{value}</span>
    </div>
  );
}

function PersonDetail({
  id,
  onClose,
}: {
  id: number | null;
  onClose: () => void;
}) {
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
            {p?.role ? (
              <Badge variant="outline" className="rounded-none capitalize">
                {p.role}
              </Badge>
            ) : null}
          </DialogTitle>
          <DialogDescription>
            {p?.dba ? `DBA: ${p.dba}` : "Full profile and job history."}
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-auto flex-1 space-y-5 -mx-1 px-1">
          {detail.isLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading details…
            </div>
          ) : !d ? (
            <div className="text-sm text-muted-foreground py-8 text-center">
              Couldn't load this profile.
            </div>
          ) : (
            <>
              {/* Totals */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Stat label="Total jobs" value={d.totals.jobs} />
                <Stat label="Completed" value={d.totals.completed} />
                <Stat label="Lifetime GMV" value={money2(d.totals.gmv)} />
                {isProvider ? (
                  <Stat
                    label="Carrier earned"
                    value={money2(d.totals.providerEarned)}
                  />
                ) : (
                  <Stat
                    label="Broker fees"
                    value={money2(d.totals.brokerFee)}
                  />
                )}
              </div>

              {/* Contact + company info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2 border rounded-none p-4">
                <Field
                  icon={<Users className="w-4 h-4" />}
                  label="Contact"
                  value={p?.contactName}
                />
                <Field
                  icon={<Mail className="w-4 h-4" />}
                  label="Email"
                  value={p?.email}
                />
                <Field
                  icon={<Phone className="w-4 h-4" />}
                  label="Phone"
                  value={p?.phone}
                />
                <Field
                  icon={<Globe className="w-4 h-4" />}
                  label="Website"
                  value={p?.website}
                />
                <Field
                  icon={<MapPin className="w-4 h-4" />}
                  label="Address"
                  value={
                    [p?.address, loc(p?.city, p?.state), p?.zip]
                      .filter(Boolean)
                      .join(", ") || null
                  }
                />
                <Field label="MC #" value={p?.mcNumber} />
                {isProvider ? (
                  <Field
                    label="Capacity"
                    value={p?.capacityTons ? `${p.capacityTons} tons` : null}
                  />
                ) : null}
                {isProvider ? (
                  <Field
                    label="Hourly rate"
                    value={
                      p?.hourlyRate
                        ? money2(Number(p.hourlyRate)) + "/hr"
                        : null
                    }
                  />
                ) : null}
                {isProvider ? (
                  <Field label="Equipment" value={p?.equipmentTypes} />
                ) : null}
                <Field label="Payment terms" value={p?.paymentTerms} />
                <Field
                  label="Joined"
                  value={p?.createdAt ? dateFmt(p.createdAt) : null}
                />
              </div>

              {/* Job history */}
              <div>
                <div className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Job history ({d.jobs.length})
                </div>
                {d.jobs.length === 0 ? (
                  <div className="text-sm text-muted-foreground py-4 text-center border rounded-none">
                    No jobs yet.
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="text-xs uppercase text-muted-foreground border-b">
                      <tr>
                        <th className="text-left py-2">Job</th>
                        <th className="text-left">
                          {isProvider ? "Customer" : "Carrier"}
                        </th>
                        <th className="text-left">Route</th>
                        <th className="text-right">GMV</th>
                        <th className="text-left pl-3">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {d.jobs.map((j) => (
                        <tr key={j.id} className="border-b last:border-0">
                          <td className="py-2 font-medium">
                            #{j.id}
                            <div className="text-xs text-muted-foreground capitalize">
                              {j.materialType}
                            </div>
                          </td>
                          <td>{j.otherName ?? "—"}</td>
                          <td className="text-xs max-w-[200px]">
                            <div className="truncate" title={j.pickupAddress}>
                              ↑ {j.pickupAddress}
                            </div>
                            <div className="truncate" title={j.deliveryAddress}>
                              ↓ {j.deliveryAddress}
                            </div>
                          </td>
                          <td className="text-right tabular-nums">
                            {money2(j.gmv)}
                          </td>
                          <td className="pl-3">
                            <Badge
                              variant="outline"
                              className="rounded-none capitalize"
                            >
                              {String(j.status).replace(/_/g, " ")}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
              {/* Compliance documents */}
              <div>
                <div className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Documents ({(d.documents ?? []).length})
                </div>
                {(d.documents ?? []).length === 0 ? (
                  <div className="text-sm text-muted-foreground py-4 text-center border rounded-none">
                    No documents uploaded.
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="text-xs uppercase text-muted-foreground border-b">
                      <tr>
                        <th className="text-left py-2">Document</th>
                        <th className="text-left">Expiry</th>
                        <th className="text-left pl-3">Status</th>
                        <th className="text-right pr-1">File</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(d.documents ?? []).map((doc) => {
                        const href = docHref(doc.objectPath);
                        return (
                          <tr key={doc.id} className="border-b last:border-0">
                            <td className="py-2 font-medium">
                              {docLabel(doc.docType)}
                              {doc.docNumber ? (
                                <div className="text-xs text-muted-foreground">
                                  #{doc.docNumber}
                                </div>
                              ) : null}
                              {doc.reviewNote ? (
                                <div className="text-xs text-muted-foreground italic">
                                  {doc.reviewNote}
                                </div>
                              ) : null}
                            </td>
                            <td
                              className={`text-xs ${isExpired(doc.expiry) ? "text-amber-600 font-medium" : ""}`}
                            >
                              {doc.expiry ? dateFmt(doc.expiry) : "—"}
                            </td>
                            <td className="pl-3">
                              <div className="flex flex-col gap-1.5">
                                <DocStatusBadge
                                  status={doc.status}
                                  expiry={doc.expiry}
                                />
                                {id !== null ? (
                                  <DocReviewButtons
                                    profileId={id}
                                    docType={doc.docType}
                                    status={doc.status}
                                    onDone={() => detail.refetch()}
                                  />
                                ) : null}
                              </div>
                            </td>
                            <td className="text-right pr-1">
                              {href ? (
                                <a
                                  href={href}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 text-primary hover:underline text-xs"
                                >
                                  <FileStack className="w-3.5 h-3.5" /> View
                                </a>
                              ) : (
                                <span className="text-xs text-muted-foreground">
                                  —
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
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

interface JobDetailResp {
  id: number;
  status: string;
  paymentStatus: string;
  materialType: string;
  truckType: string;
  pickupAddress: string;
  deliveryAddress: string;
  scheduledDate: string;
  completedAt: string | null;
  gmv: number;
  brokerFee: number;
  providerNet: number;
  createdAt: string;
  customerId: number;
  providerId: number;
  customerName: string | null;
  customerContact: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  customerCity: string | null;
  customerState: string | null;
  providerName: string | null;
  providerContact: string | null;
  providerEmail: string | null;
  providerPhone: string | null;
  providerCity: string | null;
  providerState: string | null;
}

function PartyCard({
  title,
  name,
  contact,
  email,
  phone,
  city,
  state,
}: {
  title: string;
  name: string | null;
  contact: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
}) {
  return (
    <div className="border rounded-none p-4 space-y-1">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
        {title}
      </div>
      <div className="font-semibold">{name ?? "—"}</div>
      {contact ? <div className="text-sm">{contact}</div> : null}
      <div className="text-xs text-muted-foreground flex items-center gap-1">
        <MapPin className="w-3 h-3" />
        {loc(city, state)}
      </div>
      {email ? (
        <div className="text-xs flex items-center gap-1">
          <Mail className="w-3 h-3" />
          {email}
        </div>
      ) : null}
      {phone ? (
        <div className="text-xs flex items-center gap-1">
          <Phone className="w-3 h-3" />
          {phone}
        </div>
      ) : null}
    </div>
  );
}

function JobDetail({
  id,
  onClose,
}: {
  id: number | null;
  onClose: () => void;
}) {
  const detail = useQuery({
    queryKey: ["admin-job", id],
    queryFn: () => apiFetch<JobDetailResp>(`/admin/job/${id}`),
    enabled: id !== null,
  });
  const j = detail.data;
  const usd = (n: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(n || 0);

  return (
    <Dialog open={id !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl rounded-none max-h-[88vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Briefcase className="w-5 h-5" />
            {j ? `Job #${j.id}` : detail.isLoading ? "Loading…" : "Job"}
            {j?.status ? (
              <Badge variant="outline" className="rounded-none capitalize">
                {String(j.status).replace(/_/g, " ")}
              </Badge>
            ) : null}
          </DialogTitle>
          <DialogDescription>
            {j
              ? `${j.materialType} · ${String(j.truckType).replace(/_/g, " ")}`
              : "Full job details."}
          </DialogDescription>
        </DialogHeader>

        {detail.isLoading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading job…
          </div>
        ) : !j ? (
          <div className="text-sm text-muted-foreground py-8 text-center">
            Couldn't load this job.
          </div>
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-3 gap-3">
              <div className="border rounded-none p-3">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  GMV
                </div>
                <div className="text-lg font-bold tabular-nums">
                  {usd(j.gmv)}
                </div>
              </div>
              <div className="border rounded-none p-3">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Broker fee
                </div>
                <div className="text-lg font-bold tabular-nums text-primary">
                  {usd(j.brokerFee)}
                </div>
              </div>
              <div className="border rounded-none p-3">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Carrier net
                </div>
                <div className="text-lg font-bold tabular-nums">
                  {usd(j.providerNet)}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <PartyCard
                title="Customer"
                name={j.customerName}
                contact={j.customerContact}
                email={j.customerEmail}
                phone={j.customerPhone}
                city={j.customerCity}
                state={j.customerState}
              />
              <PartyCard
                title="Carrier"
                name={j.providerName}
                contact={j.providerContact}
                email={j.providerEmail}
                phone={j.providerPhone}
                city={j.providerCity}
                state={j.providerState}
              />
            </div>

            <div className="border rounded-none p-4 space-y-2">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Route
              </div>
              <div className="text-sm flex items-start gap-2">
                <span className="text-muted-foreground">↑ Pickup</span>
                <span className="font-medium">{j.pickupAddress}</span>
              </div>
              <div className="text-sm flex items-start gap-2">
                <span className="text-muted-foreground">↓ Drop</span>
                <span className="font-medium">{j.deliveryAddress}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div>
                <div className="text-xs text-muted-foreground">Payment</div>
                <div className="font-medium capitalize">
                  {String(j.paymentStatus).replace(/_/g, " ")}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Scheduled</div>
                <div className="font-medium">{dateFmt(j.scheduledDate)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Completed</div>
                <div className="font-medium">
                  {j.completedAt ? dateFmt(j.completedAt) : "—"}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Created</div>
                <div className="font-medium">{dateFmt(j.createdAt)}</div>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function AdminInsights({ enabled }: { enabled: boolean }) {
  const [drill, setDrill] = useState<Drill>(null);
  const overview = useQuery({
    queryKey: getGetAdminOverviewQueryKey(),
    queryFn: () => apiFetch<AdminOverviewV2>("/admin/overview"),
    enabled,
  });

  if (overview.isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full" />
        ))}
      </div>
    );
  }
  const d = overview.data;
  if (!d)
    return (
      <div className="text-sm text-muted-foreground py-8 text-center">
        Couldn't load platform stats. Try refreshing.
      </div>
    );

  return (
    <div className="space-y-6">
      <Section title="Money">
        <MetricCard
          accent
          icon={<DollarSign className="w-3.5 h-3.5" />}
          label="GMV (billed)"
          value={money(d.gmv)}
          hint="Total customer-billed"
          onClick={() =>
            setDrill({ kind: "jobs", status: "", title: "All jobs (GMV)" })
          }
        />
        <MetricCard
          accent
          icon={<TrendingUp className="w-3.5 h-3.5" />}
          label="Broker-fee revenue"
          value={money(d.brokerFees)}
          hint="15% platform fee on all jobs"
          onClick={() =>
            setDrill({
              kind: "jobs",
              status: "",
              title: "All jobs (broker fees)",
            })
          }
        />
        <MetricCard
          accent
          icon={<Banknote className="w-3.5 h-3.5" />}
          label="Profit realised"
          value={money(d.realisedProfit)}
          hint="Broker fees on paid-out jobs"
          onClick={() =>
            setDrill({
              kind: "jobs",
              status: "completed",
              title: "Completed jobs",
            })
          }
        />
        <MetricCard
          icon={<Activity className="w-3.5 h-3.5" />}
          label="Avg job value"
          value={money(d.avgJobValue)}
          hint="GMV · total jobs"
        />
      </Section>

      <Section title="Jobs funnel">
        <MetricCard
          icon={<ClipboardList className="w-3.5 h-3.5" />}
          label="Jobs posted"
          value={d.requestsPosted.toLocaleString()}
          hint={`${d.openRequests} still open`}
          onClick={() =>
            setDrill({
              kind: "requests",
              status: "",
              title: "Job posts (customer requests)",
            })
          }
        />
        <MetricCard
          icon={<FileStack className="w-3.5 h-3.5" />}
          label="Accepted"
          value={d.acceptedJobs.toLocaleString()}
          hint="Awarded + accepted"
          onClick={() =>
            setDrill({
              kind: "jobs",
              status: "accepted",
              title: "Accepted jobs",
            })
          }
        />
        <MetricCard
          icon={<Briefcase className="w-3.5 h-3.5" />}
          label="In progress"
          value={d.inProgressJobs.toLocaleString()}
          hint="Active hauls now"
          onClick={() =>
            setDrill({
              kind: "jobs",
              status: "in_progress",
              title: "In-progress jobs",
            })
          }
        />
        <MetricCard
          icon={<PackageCheck className="w-3.5 h-3.5" />}
          label="Completed"
          value={d.completedJobs.toLocaleString()}
          hint="Finished hauls"
          onClick={() =>
            setDrill({
              kind: "jobs",
              status: "completed",
              title: "Completed jobs",
            })
          }
        />
      </Section>

      <Section title="People">
        <MetricCard
          icon={<Users className="w-3.5 h-3.5" />}
          label="Customers"
          value={d.newCustomers.toLocaleString()}
          hint="Customer accounts"
          onClick={() =>
            setDrill({ kind: "people", role: "customer", title: "Customers" })
          }
        />
        <MetricCard
          icon={<Truck className="w-3.5 h-3.5" />}
          label="Carriers (vendors)"
          value={d.newCarriers.toLocaleString()}
          hint="Provider accounts"
          onClick={() =>
            setDrill({
              kind: "people",
              role: "provider",
              title: "Carriers / vendors",
            })
          }
        />
        <MetricCard
          icon={<HardHat className="w-3.5 h-3.5" />}
          label="Drivers"
          value={d.drivers.toLocaleString()}
          hint="Driver accounts"
          onClick={() =>
            setDrill({ kind: "people", role: "driver", title: "Drivers" })
          }
        />
        <MetricCard
          icon={<UserCog className="w-3.5 h-3.5" />}
          label="Supervisors"
          value={d.supervisors.toLocaleString()}
          hint="Site supervisors"
          onClick={() =>
            setDrill({
              kind: "people",
              role: "supervisor",
              title: "Supervisors",
            })
          }
        />
      </Section>

      <Section title="Compliance documents">
        <MetricCard
          icon={<FileStack className="w-3.5 h-3.5" />}
          label="Pending review"
          value={(d.documentsPending ?? 0).toLocaleString()}
          hint="Uploaded, awaiting approval"
          onClick={() =>
            setDrill({
              kind: "documents",
              status: "uploaded",
              title: "Documents pending review",
            })
          }
        />
        <MetricCard
          icon={<XCircle className="w-3.5 h-3.5" />}
          label="Expired"
          value={(d.documentsExpired ?? 0).toLocaleString()}
          hint="Past expiry date"
          accent={(d.documentsExpired ?? 0) > 0}
          onClick={() =>
            setDrill({
              kind: "documents",
              status: "expired",
              title: "Expired documents",
            })
          }
        />
        <MetricCard
          icon={<PackageCheck className="w-3.5 h-3.5" />}
          label="Verified"
          value="View"
          hint="All approved documents"
          onClick={() =>
            setDrill({
              kind: "documents",
              status: "verified",
              title: "Verified documents",
            })
          }
        />
        <MetricCard
          icon={<ClipboardList className="w-3.5 h-3.5" />}
          label="All documents"
          value="View"
          hint="Every uploaded file"
          onClick={() =>
            setDrill({ kind: "documents", status: "", title: "All documents" })
          }
        />
      </Section>

      {d.cancelledJobs > 0 && (
        <Section title="Attention">
          <MetricCard
            icon={<XCircle className="w-3.5 h-3.5" />}
            label="Cancelled / declined"
            value={d.cancelledJobs.toLocaleString()}
            onClick={() =>
              setDrill({
                kind: "jobs",
                status: "cancelled",
                title: "Cancelled / declined jobs",
              })
            }
          />
        </Section>
      )}

      <AdminCharts enabled={enabled} overview={d} />

      <DrillDialog drill={drill} onClose={() => setDrill(null)} />
    </div>
  );
}
