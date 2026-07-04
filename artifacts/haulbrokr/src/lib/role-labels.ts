/** Human-readable role labels for navigation, headers, and profile surfaces */

export const ROLE_LABELS: Record<string, string> = {
  customer: "Contractor",
  provider: "Fleet Owner",
  driver: "Driver",
  supervisor: "Site Supervisor",
};

export function getRoleLabel(role?: string | null): string {
  if (!role) return "Member";
  return ROLE_LABELS[role] ?? role.replace(/_/g, " ");
}

/** Mobile bottom nav — role-prioritized tabs (max 5) */
export const MOBILE_NAV_PRIORITY: Record<string, string[]> = {
  customer: ["/dashboard", "/requests", "/jobs", "/map", "/account"],
  provider: ["/dashboard", "/requests", "/jobs", "/fleet", "/account"],
  driver: ["/dashboard", "/jobs", "/map", "/account"],
  default: ["/dashboard", "/requests", "/jobs", "/map", "/account"],
};

/** Short labels for compact mobile tab bar */
export const MOBILE_NAV_SHORT: Record<string, string> = {
  "/dashboard": "Home",
  "/requests": "Loads",
  "/fleet": "Fleet",
  "/dispatch": "Dispatch",
  "/jobs": "Jobs",
  "/map": "Map",
  "/projects": "Projects",
  "/company": "Company",
  "/factoring": "Payouts",
  "/bins": "Bins",
  "/integrations": "Integrate",
  "/admin": "Admin",
  "/account": "Account",
};
