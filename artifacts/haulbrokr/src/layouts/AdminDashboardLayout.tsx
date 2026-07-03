import type { ReactNode } from "react";
import { Layout } from "@/components/layout";

/** Admin dashboard — reuses the authenticated app shell. */
export function AdminDashboardLayout({ children }: { children: ReactNode }) {
  return <Layout>{children}</Layout>;
}
