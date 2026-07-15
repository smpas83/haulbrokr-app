import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Loader2, UserPlus, PlayCircle, FileWarning, Clock, CheckCircle2,
  AlertTriangle, Search, ChevronRight, RefreshCw,
} from "lucide-react";
import { apiFetch } from "@/lib/apiFetch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export type OnboardingFunnelFilter =
  | "all"
  | "registered_only"
  | "incomplete"
  | "waiting_documents"
  | "pending_review"
  | "approved"
  | "stalled";

type TimelineEvent = {
  type: string;
  label: string;
  at: string | null;
  status: "complete" | "pending" | "missing" | "rejected";
  detail?: string | null;
};

export type CarrierOnboardingRow = {
  carrier: string;
  profileId: number;
  email: string | null;
  created: string;
  lastActivity: string;
  profileComplete: boolean;
  truckAdded: boolean;
  w9Uploaded: string;
  coiUploaded: string;
  insuranceUploaded: string;
  w9Form: string;
  insuranceForm: string;
  funnelStage: string;
  completionPercent: number;
  missingItems: string[];
  uploadError: string | null;
  stalled: boolean;
  timeline: TimelineEvent[];
  pendingDocumentCount: number;
  verifiedDocumentCount: number;
  documentCount: number;
  overallStatus: string;
  reasonBlocked: string | null;
  nextAction: string;
  canBid: boolean;
  storageFileExists: boolean;
  databaseRecordExists: boolean;
  adminCanSeeIt: boolean;
};

type OnboardingTraceResponse = {
  generatedAt: string;
  filter: string;
  carrierCount: number;
  stuckCount: number;
  awaitingReviewCount: number;
  readyCount: number;
  newRegistrationCount?: number;
  setupStartedCount?: number;
  waitingDocumentsCount?: number;
  stalledCount?: number;
  carriers: CarrierOnboardingRow[];
};

const FILTERS: { value: OnboardingFunnelFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "registered_only", label: "Registered only" },
  { value: "incomplete", label: "Incomplete" },
  { value: "waiting_documents", label: "Waiting documents" },
  { value: "pending_review", label: "Pending review" },
  { value: "approved", label: "Approved" },
  { value: "stalled", label: "Stalled" },
];

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function stageBadge(stage: string, stalled: boolean) {
  if (stalled || stage === "stalled") {
    return <Badge className="rounded-xl bg-orange-500/15 text-orange-800 border border-orange-500/30">Stalled &gt;24h</Badge>;
  }
  switch (stage) {
    case "new_registration":
      return <Badge className="rounded-xl bg-sky-500/15 text-sky-800 border border-sky-500/30">New registration</Badge>;
    case "setup_started":
      return <Badge className="rounded-xl bg-blue-500/15 text-blue-800 border border-blue-500/30">Setup started</Badge>;
    case "waiting_documents":
      return <Badge className="rounded-xl bg-amber-500/15 text-amber-900 border border-amber-500/30">Waiting for documents</Badge>;
    case "waiting_approval":
      return <Badge className="rounded-xl bg-violet-500/15 text-violet-900 border border-violet-500/30">Waiting for approval</Badge>;
    case "approved":
      return <Badge className="rounded-xl bg-emerald-500/15 text-emerald-800 border border-emerald-500/30">Approved</Badge>;
    default:
      return <Badge variant="outline" className="rounded-xl">{stage}</Badge>;
  }
}

function statusDot(status: TimelineEvent["status"]) {
  const color =
    status === "complete" ? "bg-emerald-500"
    : status === "pending" ? "bg-amber-500"
    : status === "rejected" ? "bg-destructive"
    : "bg-muted-foreground/40";
  return <span className={`inline-block h-2.5 w-2.5 rounded-full ${color}`} />;
}

function SummaryCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border-2 px-4 py-3 flex items-start gap-3 min-w-[140px]">
      <div className="mt-0.5 text-muted-foreground">{icon}</div>
      <div>
        <p className="text-2xl font-bold tracking-tight">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

