import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";
import { CHART_COLORS } from "@/lib/design-tokens";
import type { OperationsCenterData } from "@/lib/operations-types";

interface ExecutiveAnalyticsPanelProps {
  analytics: OperationsCenterData["analytics"];
  isProvider: boolean;
}

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) => {
  if (active && payload?.length) {
    return (
      <div className="surface-panel rounded-lg px-3 py-2 text-sm">
        <p className="font-semibold">{label}</p>
        <p className="text-primary">{payload[0]?.value} events</p>
      </div>
    );
  }
  return null;
};

export function ExecutiveAnalyticsPanel({ analytics, isProvider }: ExecutiveAnalyticsPanelProps) {
  const kpis = [
    { label: "7d Revenue Forecast", value: `$${analytics.revenueForecast7d.toLocaleString()}` },
    { label: isProvider ? "7d Net Forecast" : "7d Spend Forecast", value: `$${analytics.marginForecast7d.toLocaleString()}` },
    { label: "Fleet Utilization", value: `${analytics.fleetUtilization}%` },
    ...(isProvider && analytics.vendorScore != null
      ? [{ label: "Vendor Score", value: `${analytics.vendorScore}` }]
      : []),
    ...(!isProvider && analytics.customerLifetimeValue > 0
      ? [{ label: "Lifetime Value", value: `$${analytics.customerLifetimeValue.toLocaleString()}` }]
      : []),
    ...(analytics.driverScore != null ? [{ label: "Driver Score", value: `${analytics.driverScore}` }] : []),
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {kpis.map((k) => (
          <div key={k.label} className="surface-panel rounded-xl p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{k.label}</p>
            <p className="text-xl font-bold stat-number mt-1">{k.value}</p>
          </div>
        ))}
      </div>

      {analytics.weeklyEvents.some((d) => d.count > 0) && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Activity — Last 7 Days</p>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={analytics.weeklyEvents} barCategoryGap="35%">
              <XAxis dataKey="label" tick={{ fill: "hsl(240 4% 55%)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fill: "hsl(240 4% 55%)", fontSize: 10 }} axisLine={false} tickLine={false} width={20} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "hsl(217 91% 60% / 0.08)" }} />
              <Bar dataKey="count" fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} maxBarSize={32} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {analytics.regionalDemand.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Regional Demand</p>
          <div className="space-y-2">
            {analytics.regionalDemand.map((r) => (
              <div key={r.region} className="flex items-center gap-3">
                <span className="text-xs font-semibold w-8">{r.region}</span>
                <div className="flex-1 h-2 rounded-full bg-muted/50 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${Math.min(100, r.jobCount * 20)}%` }}
                  />
                </div>
                <span className="text-xs text-muted-foreground w-16 text-right">
                  {r.jobCount} {r.trend >= 0 ? "↑" : "↓"}{Math.abs(r.trend)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
