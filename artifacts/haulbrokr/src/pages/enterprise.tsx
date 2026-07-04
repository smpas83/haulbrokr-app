import { useState } from "react";
import { format } from "date-fns";
import {
  Building2, Workflow, CheckSquare, FileText, Users, DollarSign,
  Truck, BarChart3, Settings, RefreshCw, Plus, Download,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader, KpiCard } from "@/components/design";
import { useEnterpriseHub } from "@/hooks/use-enterprise-hub";
import { BusinessHealthPanel } from "@/components/operations/business-health-panel";
import { ExecutiveDigestPanel } from "@/components/operations/executive-digest-panel";
import { apiFetch } from "@/lib/apiFetch";
import { cn } from "@/lib/utils";
import type { BusinessHealthScores } from "@/lib/operations-types";

const TABS = [
  { id: "overview", label: "Overview", icon: Building2 },
  { id: "workflows", label: "Workflows", icon: Workflow },
  { id: "tasks", label: "Tasks", icon: CheckSquare },
  { id: "documents", label: "Documents", icon: FileText },
  { id: "scorecards", label: "Scorecards", icon: Users },
  { id: "finance", label: "Finance", icon: DollarSign },
  { id: "fleet", label: "Fleet", icon: Truck },
  { id: "reports", label: "Reports", icon: BarChart3 },
  { id: "settings", label: "Settings", icon: Settings },
] as const;

type TabId = typeof TABS[number]["id"];

