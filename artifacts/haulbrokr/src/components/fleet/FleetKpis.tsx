import { memo } from "react";
import {
  Activity, CheckCircle2, DollarSign, Percent, ShieldCheck, Truck, Users,
} from "lucide-react";
import { StatCard } from "@/components/shared";
import { formatCurrency } from "@/lib/fleetDashboardView";

export interface FleetKpiData {
  fleetSize: number;
  driversOnline: number;
  availableTrucks: number;
  activeJobs: number;
  completedToday: number;
  todaysRevenue: number;
  fleetUtilization: number;
  complianceScore: string;
}

interface FleetKpisProps {
  kpis: FleetKpiData;
  isLoading?: boolean;
}

export const FleetKpis = memo(function FleetKpis({ kpis, isLoading }: FleetKpisProps) {
  return (
    <section aria-label="Fleet KPIs" className="grid gap-3 grid-cols-2 md:grid-cols-4 xl:grid-cols-8">
      <StatCard title="Fleet Size" value={kpis.fleetSize} icon={Truck} loading={isLoading} accent />
      <StatCard title="Drivers Online" value={kpis.driversOnline} icon={Users} loading={isLoading} />
      <StatCard title="Available Trucks" value={kpis.availableTrucks} icon={Truck} loading={isLoading} />
      <StatCard title="Active Jobs" value={kpis.activeJobs} icon={Activity} loading={isLoading} accent={kpis.activeJobs > 0} />
      <StatCard title="Completed Today" value={kpis.completedToday} icon={CheckCircle2} loading={isLoading} />
      <StatCard title="Today's Revenue" value={formatCurrency(kpis.todaysRevenue)} icon={DollarSign} loading={isLoading} accent />
      <StatCard title="Fleet Utilization" value={`${kpis.fleetUtilization}%`} icon={Percent} loading={isLoading} />
      <StatCard title="Compliance Score" value={kpis.complianceScore} icon={ShieldCheck} loading={isLoading} />
    </section>
  );
});
