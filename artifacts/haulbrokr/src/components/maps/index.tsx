import { mapColor } from "@workspace/design-tokens";
import { cn } from "@/lib/utils";

export interface MapMarkerProps {
  label?: string;
  className?: string;
}

export function TruckMarker({ label, className }: MapMarkerProps) {
  return (
    <div
      className={cn("rounded-full px-2 py-1 text-xs font-medium text-white", className)}
      style={{ backgroundColor: mapColor.truck }}
    >
      {label ?? "Truck"}
    </div>
  );
}

export function DriverMarker({ label, className }: MapMarkerProps) {
  return (
    <div
      className={cn("rounded-full px-2 py-1 text-xs font-medium text-white", className)}
      style={{ backgroundColor: mapColor.driver }}
    >
      {label ?? "Driver"}
    </div>
  );
}

export function JobMarker({ label, className }: MapMarkerProps) {
  return (
    <div
      className={cn("rounded-full px-2 py-1 text-xs font-medium text-foreground", className)}
      style={{ backgroundColor: mapColor.job }}
    >
      {label ?? "Job"}
    </div>
  );
}

export interface RoutePolylineProps {
  className?: string;
}

export function RoutePolyline({ className }: RoutePolylineProps) {
  return (
    <svg className={cn("absolute inset-0 pointer-events-none", className)} aria-hidden>
      <line x1="0" y1="50%" x2="100%" y2="50%" stroke={mapColor.route} strokeWidth="2" strokeDasharray="4 4" />
    </svg>
  );
}

export interface ETAOverlayProps {
  eta: string;
  className?: string;
}

export function ETAOverlay({ eta, className }: ETAOverlayProps) {
  return (
    <div
      className={cn("rounded-md px-3 py-1.5 text-xs font-medium text-white shadow-sm", className)}
      style={{ backgroundColor: mapColor.eta }}
    >
      ETA {eta}
    </div>
  );
}

export interface MapLayerProps {
  children?: React.ReactNode;
  className?: string;
}

export function FleetLayer({ children, className }: MapLayerProps) {
  return <div className={cn("absolute inset-0", className)} data-layer="fleet">{children}</div>;
}

export function CustomerLayer({ children, className }: MapLayerProps) {
  return <div className={cn("absolute inset-0", className)} data-layer="customer">{children}</div>;
}
