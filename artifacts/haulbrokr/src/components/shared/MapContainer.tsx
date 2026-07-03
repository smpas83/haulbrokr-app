import { memo, type ReactNode } from "react";
import {
  CloudRain, Layers, MapPin, Navigation, Radio, Route, Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface MapContainerProps {
  title?: string;
  subtitle?: string;
  height?: string | number;
  className?: string;
  children?: ReactNode;
  /** PLACEHOLDER: Live GPS overlay — awaiting ChatGPT visual package */
  showGpsPlaceholder?: boolean;
  /** PLACEHOLDER: Marker cluster layer — awaiting ChatGPT visual package */
  showMarkersPlaceholder?: boolean;
  /** PLACEHOLDER: Route polyline layer — awaiting ChatGPT visual package */
  showRoutesPlaceholder?: boolean;
}

function MapContainerInner({
  title = "Marketplace map",
  subtitle,
  height = 320,
  className,
  children,
  showGpsPlaceholder = true,
  showMarkersPlaceholder = true,
  showRoutesPlaceholder = true,
}: MapContainerProps) {
  const h = typeof height === "number" ? `${height}px` : height;

  return (
    <section
      className={cn("relative overflow-hidden rounded-none border-2 bg-muted/30", className)}
      style={{ minHeight: h }}
      aria-label={title}
    >
      {/* PLACEHOLDER: Google Maps / Mapbox integration — reuse existing MapContainer when live GPS ships */}
      <div
        className="absolute inset-0 bg-gradient-to-br from-muted via-background to-muted/60"
        aria-hidden="true"
      />
      <div className="relative z-10 flex h-full min-h-[inherit] flex-col">
        <div className="border-b bg-background/80 px-4 py-3 backdrop-blur-sm">
          <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            <MapPin className="h-4 w-4 text-primary" aria-hidden="true" />
            {title}
          </div>
          {subtitle ? <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p> : null}
        </div>

        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
          {children ?? (
            <>
              <Navigation className="h-10 w-10 text-muted-foreground/40" aria-hidden="true" />
              <p className="text-sm font-medium text-muted-foreground max-w-sm">
                Map view placeholder — live GPS, markers, routes, traffic, weather, geofence, clusters, and ETA layers will render here.
              </p>
            </>
          )}

          <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
            {showGpsPlaceholder && (
              <span className="inline-flex items-center gap-1 rounded-none border px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                <Radio className="h-3 w-3" /> Live GPS
              </span>
            )}
            {showMarkersPlaceholder && (
              <span className="inline-flex items-center gap-1 rounded-none border px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                <Layers className="h-3 w-3" /> Markers
              </span>
            )}
            {showRoutesPlaceholder && (
              <span className="inline-flex items-center gap-1 rounded-none border px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                <Route className="h-3 w-3" /> Routes
              </span>
            )}
            <span className="inline-flex items-center gap-1 rounded-none border px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              <CloudRain className="h-3 w-3" /> Weather
            </span>
            <span className="inline-flex items-center gap-1 rounded-none border px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              <Shield className="h-3 w-3" /> Geofence
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

export const MapContainer = memo(MapContainerInner);
