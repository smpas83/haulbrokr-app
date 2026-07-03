import type { ReactNode } from "react";
import { Layout } from "@/components/layout";

/** Customer dashboard — reuses the authenticated app shell. */
export function CustomerDashboardLayout({ children }: { children: ReactNode }) {
  return <Layout>{children}</Layout>;
}
