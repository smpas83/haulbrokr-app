/** Shared design tokens for charts, status colors, and semantic UI */

export const CHART_COLORS = [
  "hsl(20 100% 50%)",  // neon fire orange
  "hsl(217 91% 60%)",  // electric blue (secondary chart)
  "hsl(160 84% 39%)",  // emerald
  "hsl(38 92% 50%)",   // amber
  "hsl(0 72% 51%)",    // red
  "hsl(262 83% 58%)",  // violet
] as const;

export const STATUS_COLORS: Record<string, string> = {
  open: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  bid_received: "bg-sky-500/15 text-sky-400 border-sky-500/30",
  bidding: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  awarded: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  accepted: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  active: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  in_progress: "bg-violet-500/15 text-violet-400 border-violet-500/30",
  completed: "bg-muted text-muted-foreground border-border",
  cancelled: "bg-red-500/15 text-red-400 border-red-500/30",
  declined: "bg-red-500/15 text-red-400 border-red-500/30",
};

export function getStatusColor(status: string): string {
  return STATUS_COLORS[status] ?? "bg-muted text-muted-foreground border-border";
}
