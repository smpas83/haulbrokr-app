import { useMemo } from "react";
import { Link } from "wouter";
import { format, subDays, parseISO } from "date-fns";
import {
  ArrowRight, Activity, Plus, Truck, AlertCircle,
  CircleCheck, CheckCircle2, TrendingUp,
  ShieldAlert, ArrowUpRight, ClipboardList, Briefcase
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from "recharts";
import {
  useGetDashboardStats, useGetDashboardActivity,
  useGetMyProfile, useGetAccountStatus
} from "@workspace/api-client-react";

import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
  EmptyState, Notification, Panel, PrimaryButton, Skeleton, StatCard,
} from "@/components/design-system";
import { HoverCard, PageTransition } from "@/components/design-system/animation";

const CHART_COLORS = [
  "var(--chart-primary)",
  "var(--chart-secondary)",
  "var(--chart-success)",
  "var(--chart-danger)",
  "var(--chart-accent)",
  "var(--chart-warning)",
];

const CustomBarTooltip = ({ active, payload, label }: any) => {
  if (active && payload?.length) {
    return (
      <div className="bg-card border-2 border-border px-3 py-2 text-sm shadow-lg">
        <p className="font-bold">{label}</p>
        <p className="text-primary">{payload[0].value} events</p>
      </div>
    );
  }
  return null;
};

