/** Shared design tokens — single source of truth for the HaulBrokr design system */

export const BRAND = {
  primary: "hsl(217 91% 60%)",
  accent: "hsl(24 95% 53%)",
  background: "hsl(240 6% 4%)",
  card: "hsl(240 5% 8%)",
  border: "hsl(240 4% 16%)",
  muted: "hsl(240 4% 55%)",
  success: "hsl(160 84% 39%)",
  warning: "hsl(38 92% 50%)",
  destructive: "hsl(0 72% 51%)",
  info: "hsl(187 85% 48%)",
} as const;

export const CHART_COLORS = [
  BRAND.primary,
  BRAND.accent,
  BRAND.success,
  BRAND.warning,
  BRAND.destructive,
  "hsl(262 83% 58%)",
] as const;

/** Dark-first status chip classes — use via StatusChip or getStatusColor() */
export const STATUS_COLORS: Record<string, string> = {
  open: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  bid_received: "bg-sky-500/15 text-sky-400 border-sky-500/30",
  bidding: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  awarded: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  accepted: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  active: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  in_progress: "bg-violet-500/15 text-violet-400 border-violet-500/30",
  completed: "bg-muted text-muted-foreground border-border",
  cancelled: "bg-red-500/15 text-red-400 border-red-500/30",
  declined: "bg-red-500/15 text-red-400 border-red-500/30",
  pending: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  confirmed: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  approved: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  funded: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  settled: "bg-muted text-muted-foreground border-border",
  denied: "bg-red-500/15 text-red-400 border-red-500/30",
  delivered: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  picked_up: "bg-muted text-muted-foreground border-border",
  on_hold: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  released: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  rejected: "bg-red-500/15 text-red-400 border-red-500/30",
  verified: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  connected: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  disconnected: "bg-muted text-muted-foreground border-border",
  available: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  assigned: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  en_route: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  loading: "bg-violet-500/15 text-violet-400 border-violet-500/30",
  dispatched: "bg-blue-500/15 text-blue-400 border-blue-500/30",
};

export function getStatusColor(status: string): string {
  return STATUS_COLORS[status] ?? "bg-muted text-muted-foreground border-border";
}

/** Map marker and heat zone colors aligned with brand palette */
export const MAP_COLORS: Record<string, string> = {
  open: "#3B82F6",
  bidding: "#F59E0B",
  bid_received: "#3B82F6",
  accepted: "#10B981",
  in_progress: "#8B5CF6",
  available: "#10B981",
  assigned: "#3B82F6",
  en_route: "#FF6A00",
  heat: "#FF6A00",
  truck: "#10B981",
};

/** Google Maps dark industrial style — signature map experience */
export const MAP_DARK_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#0A0A0C" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#8B8B96" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0A0A0C" }] },
  { featureType: "administrative", elementType: "geometry.stroke", stylers: [{ color: "#27272A" }] },
  { featureType: "poi", elementType: "geometry", stylers: [{ color: "#141416" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#1A1A1E" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#1E1E22" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#27272A" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#27272A" }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#3B82F6" }, { lightness: -40 }] },
  { featureType: "transit", elementType: "geometry", stylers: [{ color: "#141416" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0A1628" }] },
] as const;

export const SPACING = {
  page: "p-4 md:p-8",
  section: "space-y-6",
  card: "p-6",
} as const;

export const TYPOGRAPHY = {
  display: "text-4xl md:text-5xl font-bold tracking-tight",
  headline: "text-3xl md:text-4xl font-bold tracking-tight",
  title: "text-xl font-semibold tracking-tight",
  label: "text-xs font-semibold uppercase tracking-wider text-muted-foreground",
  metric: "text-3xl md:text-4xl font-bold stat-number tracking-tight",
} as const;
