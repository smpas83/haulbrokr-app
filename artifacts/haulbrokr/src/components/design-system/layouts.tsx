import type { ReactNode } from "react";

import { Layout } from "@/components/layout";
import { cn } from "@/lib/utils";

function PublicLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

function DashboardLayout({ children }: { children: ReactNode }) {
  return <Layout>{children}</Layout>;
}

const CustomerDashboardLayout = DashboardLayout;
const DriverDashboardLayout = DashboardLayout;
const DispatcherDashboardLayout = DashboardLayout;
const FleetDashboardLayout = DashboardLayout;

function AdminDashboardLayout({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <main className={cn("space-y-6 max-w-5xl mx-auto", className)}>{children}</main>;
}

function MobileLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export {
  PublicLayout,
  CustomerDashboardLayout,
  DriverDashboardLayout,
  DispatcherDashboardLayout,
  FleetDashboardLayout,
  AdminDashboardLayout,
  MobileLayout,
};