const CustomPieTooltip = ({ active, payload }: any) => {
  if (active && payload?.length) {
    return (
      <div className="bg-card border-2 border-border px-3 py-2 text-sm shadow-lg">
        <p className="font-bold capitalize">{payload[0].name}</p>
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

  // Build 7-day activity bar chart data
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

  // Build status donut data
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
    <PageTransition className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back, <span className="font-semibold text-foreground">{profile?.contactName || profile?.companyName}</span>.
          </p>
        </div>
        <div className="flex gap-3">
          {isCustomer && (
            <Link href="/requests/new">
              <PrimaryButton className="h-10 px-5 shadow-sm" data-testid="button-new-request">
                <Plus className="mr-2 h-4 w-4" />
                Post Job Request
              </PrimaryButton>
            </Link>
          )}
          {isProvider && (
            <Link href="/requests">
              <PrimaryButton className="h-10 px-5 shadow-sm" data-testid="button-browse-jobs">
                <Truck className="mr-2 h-4 w-4" />
                Browse Open Jobs
              </PrimaryButton>
            </Link>
          )}
        </div>
      </div>

      {/* Compliance Warning */}
      {accountStatus && !canOperate && (
        <Notification title="Action Required" intent="warning" icon={<ShieldAlert className="h-4 w-4 text-warning" />}>
          {isProvider
            ? "Complete your W-9 and insurance verification to start bidding on jobs."
            : "Complete your profile to post job requests."}
          {" "}
          <Link href="/account">
            <span className="underline font-semibold cursor-pointer">Go to Account →</span>
          </Link>
        </Notification>
      )}

      {/* Stat Cards */}
      {statsLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-[110px] w-full rounded-none" />)}
        </div>
      ) : stats ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {isCustomer && (
            <StatCard title="Open Requests" value={stats.openRequests ?? 0} icon={AlertCircle} />
          )}
          <StatCard title="Active Jobs" value={stats.activeJobs ?? 0} icon={Activity} />
          {isProvider && (
            <>
              <StatCard title="Pending Bids" value={stats.pendingBids ?? 0} icon={TrendingUp} />
              <StatCard
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
              <StatCard title="Completed Jobs" value={stats.completedJobs ?? 0} icon={CheckCircle2} />
              <StatCard
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

      {/* Charts Row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        {/* Activity Bar Chart */}
        <Card className="rounded-none border-2 col-span-full lg:col-span-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold">Activity — Last 7 Days</CardTitle>
            <CardDescription>Platform events recorded on your account</CardDescription>
          </CardHeader>
          <CardContent>
            {activityLoading ? (
              <Skeleton className="h-[180px] w-full rounded-none" />
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={barData} barCategoryGap="35%">
                  <XAxis
                    dataKey="name"
                    tick={{ fill: "hsl(var(--muted-foreground))" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fill: "hsl(var(--muted-foreground))" }}
                    axisLine={false}
                    tickLine={false}
                    width={24}
                  />
                  <Tooltip content={<CustomBarTooltip />} cursor={{ fill: "hsl(var(--primary) / 0.08)" }} />
                  <Bar dataKey="events" fill="var(--chart-primary)" radius={[2, 2, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Status Donut */}
        <Card className="rounded-none border-2 col-span-full lg:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold">Job Status Breakdown</CardTitle>
            <CardDescription>Distribution across all your jobs</CardDescription>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-[180px] w-full rounded-none" />
            ) : hasChartData ? (
              <ResponsiveContainer width="100%" height={180}>
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
              <div className="flex flex-col items-center justify-center h-[180px] text-muted-foreground">
                <EmptyState
                  className="h-full border-0 bg-transparent p-0"
                  icon={<CircleCheck className="h-10 w-10 opacity-20" />}
                  title="No job data yet"
                  description="Post or bid on a job to see stats"
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row: Activity + Quick Actions */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        {/* Recent Activity */}
        <Card className="rounded-none border-2 col-span-full lg:col-span-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold">Recent Activity</CardTitle>
            <CardDescription>Latest actions on your account</CardDescription>
          </CardHeader>
          <CardContent>
            {activityLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : activities && activities.length > 0 ? (
              <div className="space-y-1">
                {activities.slice(0, 8).map((activity) => {
                  const isFailure = activity.type === "payment_failed" || activity.type === "application_rejected";
                  // Recoverable: bank needs the customer to confirm their card. Not
                  // a hard failure, so it gets its own amber treatment, not red.
                  const isActionNeeded = activity.type === "payment_requires_action" || activity.type === "payout_delayed";
                  const isApproved = activity.type === "application_approved";
                  // Bin order status updates (confirmed/delivered/picked_up/cancelled)
                  // deep-link back to the order on the Bins page via relatedBinOrderId.
                  const isBin = activity.type.startsWith("bin_");
                  const dotClass = isFailure
                    ? "bg-destructive"
                    : isActionNeeded
                      ? "bg-warning"
                      : isApproved
                        ? "bg-success"
                        : isBin
                          ? "bg-accent"
                          : "bg-primary";
                  const textClass = isFailure
                    ? "text-destructive"
                    : isActionNeeded
                      ? "text-warning"
                      : isApproved
                        ? "text-success"
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
                  const className = "flex items-center gap-4 py-2.5 px-3 hover:bg-muted/40 transition-colors border-b border-border/40 last:border-0";
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
              <EmptyState
                className="border-0 bg-transparent py-10"
                icon={<Activity className="h-8 w-8 opacity-20" />}
                title="No recent activity"
              />
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className="rounded-none border-2 col-span-full lg:col-span-3">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <Panel className="space-y-2">
            {isCustomer && (
              <>
                <Link href="/requests/new">
                  <HoverCard className="flex items-center justify-between p-3.5 border-2 border-border hover:border-primary cursor-pointer transition-all group bg-card hover:bg-primary/5">
                    <div className="flex items-center gap-3">
                      <Plus className="h-4 w-4 text-primary" />
                      <span className="font-semibold text-sm">Post a new request</span>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                  </HoverCard>
                </Link>
                <Link href="/requests">
                  <HoverCard className="flex items-center justify-between p-3.5 border-2 border-border hover:border-primary cursor-pointer transition-all group bg-card hover:bg-primary/5">
                    <div className="flex items-center gap-3">
                      <ClipboardList className="h-4 w-4 text-primary" />
                      <span className="font-semibold text-sm">Review open bids</span>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                  </HoverCard>
                </Link>
                <Link href="/jobs">
                  <HoverCard className="flex items-center justify-between p-3.5 border-2 border-border hover:border-primary cursor-pointer transition-all group bg-card hover:bg-primary/5">
                    <div className="flex items-center gap-3">
                      <Briefcase className="h-4 w-4 text-primary" />
                      <span className="font-semibold text-sm">Track active jobs</span>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                  </HoverCard>
                </Link>
              </>
            )}
            {isProvider && (
              <>
                <Link href="/requests">
                  <HoverCard className="flex items-center justify-between p-3.5 border-2 border-border hover:border-primary cursor-pointer transition-all group bg-card hover:bg-primary/5">
                    <div className="flex items-center gap-3">
                      <Truck className="h-4 w-4 text-primary" />
                      <span className="font-semibold text-sm">Find new jobs</span>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                  </HoverCard>
                </Link>
                <Link href="/fleet/new">
                  <HoverCard className="flex items-center justify-between p-3.5 border-2 border-border hover:border-primary cursor-pointer transition-all group bg-card hover:bg-primary/5">
                    <div className="flex items-center gap-3">
                      <Plus className="h-4 w-4 text-primary" />
                      <span className="font-semibold text-sm">Add a truck to fleet</span>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                  </HoverCard>
                </Link>
                <Link href="/jobs">
                  <HoverCard className="flex items-center justify-between p-3.5 border-2 border-border hover:border-primary cursor-pointer transition-all group bg-card hover:bg-primary/5">
                    <div className="flex items-center gap-3">
                      <Briefcase className="h-4 w-4 text-primary" />
                      <span className="font-semibold text-sm">Active jobs</span>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                  </HoverCard>
                </Link>
                <Link href="/account">
                  <HoverCard className="flex items-center justify-between p-3.5 border-2 border-border hover:border-primary cursor-pointer transition-all group bg-card hover:bg-primary/5">
                    <div className="flex items-center gap-3">
                      <ShieldAlert className="h-4 w-4 text-primary" />
                      <span className="font-semibold text-sm">Compliance status</span>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                  </HoverCard>
                </Link>
              </>
            )}
            </Panel>
          </CardContent>
        </Card>
      </div>
    </PageTransition>
  );
}

