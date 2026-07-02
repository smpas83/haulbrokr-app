import type { ReactNode } from "react";
import { Layout } from "@/components/layout";

/** Dispatcher command center — reuses the authenticated app shell. */
export function DispatcherDashboardLayout({ children }: { children: ReactNode }) {
  return <Layout>{children}</Layout>;
}
