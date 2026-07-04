import { useState } from "react";
import { Link } from "wouter";
import { format } from "date-fns";
import {
  Plus, Truck, AlertCircle, ShieldAlert, Cloud, Navigation,
  Radio, Users, DollarSign, Briefcase, Sparkles, RefreshCw,
  AlertTriangle, Fuel, Calendar, ArrowUpRight, Activity,
} from "lucide-react";
import { useGetMyProfile, useGetAccountStatus } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PageHeader, KpiCard } from "@/components/design";
import { useOperationsCenter } from "@/hooks/use-operations-center";
import { InsightCard } from "@/components/operations/insight-card";
import { LiveOperationsStream } from "@/components/operations/live-operations-stream";
import { DispatchOptimizerPanel } from "@/components/operations/dispatch-optimizer-panel";
import { ExecutiveAnalyticsPanel } from "@/components/operations/executive-analytics-panel";

export function OperationsFeed() {
  const { data: profile } = useGetMyProfile();
  const { data: accountStatus } = useGetAccountStatus();
  const { data, loading, error, refresh } = useOperationsCenter();
  const [insightsExpanded, setInsightsExpanded] = useState(false);

  const isCustomer = profile?.role === "customer";
  const isProvider = profile?.role === "provider";

  const canOperate = isCustomer
    ? accountStatus?.profileComplete
    : (accountStatus?.w9Status === "verified" && accountStatus?.insuranceStatus === "verified");

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <PageHeader
        title="Operations Center"
        description={
          loading ? "Loading your AI operations feed…" : (
            <span className="text-muted-foreground">{data?.morningBrief}</span>
          )
        }
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => refresh()} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            {isCustomer && (
              <Link href="/requests/new">
                <Button data-testid="button-new-request">
                  <Plus className="mr-2 h-4 w-4" />
                  Post Job Request
                </Button>
              </Link>
            )}
            {isProvider && (
              <Link href="/requests">
                <Button data-testid="button-browse-jobs">
                  <Truck className="mr-2 h-4 w-4" />
                  Browse Open Jobs
                </Button>
              </Link>
            )}
          </>
        }
      />

      {error && (
        <Alert className="border-destructive/30 bg-destructive/10 rounded-xl">
          <AlertCircle className="h-4 w-4 text-destructive" />
          <AlertTitle className="text-destructive">Operations feed unavailable</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {accountStatus && !canOperate && (
        <Alert className="border-warning/30 bg-warning/10 rounded-xl">
          <ShieldAlert className="h-4 w-4 text-warning" />
          <AlertTitle className="text-warning font-semibold">Action Required</AlertTitle>
          <AlertDescription className="text-warning/80">
            {isProvider
              ? "Complete your W-9 and insurance verification to start bidding on jobs."
              : "Complete your profile to post job requests."}
            {" "}
            <Link href="/account">
              <span className="underline font-semibold cursor-pointer">Go to Account →</span>
            </Link>
          </AlertDescription>
        </Alert>
      )}

      {/* Status bar — real data only */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
        </div>
      ) : data && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatusTile icon={Radio} label="Fleet" value={isProvider ? `${data.fleetStatus.available}/${data.fleetStatus.total} avail` : `${data.fleetStatus.onJob} active`} color="text-emerald-400" />
          <StatusTile icon={Users} label="Drivers" value={isProvider ? `${data.driverAvailability.assigned} assigned` : "—"} color="text-primary" />
          {data.weather && <StatusTile icon={Cloud} label="Schedule" value={data.weather.summary} color="text-primary" />}
          {data.traffic && <StatusTile icon={Navigation} label="Routes" value={data.traffic.summary} color="text-accent" />}
          <StatusTile icon={Sparkles} label="AI Insights" value={`${data.insights.length} active`} color="text-primary" />
          <StatusTile icon={Activity} label="Utilization" value={`${data.analytics.fleetUtilization}%`} color="text-accent" />
        </div>
      )}

      {/* KPI row */}
      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-[120px] rounded-xl" />)}
        </div>
      ) : data && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <KpiCard title="Today's Revenue" value={`$${data.todayRevenue.toLocaleString()}`} icon={DollarSign} accent />
          <KpiCard title="Today's Jobs" value={data.todayJobs} icon={Briefcase} />
          <KpiCard title="Active Alerts" value={data.criticalAlerts.length} icon={AlertTriangle} />
          <KpiCard title="Upcoming" value={data.upcomingDeliveries.length} icon={Calendar} sub="Scheduled deliveries" />
        </div>
      )}

      {/* Critical alerts */}
      {data && data.criticalAlerts.length > 0 && (
        <Card className="border-destructive/30">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Critical Alerts
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.criticalAlerts.map((a) => (
              <Link key={a.id} href={a.href ?? "/jobs"}>
                <div className="flex items-center justify-between p-3 rounded-xl border border-destructive/20 bg-destructive/5 hover:border-destructive/40 cursor-pointer transition-colors">
                  <div>
                    <p className="text-sm font-semibold">{a.title}</p>
                    <p className="text-xs text-muted-foreground">{a.description}</p>
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-destructive" />
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-7">
        {/* AI Recommendations */}
        <Card className="col-span-full lg:col-span-4">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              AI Recommendations
            </CardTitle>
            <CardDescription>Insights powered by your live operational data</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
              </div>
            ) : data && data.insights.length > 0 ? (
              <div className="space-y-3">
                {(insightsExpanded ? data.insights : data.insights.slice(0, 4)).map((insight) => (
                  <InsightCard key={insight.id} insight={insight} />
                ))}
                {data.insights.length > 4 && (
                  <Button variant="ghost" size="sm" onClick={() => setInsightsExpanded(!insightsExpanded)}>
                    {insightsExpanded ? "Show fewer" : `Show all ${data.insights.length} insights`}
                  </Button>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-6 text-center">No recommendations right now — operations look healthy.</p>
            )}
          </CardContent>
        </Card>

        {/* Live Operations */}
        <Card className="col-span-full lg:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <Radio className="h-5 w-5 text-primary" />
              Live Operations
            </CardTitle>
            <CardDescription>Real-time activity stream</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-12 rounded-lg" />)}
              </div>
            ) : data ? (
              <LiveOperationsStream events={data.liveStream} />
            ) : null}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-7">
        {/* Late jobs + opportunities */}
        <Card className="col-span-full lg:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle>Late Jobs</CardTitle>
            <CardDescription>Past scheduled start without check-in</CardDescription>
          </CardHeader>
          <CardContent>
            {!data || data.lateJobs.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No late jobs</p>
            ) : (
              <div className="space-y-2">
                {data.lateJobs.map((j) => (
                  <Link key={j.id} href={`/jobs/${j.id}`}>
                    <div className="flex items-center justify-between p-3 rounded-xl border border-warning/30 bg-warning/5 hover:border-warning/50 cursor-pointer">
                      <div>
                        <p className="text-sm font-semibold">#{j.id} — {j.materialType}</p>
                        <p className="text-xs text-muted-foreground truncate">{j.pickupAddress}</p>
                      </div>
                      <span className="text-xs text-warning font-semibold">{format(new Date(j.scheduledDate), "MMM d")}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="col-span-full lg:col-span-4">
          <CardHeader className="pb-2">
            <CardTitle>High Margin Opportunities</CardTitle>
            <CardDescription>Open loads with premium rates</CardDescription>
          </CardHeader>
          <CardContent>
            {!data || data.highMarginOpportunities.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No high-margin loads on the board</p>
            ) : (
              <div className="space-y-2">
                {data.highMarginOpportunities.map((o) => (
                  <Link key={o.id} href={`/requests/${o.id}`}>
                    <div className="flex items-center justify-between p-3 rounded-xl border border-border/50 hover:border-primary/30 cursor-pointer transition-colors">
                      <div>
                        <p className="text-sm font-semibold">#{o.id} — {o.materialType}</p>
                        <p className="text-xs text-muted-foreground truncate">{o.pickupAddress}</p>
                      </div>
                      <div className="text-right">
                        {o.budgetPerHour && <p className="text-sm font-bold text-emerald-400">${o.budgetPerHour}/hr</p>}
                        <p className="text-[10px] text-muted-foreground">Est. margin ${o.estimatedMargin}</p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dispatch optimizer — providers only */}
      {isProvider && data && data.dispatchSuggestions.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Dispatch Optimizer</CardTitle>
            <CardDescription>AI truck assignments, profitability, and conflict detection</CardDescription>
          </CardHeader>
          <CardContent>
            <DispatchOptimizerPanel suggestions={data.dispatchSuggestions} />
          </CardContent>
        </Card>
      )}

      {/* Executive analytics */}
      {data && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Executive Analytics</CardTitle>
            <CardDescription>Forecasts, utilization, and regional demand</CardDescription>
          </CardHeader>
          <CardContent>
            <ExecutiveAnalyticsPanel analytics={data.analytics} isProvider={!!isProvider} />
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-7">
        {/* Recent activity */}
        <Card className="col-span-full lg:col-span-4">
          <CardHeader className="pb-2">
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 rounded-lg" />)}
              </div>
            ) : data && data.recentActivity.length > 0 ? (
              <div className="space-y-1">
                {data.recentActivity.slice(0, 8).map((activity) => {
                  const href = activity.relatedId && activity.type.includes("job")
                    ? `/jobs/${activity.relatedId}`
                    : activity.relatedId && activity.type.includes("bid")
                      ? `/requests/${activity.relatedId}`
                      : null;
                  const inner = (
                    <>
                      <div className="w-2 h-2 rounded-full flex-shrink-0 bg-primary" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{activity.description}</p>
                        <p className="text-xs text-muted-foreground">{format(new Date(activity.createdAt), "MMM d, h:mm a")}</p>
                      </div>
                    </>
                  );
                  return href ? (
                    <Link key={activity.id} href={href} className="flex items-center gap-4 py-2.5 px-3 hover:bg-muted/30 rounded-lg">
                      {inner}
                    </Link>
                  ) : (
                    <div key={activity.id} className="flex items-center gap-4 py-2.5 px-3">
                      {inner}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-6 text-center">No recent activity</p>
            )}
          </CardContent>
        </Card>

        {/* Compliance + fuel + upcoming */}
        <Card className="col-span-full lg:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle>Compliance & Schedule</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {data && data.complianceWarnings.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-warning mb-2">Compliance Warnings</p>
                {data.complianceWarnings.map((w) => (
                  <Link key={w.id} href={w.href}>
                    <div className="p-3 rounded-xl border border-warning/30 bg-warning/5 mb-2 cursor-pointer hover:border-warning/50">
                      <p className="text-sm font-semibold">{w.title}</p>
                      <p className="text-xs text-muted-foreground">{w.detail}</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
            {data && data.fuelAlerts.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-accent mb-2 flex items-center gap-1">
                  <Fuel className="h-3 w-3" /> Equipment Alerts
                </p>
                {data.fuelAlerts.map((f) => (
                  <div key={f.id} className="p-3 rounded-xl border border-border/50 mb-2">
                    <p className="text-sm font-semibold">{f.title}</p>
                    <p className="text-xs text-muted-foreground">{f.detail}</p>
                  </div>
                ))}
              </div>
            )}
            {data && data.upcomingDeliveries.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Upcoming Deliveries</p>
                {data.upcomingDeliveries.slice(0, 5).map((d) => (
                  <Link key={d.id} href={`/jobs/${d.id}`}>
                    <div className="flex items-center justify-between py-2 border-b border-border/30 last:border-0 cursor-pointer hover:text-primary">
                      <span className="text-sm truncate">#{d.id} {d.materialType}</span>
                      <span className="text-xs text-muted-foreground">{format(new Date(d.scheduledDate), "MMM d")}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
            {data && data.complianceWarnings.length === 0 && data.fuelAlerts.length === 0 && data.upcomingDeliveries.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">All clear — no compliance or schedule alerts</p>
            )}
          </CardContent>
        </Card>
      </div>

      {data?.updatedAt && (
        <p className="text-[10px] text-muted-foreground text-center">
          Last updated {format(new Date(data.updatedAt), "h:mm:ss a")} · Auto-refreshes every 30s
        </p>
      )}
    </div>
  );
}

function StatusTile({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: string; color: string }) {
  return (
    <div className="surface-panel rounded-xl px-4 py-3 flex items-center gap-3">
      <Icon className={`h-4 w-4 ${color}`} />
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className={`text-sm font-semibold truncate ${color}`}>{value}</p>
      </div>
    </div>
  );
}
