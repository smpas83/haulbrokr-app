/** Domain-specific semantic color mappings. */
export const statusColor = {
  open: "#e9a600",
  bidding: "#3b82f6",
  in_progress: "#16a34a",
  accepted: "#8b5cf6",
  completed: "#6b7280",
  cancelled: "#ef4444",
} as const;

export const typeColor = {
  Transport: "#3b82f6",
  "Material & Transport": "#8b5cf6",
  Tracking: "#f59e0b",
  Recycling: "#16a34a",
} as const;

export const accentColor = {
  green: "#16a34a",
  blue: "#3b82f6",
  purple: "#8b5cf6",
  amber: "#f59e0b",
  red: "#ef4444",
  gray: "#6b7280",
} as const;

export const mapColor = {
  truck: "#3b82f6",
  driver: "#16a34a",
  job: "#e9a600",
  route: "#FF6A00",
  eta: "#8b5cf6",
  fleet: "#3b82f6",
  customer: "#f59e0b",
} as const;
