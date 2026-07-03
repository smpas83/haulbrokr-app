import { memo } from "react";
import {
  Truck, Users, Activity, Clock, DollarSign, Package, Timer, FileCheck,
} from "lucide-react";
import { StatCard } from "@/components/shared";

interface DispatcherKpisProps {
  kpis: {
    availableTrucks: number;
    driversOnline: number;
    activeJobs: number;
    pendingDispatch: number;
    revenueToday: number;
    loadsToday: number;
    averageEta: string;
    paperworkCompletion: string;
  };
  isLoading?: boolean;
}

export const DispatcherKpis = memo(function DispatcherKpis({ kpis, isLoading }: DispatcherKpisProps) {
  return (
    <section aria-label="Today's KPIs">
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
        <StatCard title="Available Trucks" value={kpis.availableTrucks} icon={Truck} loading={isLoading} />
        <StatCard title="Drivers Online" value={kpis.driversOnline} icon={Users} loading={isLoading} />
        <StatCard title="Active Jobs" value={kpis.activeJobs} icon={Activity} accent loading={isLoading} />
        <StatCard title="Pending Dispatch" value={kpis.pendingDispatch} icon={Clock} loading={isLoading} />
        <StatCard
          title="Revenue Today"
          value={typeof kpis.revenueToday === "number" ? `$${kpis.revenueToday.toLocaleString()}` : kpis.revenueToday}
          icon={DollarSign}
          loading={isLoading}
        />
        <StatCard title="Loads Today" value={kpis.loadsToday} icon={Package} loading={isLoading} />
        <StatCard title="Average ETA" value={kpis.averageEta} icon={Timer} loading={isLoading} />
        <StatCard title="Paperwork" value={kpis.paperworkCompletion} icon={FileCheck} loading={isLoading} />
      </div>
    </section>
  );
});
