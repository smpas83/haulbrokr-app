import { memo } from "react";
import {
  Activity, CheckCircle2, Clock, FileText, MapPin, Percent, Truck, Weight,
} from "lucide-react";
import { StatCard } from "@/components/shared";

export interface CustomerKpiData {
  activeJobs: number;
  trucksEnRoute: number;
  completedToday: number;
  tonsDelivered: number;
  openInvoices: number;
  averageEta: string;
  activeFacilities: number;
  onTimeDelivery: string;
}

interface CustomerKpisProps {
  kpis: CustomerKpiData;
  isLoading?: boolean;
}

export const CustomerKpis = memo(function CustomerKpis({ kpis, isLoading }: CustomerKpisProps) {
  return (
    <section aria-label="Operations KPIs" className="grid gap-3 grid-cols-2 md:grid-cols-4 xl:grid-cols-8">
      <StatCard title="Active Jobs" value={kpis.activeJobs} icon={Activity} loading={isLoading} accent />
      <StatCard title="Trucks En Route" value={kpis.trucksEnRoute} icon={Truck} loading={isLoading} />
      <StatCard title="Completed Today" value={kpis.completedToday} icon={CheckCircle2} loading={isLoading} />
      <StatCard title="Tons Delivered" value={kpis.tonsDelivered} icon={Weight} loading={isLoading} sub="PLACEHOLDER: tonnage API" />
      <StatCard title="Open Invoices" value={kpis.openInvoices} icon={FileText} loading={isLoading} accent={kpis.openInvoices > 0} />
      <StatCard title="Average ETA" value={kpis.averageEta} icon={Clock} loading={isLoading} sub="PLACEHOLDER: ETA API" />
      <StatCard title="Active Facilities" value={kpis.activeFacilities} icon={MapPin} loading={isLoading} />
      <StatCard title="On-Time Delivery" value={kpis.onTimeDelivery} icon={Percent} loading={isLoading} />
    </section>
  );
});
