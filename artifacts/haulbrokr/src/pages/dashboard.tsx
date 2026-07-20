import { useMemo } from "react";
import { Link } from "wouter";
import { format, subDays, parseISO } from "date-fns";
import {
  ArrowRight, Activity, Plus, Truck, AlertCircle,
  CircleCheck, CheckCircle2, TrendingUp,
  ShieldAlert, ArrowUpRight, ClipboardList, Briefcase,
  Radio, Sparkles
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from "recharts";
import {
  useGetDashboardStats, useGetDashboardActivity,
  useGetMyProfile, useGetAccountStatus
} from "@workspace/api-client-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PageHeader, KpiCard } from "@/components/design";
import { CHART_COLORS } from "@/lib/design-tokens";

const CustomBarTooltip = ({ active, payload, label }: any) => {
  if (active && payload?.length) {
    return (
      <div className="surface-panel rounded-lg px-3 py-2 text-sm">
        <p className="font-semibold">{label}</p>
        <p className="text-primary">{payload[0].value} events</p>
      </div>
    );
  }
  return null;
};

const CustomPieTooltip = ({ active, payload }: any) => {
  if (active && payload?.length) {
    return (
      <div className="surface-panel rounded-lg px-3 py-2 text-sm">
        <p className="font-semibold capitalize">{payload[0].name}</p>
        <p className="text-primary">{payload[0].value}</p>
      </div>
    );
  }
  return null;
};

export default function DashboardPage() {
  const { data: profile } = useGetMyProfile();
  const { data: stats, isLoading: statsLoading } = useGetDashboardStats();
  const { data: activities, isLoading: activityLoading } = useGetDashboardActivity();
  const { data: accountStatus } = useGetAccountStatus();

  const isCustomer = profile?.role === "customer";
  const isProvider = profile?.role === "provider";

  const canOperate = isCustomer
    ? accountStatus?.profileComplete
    : (accountStatus?.w9Status === "verified" && accountStatus?.insuranceStatus === "verified");

  const barData = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = subDays(new Date(), 6 - i);
      return { label: format(d, "EEE"), date: format(d, "yyyy-MM-dd"), count: 0 };
    });
    activities?.forEach((a) => {
      try {
        const d = format(parseISO(a.createdAt), "yyyy-MM-dd");
        const day = days.find(x => x.date === d);
        if (day) day.count += 1;
      } catch {}
    });
    return days.map(d => ({ name: d.label, events: d.count }));
  }, [activities]);

  const pieData = useMemo(() => {
    if (!stats) return [];
    const data = [];
    if (isProvider) {
      if (stats.activeJobs) data.push({ name: "Active", value: stats.activeJobs });
      if (stats.pendingBids) data.push({ name: "Pending Bids", value: stats.pendingBids });
      if (stats.completedJobs) data.push({ name: "Completed", value: stats.completedJobs });
    } else {
      if (stats.openRequests) data.push({ name: "Open", value: stats.openRequests });
      if (stats.activeJobs) data.push({ name: "Active", value: stats.activeJobs });
      if (stats.completedJobs) data.push({ name: "Completed", value: stats.completedJobs });
    }
    return data;
  }, [stats, isCustomer, isProvider]);

  const hasChartData = pieData.some(d => d.value > 0);

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <PageHeader
        title="Mission Control"
        description={
          <>Welcome back, <span className="font-semibold text-foreground">{profile?.contactName || profile?.companyName}</span>. Here's your operations overview.</>
        }
        actions={
          <>
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

      {/* Account summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { icon: Activity, label: "Active Jobs", value: stats?.activeJobs != null ? String(stats.activeJobs) : "—", color: "text-accent" },
          { icon: Radio, label: "Open Requests", value: isCustomer && stats?.openRequests != null ? String(stats.openRequests) : isProvider ? "—" : "—", color: "text-primary" },
          { icon: TrendingUp, label: isProvider ? "Pending Bids" : "Completed", value: isProvider ? (stats?.pendingBids != null ? String(stats.pendingBids) : "—") : (stats?.completedJobs != null ? String(stats.completedJobs) : "—"), color: "text-emerald-400" },
          { icon: Sparkles, label: isProvider ? "Est. Revenue" : "Total Spent", value: isProvider ? `$${(stats?.totalRevenue ?? 0).toLocaleString()}` : `$${(stats?.totalSpent ?? 0).toLocaleString()}`, color: "text-primary" },
        ].map((item) => (
          <div key={item.label} className="surface-panel rounded-xl px-4 py-3 flex items-center gap-3">
            <item.icon className={`h-4 w-4 ${item.color}`} />
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{item.label}</p>
              <p className={`text-sm font-semibold ${item.color}`}>{item.value}</p>
            </div>
          </div>
        ))}
      </div>

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

      {statsLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-[120px] w-full rounded-xl" />)}
        </div>
      ) : stats ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {isCustomer && (
            <KpiCard title="Open Requests" value={stats.openRequests ?? 0} icon={AlertCircle} />
          )}
          <KpiCard title="Active Jobs" value={stats.activeJobs ?? 0} icon={Activity} />
          {isProvider && (
            <>
              <KpiCard title="Pending Bids" value={stats.pendingBids ?? 0} icon={TrendingUp} />
              <KpiCard
                title="Est. Revenue"
                value={`$${(stats.totalRevenue ?? 0).toLocaleString()}`}
                icon={ArrowUpRight}
                accent
                sub="Lifetime earnings"
              />
            </>
          )}
          {isCustomer && (
            <>
              <KpiCard title="Completed Jobs" value={stats.completedJobs ?? 0} icon={CheckCircle2} />
              <KpiCard
                title="Total Spent"
                value={`$${(stats.totalSpent ?? 0).toLocaleString()}`}
                icon={CircleCheck}
                accent
                sub="Lifetime spend"
              />
            </>
          )}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-full lg:col-span-4">
          <CardHeader className="pb-2">
            <CardTitle>Executive Analytics — Last 7 Days</CardTitle>
            <CardDescription>Platform events recorded on your account</CardDescription>
          </CardHeader>
          <CardContent>
            {activityLoading ? (
              <Skeleton className="h-[200px] w-full rounded-xl" />
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={barData} barCategoryGap="35%">
                  <XAxis
                    dataKey="name"
                    tick={{ fill: "hsl(240 4% 55%)", fontSize: 12, fontWeight: 500 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fill: "hsl(240 4% 55%)", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    width={24}
                  />
                  <Tooltip content={<CustomBarTooltip />} cursor={{ fill: "hsl(20 100% 50% / 0.08)" }} />
                  <Bar dataKey="events" fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="col-span-full lg:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle>Job Status Breakdown</CardTitle>
            <CardDescription>Distribution across all your jobs</CardDescription>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-[200px] w-full rounded-xl" />
            ) : hasChartData ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={48}
                    outerRadius={72}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomPieTooltip />} />
                  <Legend
                    iconType="circle"
                    iconSize={8}
                    formatter={(value) => (
                      <span className="text-xs font-medium text-muted-foreground capitalize">{value}</span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-[200px] text-muted-foreground">
                <CircleCheck className="h-10 w-10 mb-3 opacity-20" />
                <p className="text-sm">No job data yet</p>
                <p className="text-xs mt-1">Post or bid on a job to see stats</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-full lg:col-span-4">
          <CardHeader className="pb-3">
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest actions on your account</CardDescription>
          </CardHeader>
          <CardContent>
            {activityLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
              </div>
            ) : activities && activities.length > 0 ? (
              <div className="space-y-1">
                {activities.slice(0, 8).map((activity) => {
                  const isFailure = activity.type === "payment_failed" || activity.type === "application_rejected";
                  const isActionNeeded = activity.type === "payment_requires_action" || activity.type === "payout_delayed";
                  const isApproved = activity.type === "application_approved";
                  const isBin = activity.type.startsWith("bin_");
                  const dotClass = isFailure
                    ? "bg-destructive"
                    : isActionNeeded
                      ? "bg-warning"
                      : isApproved
                        ? "bg-emerald-400"
                        : isBin
                          ? "bg-violet-400"
                          : "bg-primary";
                  const textClass = isFailure
                    ? "text-destructive"
                    : isActionNeeded
                      ? "text-warning"
                      : isApproved
                        ? "text-emerald-400"
                        : "";
                  const binHref = isBin && activity.relatedBinOrderId != null
                    ? `/bins?order=${encodeURIComponent(activity.relatedBinOrderId)}`
                    : null;
                  const jobHref = (isFailure || isActionNeeded) && activity.relatedId != null
                    ? `/jobs/${activity.relatedId}`
                    : null;
                  const href = binHref ?? jobHref;
                  const isLink = href != null;
                  const inner = (
                    <>
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${dotClass}`} />
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium leading-tight truncate ${textClass}`}>{activity.description}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {format(new Date(activity.createdAt), "MMM d, h:mm a")}
                        </p>
                      </div>
                      {isLink && (
                        <ArrowUpRight className={`h-4 w-4 flex-shrink-0 ${isFailure ? "text-destructive" : isActionNeeded ? "text-warning" : "text-muted-foreground"}`} />
                      )}
                    </>
                  );
                  const className = "flex items-center gap-4 py-2.5 px-3 hover:bg-muted/30 transition-colors rounded-lg border-b border-border/30 last:border-0";
                  return isLink ? (
                    <Link key={activity.id} href={href} className={className}>
                      {inner}
                    </Link>
                  ) : (
                    <div key={activity.id} className={className}>
                      {inner}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-10 text-muted-foreground">
                <Activity className="mx-auto h-8 w-8 mb-3 opacity-20" />
                <p className="text-sm">No recent activity</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="col-span-full lg:col-span-3">
          <CardHeader className="pb-3">
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {isCustomer && (
              <>
                <QuickAction href="/requests/new" icon={Plus} label="Post a new request" />
                <QuickAction href="/requests" icon={ClipboardList} label="Review open bids" />
                <QuickAction href="/jobs" icon={Briefcase} label="Track active jobs" />
              </>
            )}
            {isProvider && (
              <>
                <QuickAction href="/requests" icon={Truck} label="Find new jobs" />
                <QuickAction href="/fleet/new" icon={Plus} label="Add a truck to fleet" />
                <QuickAction href="/jobs" icon={Briefcase} label="Active jobs" />
                <QuickAction href="/account" icon={ShieldAlert} label="Compliance status" />
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function QuickAction({ href, icon: Icon, label }: { href: string; icon: React.ElementType; label: string }) {
  return (
    <Link href={href}>
      <div className="flex items-center justify-between p-3.5 rounded-xl border border-border/50 hover:border-primary/30 cursor-pointer transition-all group hover:bg-primary/5">
        <div className="flex items-center gap-3">
          <Icon className="h-4 w-4 text-primary" />
          <span className="font-medium text-sm">{label}</span>
        </div>
        <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
      </div>
    </Link>
  );
}
