/** Color for each project type badge */
export const TYPE_COLOR: Record<string, string> = {
  Transport: "#3b82f6",
  "Material & Transport": "#8b5cf6",
  Tracking: "#f59e0b",
  Recycling: "#16a34a",
};

/** Color for each job status indicator */
export const STATUS_COLOR: Record<string, string> = {
  open: "#e9a600",
  bidding: "#3b82f6",
  in_progress: "#16a34a",
  accepted: "#8b5cf6",
  completed: "#6b7280",
  cancelled: "#ef4444",
};

/** Icon for each material type */
export const MATERIAL_ICON: Record<string, string> = {
  "Dirt / Fill": "layers",
  "Concrete Debris": "square",
  "Asphalt Millings": "minus-square",
  "Rock & Gravel": "grid",
  "Demolition Debris": "trash-2",
  Sand: "triangle",
  Topsoil: "sun",
  "Scrap Metal": "tool",
};

/** Fixed accent colors used throughout the app */
export const ACCENT = {
  green: "#16a34a",
  blue: "#3b82f6",
  purple: "#8b5cf6",
  amber: "#f59e0b",
  red: "#ef4444",
  gray: "#6b7280",
} as const;
