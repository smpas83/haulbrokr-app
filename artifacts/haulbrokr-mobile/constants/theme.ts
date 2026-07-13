/** Color for each project type badge */
export const TYPE_COLOR: Record<string, string> = {
  Transport: "#FF5500",
  "Material & Transport": "#8B5CF6",
  Tracking: "#F59E0B",
  Recycling: "#10B981",
};

/** Color for each job status indicator */
export const STATUS_COLOR: Record<string, string> = {
  open: "#FF5500",
  bidding: "#F59E0B",
  in_progress: "#8B5CF6",
  accepted: "#10B981",
  completed: "#71717A",
  cancelled: "#EF4444",
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

/** Fixed accent colors used throughout the app — neon fire orange primary */
export const ACCENT = {
  green: "#10B981",
  blue: "#3B82F6",
  purple: "#8B5CF6",
  amber: "#F59E0B",
  orange: "#FF5500",
  red: "#EF4444",
  gray: "#71717A",
} as const;
