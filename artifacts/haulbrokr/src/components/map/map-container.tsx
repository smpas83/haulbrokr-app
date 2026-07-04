import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { loadGoogleMaps, MAP_DARK_STYLES } from "@/lib/google-maps";
import { MAP_STATUS_COLOR, type MarketplaceMapData } from "@/lib/map-types";

export type MapLayerToggles = {
  loads: boolean;
  trucks: boolean;
  heatZones: boolean;
};

interface MapContainerProps {
  data?: MarketplaceMapData;
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  className?: string;
  minHeight?: number;
  selectedTruckId?: number | null;
  /** PLACEHOLDER: live GPS stream — requires backend WebSocket endpoint */
  showLiveGps?: boolean;
  /** PLACEHOLDER: traffic overlay — requires Google Maps TrafficLayer + billing */
  showTraffic?: boolean;
  /** PLACEHOLDER: weather overlay — requires weather API integration */
  showWeather?: boolean;
  /** PLACEHOLDER: driver route polyline — requires route API */
  showDriverRoute?: boolean;
  /** PLACEHOLDER: geofence circles — requires facility geofence data */
  showGeofence?: boolean;
}

export function MapContainer({
  data,
  isLoading,
  isError,
  onRetry,
  className,
  minHeight = 480,
  selectedTruckId,
}: MapContainerProps) {
  const mapDivRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const overlaysRef = useRef<any[]>([]);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  useEffect(() => {
    loadGoogleMaps()
      .then(() => {
        if (!mapDivRef.current || !window.google?.maps) return;
        mapRef.current = new window.google.maps.Map(mapDivRef.current, {
          center: data?.center
            ? { lat: data.center.latitude, lng: data.center.longitude }
            : { lat: 39.8283, lng: -98.5795 },
          zoom: 4,
          mapTypeControl: true,
          streetViewControl: false,
          fullscreenControl: true,
          styles: MAP_DARK_STYLES,
        });
        setMapReady(true);
      })
      .catch((err) => setMapError(err instanceof Error ? err.message : "Map failed"));
  }, []);

  useEffect(() => {
    if (data?.center && mapRef.current && mapReady) {
      mapRef.current.setCenter({ lat: data.center.latitude, lng: data.center.longitude });
    }
  }, [data?.center, mapReady]);

  const renderMarkers = useCallback(() => {
    if (!mapReady || !mapRef.current || !data || !window.google?.maps) return;
    overlaysRef.current.forEach((o) => o.setMap(null));
    overlaysRef.current = [];

    for (const load of data.loads) {
      const marker = new window.google.maps.Marker({
        map: mapRef.current,
        position: { lat: load.latitude, lng: load.longitude },
        title: load.projectName,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 7,
          fillColor: MAP_STATUS_COLOR[load.status] ?? "#e9a600",
          fillOpacity: 1,
          strokeColor: "#fff",
          strokeWeight: 2,
        },
      });
      overlaysRef.current.push(marker);
    }

    for (const truck of data.trucks) {
      const isSelected = selectedTruckId === truck.id;
      const marker = new window.google.maps.Marker({
        map: mapRef.current,
        position: { lat: truck.latitude, lng: truck.longitude },
        title: `${truck.label} — ${truck.ownerCompany}`,
        zIndex: isSelected ? 1000 : 1,
        icon: {
          path: window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
          scale: isSelected ? 7 : 5,
          fillColor: isSelected ? "#e9a600" : MAP_STATUS_COLOR[truck.status] ?? "#22c55e",
          fillOpacity: 1,
          strokeColor: "#fff",
          strokeWeight: isSelected ? 2 : 1,
        },
      });
      overlaysRef.current.push(marker);
    }

    for (const zone of data.heatZones) {
      const circle = new window.google.maps.Circle({
        map: mapRef.current,
        center: { lat: zone.latitude, lng: zone.longitude },
        radius: zone.radius,
        fillColor: "#f59e0b",
        fillOpacity: 0.12 + zone.intensity * 0.08,
        strokeColor: "#f59e0b",
        strokeOpacity: 0.35,
        strokeWeight: 1,
      });
      overlaysRef.current.push(circle);
    }

    // PLACEHOLDER: MarkerClusterer for clustered trucks — requires @googlemaps/markerclusterer
    // PLACEHOLDER: TrafficLayer — window.google.maps.TrafficLayer when showTraffic enabled
    // PLACEHOLDER: Geofence polygons — requires facility boundary API
    // PLACEHOLDER: Driver route polyline — requires directions/route API
    // PLACEHOLDER: Live GPS position updates — requires WebSocket /api/map/live
  }, [mapReady, data, selectedTruckId]);

  useEffect(() => {
    renderMarkers();
  }, [renderMarkers]);

  const minH = `${minHeight}px`;

  if (mapError) {
    return (
      <div
        className={cn("flex flex-col items-center justify-center gap-2 text-muted-foreground", className)}
        style={{ minHeight: minH }}
        role="alert"
      >
        <MapPin className="h-10 w-10 opacity-40" aria-hidden />
        <p className="font-semibold text-destructive">{mapError}</p>
        <p className="text-sm text-center px-4">Set VITE_GOOGLE_MAPS_API_KEY to enable the live map.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={cn("flex items-center justify-center", className)} style={{ minHeight: minH }}>
        <Loader2 className="h-8 w-8 animate-spin text-primary" aria-label="Loading map" />
      </div>
    );
  }

  if (isError) {
    return (
      <div
        className={cn("flex flex-col items-center justify-center gap-3", className)}
        style={{ minHeight: minH }}
        role="alert"
      >
        <p className="text-destructive font-semibold">Failed to load map data</p>
        {onRetry && (
          <Button variant="outline" onClick={onRetry}>
            Retry
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className={cn("relative w-full", className)} style={{ minHeight: minH }}>
      <div
        ref={mapDivRef}
        className={cn("w-full h-full absolute inset-0", !mapReady && "opacity-0")}
        style={{ minHeight: minH }}
        role="application"
        aria-label="Operations map showing loads, fleet trucks, and demand heat zones"
      />
      {!mapReady && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" aria-label="Initializing map" />
        </div>
      )}
    </div>
  );
}
