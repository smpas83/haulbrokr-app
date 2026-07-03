import { useMemo } from "react";
import { Link } from "wouter";
import { format, subDays, parseISO } from "date-fns";
import {
  ArrowRight, Activity, Plus, Truck,
  CircleCheck, TrendingUp,
  ShieldAlert, ArrowUpRight, Briefcase
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from "recharts";
import {
  useGetDashboardStats, useGetDashboardActivity,
  useGetMyProfile, useGetAccountStatus,
  type UserProfile,
} from "@workspace/api-client-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import CustomerDashboard from "@/pages/customer/CustomerDashboard";

const AMBER = "#e9a800";
const CHART_COLORS = [AMBER, "#3b82f6", "#22c55e", "#ef4444", "#8b5cf6", "#f97316"];

function StatCard({
  title, value, icon: Icon, accent, sub
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  accent?: boolean;
  sub?: string;
}) {
  return (
    <Card className={`rounded-none border-2 ${accent ? "border-primary/30 bg-primary/5" : ""}`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className={`text-sm font-semibold uppercase tracking-wider ${accent ? "text-primary" : "text-muted-foreground"}`}>
          {title}
        </CardTitle>
        <Icon className={`h-4 w-4 ${accent ? "text-primary" : "text-muted-foreground"}`} />
      </CardHeader>
      <CardContent>
        <div className={`text-3xl font-black tracking-tight ${accent ? "text-primary" : ""}`}>{value}</div>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

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

  if (profile?.role === "customer") {
    return <CustomerDashboard />;
  }

  return <StandardDashboard profile={profile} />;
}

function StandardDashboard({ profile }: { profile?: UserProfile | null }) {
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
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back, <span className="font-semibold text-foreground">{profile?.contactName || profile?.companyName}</span>.
          </p>
        </div>
        <div className="flex gap-3">
          {isProvider && (
            <Link href="/requests">
              <Button className="h-10 px-5 font-bold shadow-sm rounded-none" data-testid="button-browse-jobs">
                <Truck className="mr-2 h-4 w-4" />
                Browse Open Jobs
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Compliance Warning */}
      {accountStatus && !canOperate && (
        <Alert className="rounded-none border-2 border-amber-500/50 bg-amber-500/10">
          <ShieldAlert className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-amber-700 font-bold">Action Required</AlertTitle>
          <AlertDescription className="text-amber-700/80">
            Complete your W-9 and insurance verification to start bidding on jobs.
            {" "}
            <Link href="/account">
              <span className="underline font-semibold cursor-pointer">Go to Account →</span>
            </Link>
          </AlertDescription>
        </Alert>
      )}

      {/* Stat Cards */}
      {statsLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-[110px] w-full rounded-none" />)}
        </div>
      ) : stats ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
                    tick={{ fill: "#6b7280", fontSize: 12, fontWeight: 600 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fill: "#6b7280", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    width={24}
                  />
                  <Tooltip content={<CustomBarTooltip />} cursor={{ fill: "rgba(233,168,0,0.08)" }} />
                  <Bar dataKey="events" fill={AMBER} radius={[2, 2, 0, 0]} maxBarSize={40} />
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
                <CircleCheck className="h-10 w-10 mb-3 opacity-20" />
                <p className="text-sm">No job data yet</p>
                <p className="text-xs mt-1">Post or bid on a job to see stats</p>
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
                  const isActionNeeded = activity.type === "payment_requires_action" || activity.type === "payout_delayed";
                  const isApproved = activity.type === "application_approved";
                  const isBin = activity.type.startsWith("bin_");
                  const dotClass = isFailure
                    ? "bg-destructive"
                    : isActionNeeded
                      ? "bg-amber-500"
                      : isApproved
                        ? "bg-green-500"
                        : isBin
                          ? "bg-violet-500"
                          : "bg-primary";
                  const textClass = isFailure
                    ? "text-destructive"
                    : isActionNeeded
                      ? "text-amber-600 dark:text-amber-400"
                      : isApproved
                        ? "text-green-600 dark:text-green-400"
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
                        <ArrowUpRight className={`h-4 w-4 flex-shrink-0 ${isFailure ? "text-destructive" : isActionNeeded ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`} />
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
              <div className="text-center py-10 text-muted-foreground">
                <Activity className="mx-auto h-8 w-8 mb-3 opacity-20" />
                <p className="text-sm">No recent activity</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className="rounded-none border-2 col-span-full lg:col-span-3">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {isProvider && (
              <>
                <Link href="/requests">
                  <div className="flex items-center justify-between p-3.5 border-2 border-border hover:border-primary cursor-pointer transition-all group bg-card hover:bg-primary/5">
                    <div className="flex items-center gap-3">
                      <Truck className="h-4 w-4 text-primary" />
                      <span className="font-semibold text-sm">Find new jobs</span>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                  </div>
                </Link>
                <Link href="/fleet/new">
                  <div className="flex items-center justify-between p-3.5 border-2 border-border hover:border-primary cursor-pointer transition-all group bg-card hover:bg-primary/5">
                    <div className="flex items-center gap-3">
                      <Plus className="h-4 w-4 text-primary" />
                      <span className="font-semibold text-sm">Add a truck to fleet</span>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                  </div>
                </Link>
                <Link href="/jobs">
                  <div className="flex items-center justify-between p-3.5 border-2 border-border hover:border-primary cursor-pointer transition-all group bg-card hover:bg-primary/5">
                    <div className="flex items-center gap-3">
                      <Briefcase className="h-4 w-4 text-primary" />
                      <span className="font-semibold text-sm">Active jobs</span>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                  </div>
                </Link>
                <Link href="/account">
                  <div className="flex items-center justify-between p-3.5 border-2 border-border hover:border-primary cursor-pointer transition-all group bg-card hover:bg-primary/5">
                    <div className="flex items-center gap-3">
                      <ShieldAlert className="h-4 w-4 text-primary" />
                      <span className="font-semibold text-sm">Compliance status</span>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                  </div>
                </Link>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