export default function EnterpriseHubPage() {
  const { data, loading, error, refresh } = useEnterpriseHub();
  const [tab, setTab] = useState<TabId>("overview");

  const health = data?.operations?.businessHealth as BusinessHealthScores | undefined;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <PageHeader
        title="Enterprise OS"
        description="Workflows, tasks, documents, finance, fleet, and intelligence — your daily operating system."
        actions={
          <Button variant="outline" size="sm" onClick={() => refresh()} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        }
      />

      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>
      )}

      <div className="flex flex-wrap gap-2 border-b border-border/50 pb-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg transition-colors",
              tab === t.id ? "bg-primary/15 text-primary border border-primary/20" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <t.icon className="h-3.5 w-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {loading && !data ? (
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
      ) : data && (
        <>
          {tab === "overview" && (
            <div className="space-y-6">
              {health && (
                <Card>
                  <CardHeader><CardTitle>Business Health</CardTitle></CardHeader>
                  <CardContent><BusinessHealthPanel scores={health} /></CardContent>
                </Card>
              )}
              {data.operations.executiveDigest && (
                <Card>
                  <CardHeader><CardTitle>{data.operations.executiveDigest.title}</CardTitle></CardHeader>
                  <CardContent><ExecutiveDigestPanel digest={data.operations.executiveDigest as Parameters<typeof ExecutiveDigestPanel>[0]["digest"]} /></CardContent>
                </Card>
              )}
              <div className="grid gap-4 md:grid-cols-4">
                <KpiCard title="Workflows" value={data.workflows.items.length} icon={Workflow} />
                <KpiCard title="Open Tasks" value={data.tasks.items.filter((t) => t.status !== "done").length} icon={CheckSquare} />
                <KpiCard title="Documents" value={data.documents.items.length} icon={FileText} />
                <KpiCard title="Revenue" value={`$${data.finance.revenue.toLocaleString()}`} icon={DollarSign} accent />
              </div>
            </div>
          )}

          {tab === "workflows" && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Workflow Engine</CardTitle>
                  <CardDescription>Configurable approval and compliance workflows</CardDescription>
                </div>
                <Button size="sm" onClick={() => apiFetch("/enterprise/workflows", { method: "POST", body: JSON.stringify({ templateKey: "load_approval" }) }).then(() => refresh())}>
                  <Plus className="h-4 w-4 mr-1" /> New
                </Button>
              </CardHeader>
              <CardContent className="space-y-2">
                {data.workflows.items.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">No active workflows</p>
                ) : data.workflows.items.map((w) => (
                  <div key={w.id} className="flex items-center justify-between p-3 rounded-xl border border-border/50">
                    <div>
                      <p className="text-sm font-semibold">{w.title}</p>
                      <p className="text-xs text-muted-foreground">{w.templateKey} · {w.status} · SLA {w.slaHours}h</p>
                    </div>
                    {w.dueAt && <span className="text-xs text-muted-foreground">{format(new Date(w.dueAt), "MMM d")}</span>}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {tab === "tasks" && (
            <Card>
              <CardHeader><CardTitle>Task Engine</CardTitle><CardDescription>{data.tasks.overdue.length} overdue</CardDescription></CardHeader>
              <CardContent className="space-y-2">
                {data.tasks.items.map((t) => (
                  <div key={t.id} className="flex items-center justify-between p-3 rounded-xl border border-border/50">
                    <div>
                      <p className="text-sm font-semibold">{t.title}</p>
                      <p className="text-xs text-muted-foreground">{t.entityType} · {t.status} · {t.priority}</p>
                    </div>
                    {t.status !== "done" && (
                      <Button size="sm" variant="outline" onClick={() => apiFetch(`/enterprise/tasks/${t.id}/complete`, { method: "POST" }).then(() => refresh())}>Complete</Button>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {tab === "documents" && (
            <Card>
              <CardHeader><CardTitle>Document Center</CardTitle><CardDescription>{data.documents.expiring.length} expiring soon</CardDescription></CardHeader>
              <CardContent className="space-y-2">
                {data.documents.items.map((d) => (
                  <div key={d.id} className="flex items-center justify-between p-3 rounded-xl border border-border/50">
                    <div>
                      <p className="text-sm font-semibold">{d.title}</p>
                      <p className="text-xs text-muted-foreground capitalize">{d.category} · {d.status}</p>
                    </div>
                    {d.expiresAt && <span className="text-xs text-warning">{format(new Date(d.expiresAt), "MMM d, yyyy")}</span>}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {tab === "scorecards" && (
            <div className="grid gap-4 md:grid-cols-2">
              {data.scorecards.customer && (
                <Card>
                  <CardHeader><CardTitle>Customer Success</CardTitle></CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <p>LTV: <span className="font-bold">${data.scorecards.customer.lifetimeValue.toLocaleString()}</span></p>
                    <p>Risk Score: {data.scorecards.customer.riskScore}/100</p>
                    {data.scorecards.customer.aiInsights.map((i, idx) => <p key={idx} className="text-muted-foreground">{i}</p>)}
                  </CardContent>
                </Card>
              )}
              {data.scorecards.vendor && (
                <Card>
                  <CardHeader><CardTitle>Vendor Scorecard</CardTitle></CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <p>Acceptance: {data.scorecards.vendor.acceptanceRate}%</p>
                    <p>Reliability: {data.scorecards.vendor.reliability}/100</p>
                    <p>Revenue: ${data.scorecards.vendor.revenue.toLocaleString()}</p>
                  </CardContent>
                </Card>
              )}
              {data.scorecards.driver && (
                <Card>
                  <CardHeader><CardTitle>Driver Performance</CardTitle></CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <p>Completed: {data.scorecards.driver.completedLoads}</p>
                    <p>On-time: {data.scorecards.driver.onTimePercent}%</p>
                    <p>Rating: {data.scorecards.driver.customerRating}</p>
                    <div className="flex gap-1 flex-wrap">{data.scorecards.driver.badges.map((b) => <span key={b} className="text-[10px] px-2 py-0.5 rounded-full bg-primary/15">{b}</span>)}</div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {tab === "finance" && (
            <Card>
              <CardHeader><CardTitle>Finance Center</CardTitle></CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-3 mb-6">
                  <KpiCard title="Total Revenue" value={`$${data.finance.revenue.toLocaleString()}`} icon={DollarSign} accent />
                  <KpiCard title="This Month" value={`$${data.finance.monthRevenue.toLocaleString()}`} icon={DollarSign} />
                  <KpiCard title="Outstanding" value={data.finance.outstandingInvoices} icon={FileText} sub="Invoices" />
                </div>
                {data.finance.profitabilityByRegion.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">By Region</p>
                    {data.finance.profitabilityByRegion.map((r) => (
                      <div key={r.region} className="flex justify-between text-sm">
                        <span>{r.region}</span>
                        <span className="font-semibold">${r.revenue.toLocaleString()} ({r.loads} loads)</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {tab === "fleet" && (
            <Card>
              <CardHeader><CardTitle>Fleet Management</CardTitle><CardDescription>{data.fleet.summary.utilization}% utilization</CardDescription></CardHeader>
              <CardContent className="space-y-2">
                {data.fleet.trucks.map((t) => (
                  <div key={t.id} className="flex items-center justify-between p-3 rounded-xl border border-border/50">
                    <div>
                      <p className="text-sm font-semibold">{t.label}</p>
                      <p className="text-xs text-muted-foreground capitalize">{t.truckType.replace(/_/g, " ")} · COI {t.coiStatus}</p>
                    </div>
                    <span className={t.isAvailable ? "text-emerald-400 text-xs" : "text-muted-foreground text-xs"}>{t.isAvailable ? "Available" : "On job"}</span>
                  </div>
                ))}
                {data.fleet.maintenanceSchedule.map((m, i) => (
                  <div key={i} className="text-xs text-warning p-2 rounded-lg bg-warning/5">Truck #{m.truckId}: {m.task} — {m.due}</div>
                ))}
              </CardContent>
            </Card>
          )}

          {tab === "reports" && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Report Builder</CardTitle>
                <Button size="sm" variant="outline" onClick={() => apiFetch("/enterprise/reports", { method: "POST", body: JSON.stringify({ name: "Revenue Report", config: { type: "revenue_summary" } }) }).then(() => refresh())}>
                  <Plus className="h-4 w-4 mr-1" /> Save Report
                </Button>
              </CardHeader>
              <CardContent className="space-y-2">
                {data.reports.saved.map((r) => (
                  <div key={r.id} className="flex items-center justify-between p-3 rounded-xl border border-border/50">
                    <span className="text-sm font-semibold">{r.name}</span>
                    <Button size="sm" variant="ghost" onClick={() => window.open(`/api/enterprise/reports/${r.id}/export.csv`, "_blank")}>
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <p className="text-xs text-muted-foreground pt-2">Templates: {data.reports.templates.map((t) => t.name).join(", ")}</p>
              </CardContent>
            </Card>
          )}

          {tab === "settings" && (
            <Card>
              <CardHeader><CardTitle>Enterprise Settings</CardTitle></CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div>
                  <p className="font-semibold mb-1">Permissions</p>
                  <p className="text-muted-foreground">{data.permissions.join(", ")}</p>
                </div>
                <div>
                  <p className="font-semibold mb-1">AI Preferences</p>
                  <p className="text-muted-foreground">Smart notifications only · Copilot enabled</p>
                </div>
                <div>
                  <p className="font-semibold mb-1">Recent Audit</p>
                  {data.audit.slice(0, 5).map((a) => (
                    <p key={a.id} className="text-xs text-muted-foreground">{a.action} · {a.resourceType} · {format(new Date(a.createdAt), "MMM d")}</p>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
