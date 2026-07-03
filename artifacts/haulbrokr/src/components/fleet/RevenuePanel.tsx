import { lazy, memo, Suspense } from "react";
import { DollarSign } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AsyncSection } from "@/components/shared";
import { formatCurrency } from "@/lib/fleetDashboardView";

export interface FleetRevenueData {
  todaysRevenue: number;
  weeklyRevenue: number;
  monthlyRevenue: number;
  avgRevenuePerTruck: number;
  completedLoads: number;
  avgDriverEarnings: string;
  outstandingPayments: number;
  pendingInvoices: number;
}

interface RevenuePanelProps {
  revenue: FleetRevenueData;
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
}

function RevenueContent({ revenue }: { revenue: FleetRevenueData }) {
  const rows = [
    { label: "Today's Revenue", value: formatCurrency(revenue.todaysRevenue), accent: true },
    { label: "Weekly Revenue", value: formatCurrency(revenue.weeklyRevenue) },
    { label: "Monthly Revenue", value: formatCurrency(revenue.monthlyRevenue) },
    { label: "Avg Revenue / Truck", value: formatCurrency(revenue.avgRevenuePerTruck) },
    { label: "Completed Loads", value: revenue.completedLoads.toString() },
    { label: "Avg Driver Earnings", value: revenue.avgDriverEarnings, placeholder: true },
    { label: "Outstanding Payments", value: formatCurrency(revenue.outstandingPayments), accent: revenue.outstandingPayments > 0 },
    { label: "Pending Invoices", value: revenue.pendingInvoices.toString(), accent: revenue.pendingInvoices > 0 },
  ];

  return (
    <dl className="space-y-2">
      {rows.map((row) => (
        <div key={row.label} className="flex items-center justify-between py-2 border-b border-border/40 last:border-0">
          <dt className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{row.label}</dt>
          <dd className={`text-sm font-black tabular-nums ${row.accent ? "text-primary" : ""}`}>
            {row.value}
            {row.placeholder && (
              <span className="sr-only"> — PLACEHOLDER: per-driver earnings API pending</span>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

const LazyRevenueContent = lazy(async () => ({
  default: RevenueContent,
}));

export const RevenuePanel = memo(function RevenuePanel({
  revenue,
  isLoading,
  isError,
  onRetry,
}: RevenuePanelProps) {
  return (
    <Card className="rounded-none border-2 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-bold flex items-center gap-2">
          <DollarSign className="h-4 w-4" aria-hidden="true" />
          Revenue
        </CardTitle>
        <CardDescription>Earnings, loads, and payment status from existing APIs</CardDescription>
      </CardHeader>
      <CardContent>
        <AsyncSection
          isLoading={isLoading}
          isError={isError}
          onRetry={onRetry}
          skeletonHeight="h-48"
        >
          <Suspense fallback={null}>
            <LazyRevenueContent revenue={revenue} />
          </Suspense>
        </AsyncSection>
      </CardContent>
    </Card>
  );
});
