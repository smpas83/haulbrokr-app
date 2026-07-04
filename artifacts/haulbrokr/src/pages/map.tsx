import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/react";
import { useQuery } from "@tanstack/react-query";
import { MapPin, RefreshCw, Truck, Layers, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  heatZones: Array<{
    latitude: number;
    longitude: number;
    radius: number;
    intensity: number;
  }>;
  stats: {
    openLoads: number;
    activeJobs: number;
    availableTrucks: number;
    providers: number;
  };
};

const STATUS_COLOR: Record<string, string> = {
  open: "#e9a600",
  bidding: "#3b82f6",
  bid_received: "#3b82f6",
  accepted: "#16a34a",
  in_progress: "#16a34a",
  available: "#22c55e",
  assigned: "#3b82f6",
  en_route: "#e9a600",
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
  if (!key)
    return Promise.reject(new Error("VITE_GOOGLE_MAPS_API_KEY is not set"));
  return new Promise((resolve, reject) => {
    window.__haulbrokrWebMapInit = () => resolve();
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&callback=__haulbrokrWebMapInit`;
    s.async = true;
    s.onerror = () => reject(new Error("Google Maps script failed"));
    document.head.appendChild(s);
  });
}

async function fetchMarketplace(
  getToken: () => Promise<string | null>,
): Promise<MarketplaceMapData> {
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
          streetViewControl: false,
          fullscreenControl: true,
          styles: [
            { elementType: "geometry", stylers: [{ color: "#0f172a" }] },
            {
              elementType: "labels.text.fill",
              stylers: [{ color: "#6b7280" }],
            },
            {
              featureType: "road",
              elementType: "geometry",
              stylers: [{ color: "#1c2333" }],
            },
            {
              featureType: "water",
              elementType: "geometry",
              stylers: [{ color: "#0a1628" }],
            },
          ],
        });
        setMapReady(true);
      })
      .catch((err) =>
        setMapError(err instanceof Error ? err.message : "Map failed"),
      );
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
          scale: 7,
          fillColor: STATUS_COLOR[load.status] ?? "#e9a600",
          fillOpacity: 1,
          strokeColor: "#fff",
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
          fillColor: STATUS_COLOR[truck.status] ?? "#22c55e",
          fillOpacity: 1,
          strokeColor: "#fff",
          strokeWeight: 1,
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
  }, [mapReady, data]);

  useEffect(() => {
    renderMarkers();
  }, [renderMarkers]);

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6 h-full">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <MapPin className="h-6 w-6 text-primary" />
            Live Operations Map
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Nationwide loads, fleet trucks, and demand heat zones
          </p>
        </div>
        <div className="flex items-center gap-2">
          {data?.demoMode && (
            <Badge
              variant="outline"
              className="rounded-none border-2 border-blue-400/50 text-blue-600 bg-blue-50"
            >
              Demo Mode
            </Badge>
          )}
          <Button
            variant="outline"
            size="sm"
            className="rounded-none border-2"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            {isFetching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            <span className="ml-2">Refresh</span>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          {
            label: "Open Loads",
            value: data?.stats.openLoads ?? "—",
            icon: MapPin,
          },
          {
            label: "Active Jobs",
            value: data?.stats.activeJobs ?? "—",
            icon: Layers,
          },
          { label: "Trucks", value: data?.trucks.length ?? "—", icon: Truck },
          {
            label: "Carriers",
            value: data?.stats.providers ?? "—",
            icon: Truck,
          },
        ].map((stat) => (
          <Card key={stat.label} className="rounded-none border-2">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardDescription className="flex items-center gap-1 text-xs uppercase tracking-wider">
                <stat.icon className="h-3 w-3" /> {stat.label}
              </CardDescription>
              <CardTitle className="text-2xl font-bold">{stat.value}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      <Card className="rounded-none border-2 flex-1 min-h-[480px] overflow-hidden">
        <CardContent className="p-0 h-full min-h-[480px] relative">
          {mapError ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[480px] gap-2 text-muted-foreground">
              <MapPin className="h-10 w-10 opacity-40" />
              <p className="font-semibold text-destructive">{mapError}</p>
              <p className="text-sm">
                Set VITE_GOOGLE_MAPS_API_KEY on Vercel to enable the live map.
              </p>
            </div>
          ) : isLoading ? (
            <div className="flex items-center justify-center h-full min-h-[480px]">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : isError ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[480px] gap-3">
              <p className="text-destructive font-semibold">
                Failed to load marketplace data
              </p>
              <Button variant="outline" onClick={() => refetch()}>
                Retry
              </Button>
            </div>
          ) : (
            <>
              <div
                ref={mapDivRef}
                className={cn(
                  "w-full h-full min-h-[480px]",
                  !mapReady && "opacity-0",
                )}
              />
              {!mapReady && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {data && (
        <div className="grid md:grid-cols-2 gap-4">
          <Card className="rounded-none border-2">
            <CardHeader>
              <CardTitle className="text-base">Nearby Loads</CardTitle>
              <CardDescription>
                {data.loads.slice(0, 8).length} shown · {data.loads.length}{" "}
                total on map
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 max-h-64 overflow-y-auto">
              {data.loads.slice(0, 8).map((load) => (
                <div
                  key={load.id}
                  className="text-sm border-b border-border pb-2"
                >
                  <div className="font-semibold">{load.projectName}</div>
                  <div className="text-muted-foreground text-xs">
                    {load.material} · ${load.budgetPerHour}/hr ·{" "}
                    {load.bidsCount} bids
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card className="rounded-none border-2">
            <CardHeader>
              <CardTitle className="text-base">Fleet Trucks</CardTitle>
              <CardDescription>
                {data.stats.availableTrucks} available · {data.trucks.length} on
                map
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 max-h-64 overflow-y-auto">
              {data.trucks.slice(0, 8).map((truck) => (
                <div
                  key={truck.id}
                  className="text-sm border-b border-border pb-2 flex justify-between"
                >
                  <span className="font-semibold">{truck.label}</span>
                  <Badge variant="outline" className="rounded-none text-xs">
                    {truck.status}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