function CarrierTimeline({ events }: { events: TimelineEvent[] }) {
  return (
    <ol className="space-y-3">
      {events.map((ev) => (
        <li key={ev.type} className="flex gap-3 items-start">
          <div className="mt-1.5">{statusDot(ev.status)}</div>
          <div className="min-w-0 flex-1 border-b border-border/60 pb-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-medium text-sm">{ev.label}</p>
              <p className="text-xs text-muted-foreground">{fmtDate(ev.at)}</p>
            </div>
            {ev.detail && (
              <p className="text-xs text-muted-foreground mt-0.5">{ev.detail}</p>
            )}
            {!ev.at && ev.status === "missing" && (
              <p className="text-xs text-muted-foreground mt-0.5">Not yet</p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

export function AdminOnboarding({ enabled }: { enabled: boolean }) {
  const [filter, setFilter] = useState<OnboardingFunnelFilter>("all");
  const [q, setQ] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const qc = useQueryClient();

  const list = useQuery({
    queryKey: ["admin", "onboarding-trace", filter],
    queryFn: () =>
      apiFetch<OnboardingTraceResponse>(
        `/admin/onboarding-trace?filter=${encodeURIComponent(filter)}`,
      ),
    enabled,
    refetchInterval: enabled ? 60_000 : false,
  });

  const detail = useQuery({
    queryKey: ["admin", "onboarding-trace", selectedId],
    queryFn: () =>
      apiFetch<CarrierOnboardingRow>(`/admin/onboarding-trace/${selectedId}`),
    enabled: enabled && selectedId != null,
  });

  const carriers = list.data?.carriers ?? [];
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return carriers;
    return carriers.filter(
      (c) =>
        c.carrier.toLowerCase().includes(term)
        || (c.email ?? "").toLowerCase().includes(term)
        || String(c.profileId).includes(term),
    );
  }, [carriers, q]);

  const counts = {
    newReg: list.data?.newRegistrationCount
      ?? carriers.filter((c) => c.funnelStage === "new_registration").length,
    setup: list.data?.setupStartedCount
      ?? carriers.filter((c) => c.funnelStage === "setup_started").length,
    waitingDocs: list.data?.waitingDocumentsCount
      ?? carriers.filter((c) => c.funnelStage === "waiting_documents").length,
    waitingApproval: list.data?.awaitingReviewCount ?? 0,
    approved: list.data?.readyCount ?? 0,
    stalled: list.data?.stalledCount
      ?? carriers.filter((c) => c.stalled || c.funnelStage === "stalled").length,
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Onboarding</h2>
          <p className="text-sm text-muted-foreground">
            Live carrier funnel from Neon — registrations through document approval.
          </p>
        </div>
        <Button
          variant="outline"
          className="rounded-xl border-2 shrink-0"
          disabled={list.isFetching}
          onClick={() => qc.invalidateQueries({ queryKey: ["admin", "onboarding-trace"] })}
        >
          {list.isFetching ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
          Refresh
        </Button>
      </div>

      {list.isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : list.isError ? (
        <div className="rounded-xl border-2 border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          Failed to load onboarding traces. Confirm staff session and that the API deploy includes{" "}
          <code className="text-xs">/admin/onboarding-trace</code>.
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-3">
            <SummaryCard label="New registrations" value={counts.newReg} icon={<UserPlus className="w-4 h-4" />} />
            <SummaryCard label="Setup started" value={counts.setup} icon={<PlayCircle className="w-4 h-4" />} />
            <SummaryCard label="Waiting for documents" value={counts.waitingDocs} icon={<FileWarning className="w-4 h-4" />} />
            <SummaryCard label="Waiting for approval" value={counts.waitingApproval} icon={<Clock className="w-4 h-4" />} />
            <SummaryCard label="Approved" value={counts.approved} icon={<CheckCircle2 className="w-4 h-4" />} />
            <SummaryCard label="Stalled &gt;24h" value={counts.stalled} icon={<AlertTriangle className="w-4 h-4" />} />
          </div>

          <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
            <div className="flex flex-wrap gap-2">
              {FILTERS.map((f) => (
                <Button
                  key={f.value}
                  size="sm"
                  variant={filter === f.value ? "default" : "outline"}
                  className="rounded-xl border-2"
                  onClick={() => setFilter(f.value)}
                >
                  {f.label}
                </Button>
              ))}
            </div>
            <div className="relative sm:ml-auto w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search company or email…"
                className="pl-9 rounded-xl border-2"
              />
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border-2">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left">
                <tr>
                  <th className="px-3 py-2 font-semibold">Company</th>
                  <th className="px-3 py-2 font-semibold">Stage</th>
                  <th className="px-3 py-2 font-semibold">Last active</th>
                  <th className="px-3 py-2 font-semibold">Complete</th>
                  <th className="px-3 py-2 font-semibold">Missing</th>
                  <th className="px-3 py-2 font-semibold">Upload error</th>
                  <th className="px-3 py-2 font-semibold" />
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                      No carriers match this filter.
                    </td>
                  </tr>
                ) : (
                  filtered.map((c) => (
                    <tr
                      key={c.profileId}
                      className="border-t hover:bg-muted/30 cursor-pointer"
                      onClick={() => setSelectedId(c.profileId)}
                    >
                      <td className="px-3 py-2">
                        <p className="font-medium">{c.carrier}</p>
                        <p className="text-xs text-muted-foreground">{c.email ?? "—"}</p>
                      </td>
                      <td className="px-3 py-2">{stageBadge(c.funnelStage, c.stalled)}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                        {fmtDate(c.lastActivity)}
                      </td>
                      <td className="px-3 py-2">
                        <span className="font-semibold">{c.completionPercent}%</span>
                      </td>
                      <td className="px-3 py-2 max-w-[220px]">
                        <p className="text-xs text-muted-foreground truncate" title={c.missingItems.join(", ")}>
                          {c.missingItems.length ? c.missingItems.join(" · ") : "—"}
                        </p>
                      </td>
                      <td className="px-3 py-2 max-w-[180px]">
                        {c.uploadError ? (
                          <p className="text-xs text-destructive truncate" title={c.uploadError}>
                            {c.uploadError}
                          </p>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <ChevronRight className="w-4 h-4 inline text-muted-foreground" />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground">
            Generated {list.data?.generatedAt ? fmtDate(list.data.generatedAt) : "—"} · {filtered.length} shown
            {list.data?.carrierCount != null ? ` of ${list.data.carrierCount}` : ""}
          </p>
        </>
      )}

      <Dialog
        open={selectedId != null}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null);
        }}
      >
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto rounded-xl">
          <DialogHeader>
            <DialogTitle>
              {detail.data?.carrier ?? carriers.find((c) => c.profileId === selectedId)?.carrier ?? "Carrier"}
            </DialogTitle>
            <DialogDescription>
              Onboarding timeline and live blockers (production Neon data).
            </DialogDescription>
          </DialogHeader>
          {detail.isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : detail.isError ? (
            <p className="text-sm text-destructive">Failed to load carrier timeline.</p>
          ) : detail.data ? (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2 items-center">
                {stageBadge(detail.data.funnelStage, detail.data.stalled)}
                <Badge variant="outline" className="rounded-xl">{detail.data.completionPercent}% complete</Badge>
                {detail.data.canBid && (
                  <Badge className="rounded-xl bg-emerald-500/15 text-emerald-800">Can bid</Badge>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-xl border px-3 py-2">
                  <p className="text-muted-foreground">Account created</p>
                  <p className="font-medium">{fmtDate(detail.data.created)}</p>
                </div>
                <div className="rounded-xl border px-3 py-2">
                  <p className="text-muted-foreground">Last active</p>
                  <p className="font-medium">{fmtDate(detail.data.lastActivity)}</p>
                </div>
                <div className="rounded-xl border px-3 py-2">
                  <p className="text-muted-foreground">Docs (pending / verified)</p>
                  <p className="font-medium">
                    {detail.data.pendingDocumentCount} / {detail.data.verifiedDocumentCount}
                  </p>
                </div>
                <div className="rounded-xl border px-3 py-2">
                  <p className="text-muted-foreground">Storage / DB / Admin view</p>
                  <p className="font-medium">
                    {detail.data.storageFileExists ? "R2✓" : "R2—"} ·{" "}
                    {detail.data.databaseRecordExists ? "DB✓" : "DB—"} ·{" "}
                    {detail.data.adminCanSeeIt ? "Visible" : "Hidden"}
                  </p>
                </div>
              </div>
              {detail.data.reasonBlocked && (
                <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
                  <span className="font-semibold">Current blocker: </span>
                  {detail.data.reasonBlocked}
                </div>
              )}
              {detail.data.uploadError && (
                <div className="rounded-xl border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                  <span className="font-semibold">Upload error: </span>
                  {detail.data.uploadError}
                </div>
              )}
              {detail.data.missingItems?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                    Missing items
                  </p>
                  <ul className="text-sm list-disc pl-5 space-y-0.5">
                    {detail.data.missingItems.map((m) => (
                      <li key={m}>{m}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                  Timeline
                </p>
                <CarrierTimeline events={detail.data.timeline ?? []} />
              </div>
              <p className="text-xs text-muted-foreground">{detail.data.nextAction}</p>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
