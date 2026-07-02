import type { ReactNode } from "react";
import { Layout } from "@/components/layout";

/** Fleet dashboard — reuses the authenticated app shell. */
export function FleetDashboardLayout({ children }: { children: ReactNode }) {
  return <Layout>{children}</Layout>;
}
