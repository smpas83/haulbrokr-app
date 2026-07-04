import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/react";
import { useQuery } from "@tanstack/react-query";
import { MapPin, RefreshCw, Truck, Layers, Loader2, Satellite, Cloud, Filter } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PageHeader, ExecutiveMetric, SurfacePanel, SectionHeader, StatusChip } from "@/components/design";
import { MAP_COLORS, MAP_DARK_STYLE } from "@/lib/design-tokens";

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

export default function MapPage() {
  const { getToken } = useAuth();
  const mapDivRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const overlaysRef = useRef<any[]>([]);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["map", "marketplace"],
    queryFn: () => fetchMarketplace(getToken),
    refetchInterval: 30_000,
  });

  useEffect(() => {
    loadGoogleMaps()
      .then(() => {
        if (!mapDivRef.current || !window.google?.maps) return;
        mapRef.current = new window.google.maps.Map(mapDivRef.current, {
          center: { lat: 39.8283, lng: -98.5795 },
          zoom: 4,
          mapTypeControl: true,
          mapTypeControlOptions: {
            style: window.google.maps.MapTypeControlStyle.HORIZONTAL_BAR,
            position: window.google.maps.ControlPosition.TOP_RIGHT,
          },
          streetViewControl: false,
          fullscreenControl: true,
          styles: MAP_DARK_STYLE,
        });
        setMapReady(true);
      })
      .catch((err) => setMapError(err instanceof Error ? err.message : "Map failed"));
  }, []);

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
          scale: 8,
          fillColor: MAP_COLORS[load.status] ?? MAP_COLORS.open,
          fillOpacity: 0.95,
          strokeColor: "#F4F4F5",
          strokeWeight: 2,
        },
      });
      overlaysRef.current.push(marker);
    }

    for (const truck of data.trucks) {
      const marker = new window.google.maps.Marker({
        map: mapRef.current,
        position: { lat: truck.latitude, lng: truck.longitude },
        title: `${truck.label} — ${truck.ownerCompany}`,
        icon: {
          path: window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
          scale: 5,
          fillColor: MAP_COLORS[truck.status] ?? MAP_COLORS.truck,
          fillOpacity: 1,
          strokeColor: "#F4F4F5",
          strokeWeight: 1.5,
        },
      });
      overlaysRef.current.push(marker);
    }

    for (const zone of data.heatZones) {
      const circle = new window.google.maps.Circle({
        map: mapRef.current,
        center: { lat: zone.latitude, lng: zone.longitude },
        radius: zone.radius,
        fillColor: MAP_COLORS.heat,
        fillOpacity: 0.1 + zone.intensity * 0.1,
        strokeColor: MAP_COLORS.heat,
        strokeOpacity: 0.4,
        strokeWeight: 1,
      });
      overlaysRef.current.push(circle);
    }
  }, [mapReady, data]);

  useEffect(() => {
    renderMarkers();
  }, [renderMarkers]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <PageHeader
        eyebrow="Live Operations"
        title="Operations Map"
        description="Nationwide loads, fleet trucks, demand heat zones, and real-time marketplace intelligence."
        actions={
          <>
            {data?.demoMode && (
              <Badge variant="outline" className="border-primary/30 text-primary bg-primary/10">
                Demo Mode
              </Badge>
            )}
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
              {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              <span className="ml-2">Refresh</span>
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <ExecutiveMetric label="Open Loads" value={data?.stats.openLoads ?? "—"} icon={MapPin} accent />
        <ExecutiveMetric label="Active Jobs" value={data?.stats.activeJobs ?? "—"} icon={Layers} />
        <ExecutiveMetric label="Trucks Online" value={data?.trucks.length ?? "—"} icon={Truck} />
        <ExecutiveMetric label="Carriers" value={data?.stats.providers ?? "—"} icon={Truck} />
      </div>

      <SurfacePanel className="overflow-hidden min-h-[520px] relative">
        {mapError ? (
          <div className="flex flex-col items-center justify-center min-h-[520px] gap-3 text-muted-foreground p-8">
            <MapPin className="h-12 w-12 opacity-30 text-primary" />
            <p className="font-semibold text-destructive">{mapError}</p>
            <p className="text-sm text-center max-w-md">
              Set VITE_GOOGLE_MAPS_API_KEY on Vercel to enable the live operations map.
            </p>
          </div>
        ) : isLoading ? (
          <div className="flex flex-col items-center justify-center min-h-[520px] gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Loading marketplace data…</p>
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center min-h-[520px] gap-3">
            <p className="text-destructive font-semibold">Failed to load marketplace data</p>
            <Button variant="outline" onClick={() => refetch()}>Retry</Button>
          </div>
        ) : (
          <>
            <div ref={mapDivRef} className={cn("w-full min-h-[520px]", !mapReady && "opacity-0")} />
            {!mapReady && (
              <div className="absolute inset-0 flex items-center justify-center bg-card">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            )}
            <div className="absolute top-4 left-4 map-chrome rounded-xl px-3 py-2 flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-primary" /> Loads</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-400" /> Trucks</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-accent" /> Demand</span>
            </div>
            <div className="absolute bottom-4 right-4 map-chrome rounded-xl px-3 py-2 flex items-center gap-2 text-xs">
              <Satellite className="h-3.5 w-3.5 text-muted-foreground" />
              <Cloud className="h-3.5 w-3.5 text-muted-foreground" />
              <Filter className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
          </>
        )}
      </SurfacePanel>

      {data && (
        <div className="grid md:grid-cols-2 gap-4">
          <SurfacePanel className="p-0 overflow-hidden">
            <div className="p-5 border-b border-border/50">
              <SectionHeader title="Nearby Loads" description={`${data.loads.length} total on map`} />
            </div>
            <div className="divide-y divide-border/40 max-h-72 overflow-y-auto">
              {data.loads.slice(0, 8).map((load) => (
                <div key={load.id} className="px-5 py-3 hover:bg-muted/20 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold text-sm">{load.projectName}</div>
                      <div className="text-muted-foreground text-xs mt-0.5">
                        {load.material} · ${load.budgetPerHour}/hr · {load.bidsCount} bids
                      </div>
                    </div>
                    <StatusChip status={load.status} />
                  </div>
                </div>
              ))}
            </div>
          </SurfacePanel>
          <SurfacePanel className="p-0 overflow-hidden">
            <div className="p-5 border-b border-border/50">
              <SectionHeader
                title="Fleet Trucks"
                description={`${data.stats.availableTrucks} available · ${data.trucks.length} on map`}
              />
            </div>
            <div className="divide-y divide-border/40 max-h-72 overflow-y-auto">
              {data.trucks.slice(0, 8).map((truck) => (
                <div key={truck.id} className="px-5 py-3 flex items-center justify-between hover:bg-muted/20 transition-colors">
                  <div>
                    <span className="font-semibold text-sm">{truck.label}</span>
                    <p className="text-xs text-muted-foreground">{truck.ownerCompany}</p>
                  </div>
                  <StatusChip status={truck.status} />
                </div>
              ))}
            </div>
          </SurfacePanel>
        </div>
      )}
    </div>
  );
}
