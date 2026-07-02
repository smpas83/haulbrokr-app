import type { ReactNode } from "react";
import { Layout } from "@/components/layout";

/** Driver dashboard — reuses the authenticated app shell. */
export function DriverDashboardLayout({ children }: { children: ReactNode }) {
  return <Layout>{children}</Layout>;
}
