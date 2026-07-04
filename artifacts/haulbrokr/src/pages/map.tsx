import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/react";
import { useQuery } from "@tanstack/react-query";
import {
  MapPin, RefreshCw, Truck, Layers, Maximize2, Minimize2,
  WifiOff, CircleDot, Flame
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { PageHeader, StatusChip, EmptyState, SectionFade } from "@/components/design";
import { getMapMarkerColor } from "@/lib/design-tokens";
import { cn } from "@/lib/utils";

type MarketplaceMapData = {
  demoMode: boolean;
  generatedAt: string;
  center: { latitude: number; longitude: number };
  loads: Array<{
    id: string;
    status: string;
    projectName: string;
    material: string;
    pickupAddress: string;
    budgetPerHour: number;
    trucksNeeded: number;
    bidsCount: number;
    latitude: number;
    longitude: number;
  }>;
  trucks: Array<{
    id: number;
    label: string;
    status: string;
    ownerCompany: string;
    latitude: number;
    longitude: number;
  }>;
  heatZones: Array<{ latitude: number; longitude: number; radius: number; intensity: number }>;
  stats: { openLoads: number; activeJobs: number; availableTrucks: number; providers: number };
};

declare global {
  interface Window {
    google?: any;
    __haulbrokrWebMapInit?: () => void;
  }
}

function loadGoogleMaps(): Promise<void> {
  if (window.google?.maps) return Promise.resolve();
  const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  if (!key) return Promise.reject(new Error("VITE_GOOGLE_MAPS_API_KEY is not set"));
  return new Promise((resolve, reject) => {
    window.__haulbrokrWebMapInit = () => resolve();
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&callback=__haulbrokrWebMapInit`;
    s.async = true;
    s.onerror = () => reject(new Error("Google Maps script failed"));
    document.head.appendChild(s);
  });
}

async function fetchMarketplace(getToken: () => Promise<string | null>): Promise<MarketplaceMapData> {
  const token = await getToken();
  const res = await fetch("/api/map/marketplace", {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    const fallback = await fetch("/api/automation/demo-map");
    if (fallback.ok) return fallback.json();
    throw new Error("Failed to load map data");
  }
  return res.json();
}

const LEGEND_ITEMS = [
  { label: "Open Loads", color: getMapMarkerColor("open"), shape: "circle" as const },
  { label: "Active / Bidding", color: getMapMarkerColor("bidding"), shape: "circle" as const },
  { label: "Available Trucks", color: getMapMarkerColor("available"), shape: "arrow" as const },
  { label: "En Route", color: getMapMarkerColor("en_route"), shape: "arrow" as const },
  { label: "Demand Heat", color: "hsl(38 92% 50%)", shape: "heat" as const },
];

export default function MapPage() {
  const { getToken } = useAuth();
  const mapDivRef = useRef<HTMLDivElement>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const overlaysRef = useRef<any[]>([]);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isOnline, setIsOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [layers, setLayers] = useState({ loads: true, trucks: true, heat: true });
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["map", "marketplace"],
    queryFn: () => fetchMarketplace(getToken),
    refetchInterval: 30_000,
    enabled: isOnline,
  });

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  useEffect(() => {
    loadGoogleMaps()
      .then(() => {
        if (!mapDivRef.current || !window.google?.maps) return;
        mapRef.current = new window.google.maps.Map(mapDivRef.current, {
          center: { lat: 39.8283, lng: -98.5795 },
          zoom: 4,
          mapTypeControl: true,
          streetViewControl: false,
          fullscreenControl: false,
          styles: [
            { elementType: "geometry", stylers: [{ color: "#0f172a" }] },
            { elementType: "labels.text.fill", stylers: [{ color: "#6b7280" }] },
            { featureType: "road", elementType: "geometry", stylers: [{ color: "#1c2333" }] },
            { featureType: "water", elementType: "geometry", stylers: [{ color: "#0a1628" }] },
          ],
        });
        setMapReady(true);
      })
      .catch((err) => setMapError(err instanceof Error ? err.message : "Map failed"));
  }, []);

  useEffect(() => {
    const onResize = () => {
      if (mapRef.current && window.google?.maps) {
        window.google.maps.event.trigger(mapRef.current, "resize");
      }
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (mapRef.current && window.google?.maps) {
      setTimeout(() => {
        window.google.maps.event.trigger(mapRef.current, "resize");
      }, 100);
    }
  }, [isFullscreen]);

  const toggleFullscreen = () => {
    if (!mapContainerRef.current) return;
    if (!document.fullscreenElement) {
      mapContainerRef.current.requestFullscreen?.().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen?.().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  const renderMarkers = useCallback(() => {
    if (!mapReady || !mapRef.current || !data || !window.google?.maps) return;
    overlaysRef.current.forEach((o) => o.setMap(null));
    overlaysRef.current = [];

    if (layers.loads) {
      for (const load of data.loads) {
        const isSelected = selectedId === `load-${load.id}`;
        const marker = new window.google.maps.Marker({
          map: mapRef.current,
          position: { lat: load.latitude, lng: load.longitude },
          title: load.projectName,
          zIndex: isSelected ? 100 : 10,
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: isSelected ? 10 : 7,
            fillColor: getMapMarkerColor(load.status),
            fillOpacity: 1,
            strokeColor: isSelected ? "hsl(217 91% 60%)" : "#fff",
            strokeWeight: isSelected ? 3 : 2,
          },
        });
        marker.addListener("click", () => setSelectedId(`load-${load.id}`));
        overlaysRef.current.push(marker);
      }
    }

    if (layers.trucks) {
      for (const truck of data.trucks) {
        const isSelected = selectedId === `truck-${truck.id}`;
        const marker = new window.google.maps.Marker({
          map: mapRef.current,
          position: { lat: truck.latitude, lng: truck.longitude },
          title: `${truck.label} — ${truck.ownerCompany}`,
          zIndex: isSelected ? 100 : 5,
          icon: {
            path: window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
            scale: isSelected ? 7 : 5,
            fillColor: getMapMarkerColor(truck.status),
            fillOpacity: 1,
            strokeColor: isSelected ? "hsl(217 91% 60%)" : "#fff",
            strokeWeight: isSelected ? 2 : 1,
          },
        });
        marker.addListener("click", () => setSelectedId(`truck-${truck.id}`));
        overlaysRef.current.push(marker);
      }
    }

    if (layers.heat) {
      for (const zone of data.heatZones) {
        const circle = new window.google.maps.Circle({
          map: mapRef.current,
          center: { lat: zone.latitude, lng: zone.longitude },
          radius: zone.radius,
          fillColor: "hsl(38 92% 50%)",
          fillOpacity: 0.12 + zone.intensity * 0.08,
          strokeColor: "hsl(38 92% 50%)",
          strokeOpacity: 0.35,
          strokeWeight: 1,
        });
        overlaysRef.current.push(circle);
      }
    }
  }, [mapReady, data, layers, selectedId]);

  useEffect(() => {
    renderMarkers();
  }, [renderMarkers]);

  return (
    <div className="space-y-6 page-enter max-w-7xl mx-auto">
      <PageHeader
        title="Live Operations Map"
        description="Nationwide loads, fleet trucks, and demand heat zones"
        badge={
          data?.demoMode ? (
            <Badge variant="outline" className="mb-2 border-info/40 text-info bg-info/10">
              Demo Mode
            </Badge>
          ) : undefined
        }
        actions={
          <div className="flex items-center gap-2">
            {!isOnline && (
              <Badge variant="outline" className="border-warning/40 text-warning bg-warning/10">
                <WifiOff className="h-3 w-3 mr-1" />
                Offline
              </Badge>
            )}
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching || !isOnline}>
              {isFetching ? <Spinner /> : <RefreshCw className="h-4 w-4" />}
              <span className="ml-2">Refresh</span>
            </Button>
          </div>
        }
      />

      <SectionFade delay={50}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Open Loads", value: data?.stats.openLoads ?? "—", icon: MapPin },
            { label: "Active Jobs", value: data?.stats.activeJobs ?? "—", icon: Layers },
            { label: "Trucks", value: data?.trucks.length ?? "—", icon: Truck },
            { label: "Carriers", value: data?.stats.providers ?? "—", icon: Truck },
          ].map((stat, i) => (
            <Card key={stat.label} className={cn("card-fade", `stagger-${i + 1}`)}>
              <CardHeader className="pb-2 pt-4 px-4">
                <CardDescription className="flex items-center gap-1 text-xs uppercase tracking-wider">
                  <stat.icon className="h-3 w-3" /> {stat.label}
                </CardDescription>
                <CardTitle className="text-2xl font-bold stat-number">{stat.value}</CardTitle>
              </CardHeader>
            </Card>
          ))}
        </div>
      </SectionFade>

      <SectionFade delay={100}>
        <Card ref={mapContainerRef} className="overflow-hidden">
          <CardContent className="p-0 relative">
            <div className="absolute top-3 left-3 z-10 flex flex-col gap-2">
              <div className="surface-panel rounded-lg p-3 space-y-2 min-w-[140px]">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Layers</p>
                {([
                  { key: "loads" as const, label: "Loads", icon: CircleDot },
                  { key: "trucks" as const, label: "Trucks", icon: Truck },
                  { key: "heat" as const, label: "Heat Zones", icon: Flame },
                ]).map(({ key, label, icon: Icon }) => (
                  <div key={key} className="flex items-center justify-between gap-3">
                    <Label htmlFor={`layer-${key}`} className="text-xs font-medium flex items-center gap-1.5 cursor-pointer">
                      <Icon className="h-3 w-3 text-muted-foreground" />
                      {label}
                    </Label>
                    <Switch
                      id={`layer-${key}`}
                      checked={layers[key]}
                      onCheckedChange={(checked) => setLayers((prev) => ({ ...prev, [key]: checked }))}
                    />
                  </div>
                ))}
              </div>

              <div className="surface-panel rounded-lg p-3 space-y-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Legend</p>
                {LEGEND_ITEMS.map((item) => (
                  <div key={item.label} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span
                      className="h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: item.color }}
                    />
                    {item.label}
                  </div>
                ))}
                <p className="text-[10px] text-muted-foreground/60 pt-1 border-t border-border/40 mt-1">
                  Clustering enabled at zoom &lt; 8 (placeholder)
                </p>
              </div>
            </div>

            <Button
              variant="outline"
              size="icon"
              className="absolute top-3 right-3 z-10 bg-card/90 backdrop-blur-sm"
              onClick={toggleFullscreen}
              aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            >
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>

            <div className={cn("w-full", isFullscreen ? "h-screen" : "h-[min(70vh,560px)]")}>
              {mapError ? (
                <EmptyState
                  icon={MapPin}
                  title="Map unavailable"
                  description={mapError}
                  className="h-full min-h-[400px] border-0 rounded-none"
                />
              ) : !isOnline ? (
                <EmptyState
                  icon={WifiOff}
                  title="You're offline"
                  description="Map data will refresh when your connection is restored."
                  className="h-full min-h-[400px] border-0 rounded-none"
                />
              ) : isLoading ? (
                <div className="flex flex-col items-center justify-center h-full min-h-[400px] gap-3 map-loading-shimmer">
                  <Spinner className="h-8 w-8 text-primary" />
                  <p className="text-sm text-muted-foreground">Loading marketplace data...</p>
                </div>
              ) : isError ? (
                <EmptyState
                  icon={MapPin}
                  title="Failed to load map data"
                  description="We couldn't fetch marketplace data. Check your connection and try again."
                  action={{ label: "Retry", onClick: () => refetch() }}
                  className="h-full min-h-[400px] border-0 rounded-none"
                />
              ) : (
                <>
                  <div ref={mapDivRef} className={cn("w-full h-full", !mapReady && "opacity-0")} />
                  {!mapReady && (
                    <div className="absolute inset-0 flex items-center justify-center map-loading-shimmer">
                      <Spinner className="h-8 w-8 text-primary" />
                    </div>
                  )}
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </SectionFade>

      {data && data.loads.length === 0 && data.trucks.length === 0 && (
        <EmptyState
          icon={MapPin}
          title="No marketplace activity"
          description="Loads and trucks will appear here as the marketplace grows."
        />
      )}

      {data && (data.loads.length > 0 || data.trucks.length > 0) && (
        <SectionFade delay={150}>
          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Nearby Loads</CardTitle>
                <CardDescription>{Math.min(data.loads.length, 8)} shown · {data.loads.length} total on map</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 max-h-64 overflow-y-auto">
                {data.loads.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">No loads on map</p>
                ) : (
                  data.loads.slice(0, 8).map((load) => (
                    <button
                      key={load.id}
                      type="button"
                      onClick={() => setSelectedId(`load-${load.id}`)}
                      className={cn(
                        "w-full text-left text-sm border-b border-border/40 pb-2 transition-colors rounded-md px-2 py-1 -mx-2",
                        selectedId === `load-${load.id}` ? "bg-primary/10 border-primary/30" : "hover:bg-muted/30"
                      )}
                    >
                      <div className="font-semibold flex items-center gap-2">
                        {load.projectName}
                        <StatusChip status={load.status} />
                      </div>
                      <div className="text-muted-foreground text-xs mt-0.5">
                        {load.material} · ${load.budgetPerHour}/hr · {load.bidsCount} bids
                      </div>
                    </button>
                  ))
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Fleet Trucks</CardTitle>
                <CardDescription>{data.stats.availableTrucks} available · {data.trucks.length} on map</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 max-h-64 overflow-y-auto">
                {data.trucks.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">No trucks on map</p>
                ) : (
                  data.trucks.slice(0, 8).map((truck) => (
                    <button
                      key={truck.id}
                      type="button"
                      onClick={() => setSelectedId(`truck-${truck.id}`)}
                      className={cn(
                        "w-full text-left text-sm border-b border-border/40 pb-2 flex justify-between items-center transition-colors rounded-md px-2 py-1 -mx-2",
                        selectedId === `truck-${truck.id}` ? "bg-primary/10 border-primary/30" : "hover:bg-muted/30"
                      )}
                    >
                      <span className="font-semibold">{truck.label}</span>
                      <StatusChip status={truck.status} />
                    </button>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </SectionFade>
      )}
    </div>
  );
}
