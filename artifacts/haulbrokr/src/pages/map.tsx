import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/react";
import { useQuery } from "@tanstack/react-query";
import {
  Crosshair,
  Loader2,
  MapPin,
  Navigation,
  RefreshCw,
  Truck,
  Layers,
} from "lucide-react";
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
import { useFindMyLocation } from "@/hooks/useFindMyLocation";
import { resolveGoogleMapsApiKey } from "@/lib/googleMapsKey";

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

const GOOGLE_MAPS_SCRIPT_ID = "haulbrokr-google-maps-script";

declare global {
  interface Window {
    google?: any;
    __haulbrokrWebMapInit?: () => void;
  }
}

let mapsScriptPromise: Promise<void> | null = null;

function loadGoogleMaps(): Promise<void> {
  if (window.google?.maps) {
    return Promise.resolve();
  }

  if (mapsScriptPromise) {
    return mapsScriptPromise;
  }

  mapsScriptPromise = resolveGoogleMapsApiKey().then(
    (key) =>
      new Promise<void>((resolve, reject) => {
        const finish = () => {
          console.log("Maps script loaded");
          resolve();
        };

        if (window.google?.maps) {
          finish();
          return;
        }

        const existingScript = document.getElementById(GOOGLE_MAPS_SCRIPT_ID);
        if (existingScript) {
          if (window.google?.maps) {
            finish();
            return;
          }

          const previousCallback = window.__haulbrokrWebMapInit;
          window.__haulbrokrWebMapInit = () => {
            previousCallback?.();
            finish();
          };
          return;
        }

        window.__haulbrokrWebMapInit = finish;

        const script = document.createElement("script");
        script.id = GOOGLE_MAPS_SCRIPT_ID;
        script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&callback=__haulbrokrWebMapInit`;
        script.async = true;
        script.onerror = () => reject(new Error("Google Maps script failed"));
        document.head.appendChild(script);
      }),
  );

  return mapsScriptPromise;
}

async function fetchMarketplace(
  getToken: () => Promise<string | null>,
): Promise<MarketplaceMapData> {
  const token = await getToken();
  const res = await fetch("/api/map/marketplace", {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    throw new Error("Failed to load map data");
  }
  return res.json();
}

export default function MapPage() {
  const { getToken } = useAuth();
  const mapDivRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const overlaysRef = useRef<any[]>([]);
  const userMarkerRef = useRef<any>(null);
  const userPulseRef = useRef<any>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const {
    coords: userCoords,
    error: locationError,
    following,
    locating,
    findLocation,
    recenter,
    stopFollowing,
  } = useFindMyLocation();

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["map", "marketplace"],
    queryFn: () => fetchMarketplace(getToken),
    refetchInterval: 30_000,
  });

  useEffect(() => {
    if (isLoading || isError || mapError || mapReady) return;

    let cancelled = false;

    const initMap = async () => {
      try {
        await loadGoogleMaps();
        if (cancelled) return;

        if (!window.google) {
          throw new Error(
            "Google Maps API not available (window.google is missing)",
          );
        }
        if (!window.google.maps) {
          throw new Error(
            "Google Maps API not available (window.google.maps is missing)",
          );
        }
        if (!mapDivRef.current) {
          throw new Error("Map container element is not mounted");
        }

        console.log("Creating map");
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
        console.log("Map created");
        setMapReady(true);
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setMapError(err instanceof Error ? err.message : String(err));
        }
      }
    };

    void initMap();

    return () => {
      cancelled = true;
    };
  }, [isLoading, isError, mapError, mapReady]);

  const renderUserLocation = useCallback(() => {
    if (!mapReady || !mapRef.current || !userCoords || !window.google?.maps)
      return;

    userMarkerRef.current?.setMap(null);
    userPulseRef.current?.setMap(null);

    userMarkerRef.current = new window.google.maps.Marker({
      map: mapRef.current,
      position: { lat: userCoords.latitude, lng: userCoords.longitude },
      title: "Your location",
      icon: {
        path: window.google.maps.SymbolPath.CIRCLE,
        scale: 8,
        fillColor: "#2563eb",
        fillOpacity: 1,
        strokeColor: "#ffffff",
        strokeWeight: 3,
      },
      zIndex: 999,
    });

    userPulseRef.current = new window.google.maps.Circle({
      map: mapRef.current,
      center: { lat: userCoords.latitude, lng: userCoords.longitude },
      radius: 120,
      fillColor: "#2563eb",
      fillOpacity: 0.18,
      strokeColor: "#2563eb",
      strokeOpacity: 0.45,
      strokeWeight: 1,
      zIndex: 998,
    });
  }, [mapReady, userCoords]);

  const renderMarkers = useCallback(() => {
    if (!mapReady || !mapRef.current || !data || !window.google?.maps) return;

    try {
      console.log("Rendering markers");
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

      renderUserLocation();
      console.log("Rendering complete");
    } catch (err) {
      console.error(err);
    }
  }, [mapReady, data, renderUserLocation]);

  useEffect(() => {
    renderMarkers();
  }, [renderMarkers]);

  useEffect(() => {
    if (!mapReady || !mapRef.current || !userCoords) return;
    if (following) {
      mapRef.current.panTo({
        lat: userCoords.latitude,
        lng: userCoords.longitude,
      });
    }
  }, [mapReady, userCoords, following]);

  const handleFindMe = async () => {
    const found = await findLocation({ follow: true });
    if (found && mapRef.current) {
      mapRef.current.panTo({ lat: found.latitude, lng: found.longitude });
      mapRef.current.setZoom(11);
    }
  };

  const handleRecenter = async () => {
    const found = await recenter();
    if (found && mapRef.current) {
      mapRef.current.panTo({ lat: found.latitude, lng: found.longitude });
    }
  };

  const isEmpty = data && data.loads.length === 0 && data.trucks.length === 0;

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6 h-full">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <MapPin className="h-6 w-6 text-primary" />
            Live Operations Map
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Nationwide loads, fleet trucks, and demand heat zones from
            production data
          </p>
        </div>
        <div className="flex items-center gap-2">
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
                Set VITE_GOOGLE_MAPS_API_KEY or configure GOOGLE_MAPS_API_KEY on
                the API server.
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
              {!mapReady && !mapError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">
                    Loading map...
                  </p>
                </div>
              )}

              {isEmpty && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 max-w-md rounded-none border-2 border-border bg-background/95 px-4 py-3 text-center shadow-lg">
                  <p className="font-semibold text-foreground">
                    No loads available in your area yet
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Use Find My Location to center the map, or check back when
                    new haul requests are posted.
                  </p>
                </div>
              )}

              {locationError && (
                <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-10 max-w-sm rounded-none border-2 border-destructive/40 bg-background/95 px-4 py-3 text-center shadow-lg">
                  <p className="text-sm text-destructive font-medium">
                    {locationError}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2 rounded-none border-2"
                    onClick={() => findLocation({ follow: following })}
                  >
                    Retry
                  </Button>
                </div>
              )}

              <div className="absolute bottom-6 right-6 z-10 flex flex-col gap-2">
                {following && userCoords && (
                  <Button
                    size="icon"
                    variant="secondary"
                    className="h-11 w-11 rounded-full border-2 shadow-lg"
                    onClick={handleRecenter}
                    disabled={locating}
                    title="Re-center on my location"
                  >
                    {locating ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Crosshair className="h-5 w-5" />
                    )}
                  </Button>
                )}
                <Button
                  size="icon"
                  variant={following ? "default" : "secondary"}
                  className={cn(
                    "h-11 w-11 rounded-full border-2 shadow-lg",
                    following && "ring-2 ring-blue-400/60",
                  )}
                  onClick={async () => {
                    if (following) {
                      stopFollowing();
                      return;
                    }
                    await handleFindMe();
                  }}
                  disabled={locating}
                  title={
                    following
                      ? "Stop following my location"
                      : "Find my location"
                  }
                >
                  {locating ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Navigation className="h-5 w-5" />
                  )}
                </Button>
              </div>
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
                {Math.min(data.loads.length, 8)} shown · {data.loads.length}{" "}
                total on map
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 max-h-64 overflow-y-auto">
              {data.loads.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No open loads on the map yet.
                </p>
              ) : (
                data.loads.slice(0, 8).map((load) => (
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
                ))
              )}
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
              {data.trucks.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No fleet trucks registered yet.
                </p>
              ) : (
                data.trucks.slice(0, 8).map((truck) => (
                  <div
                    key={truck.id}
                    className="text-sm border-b border-border pb-2 flex justify-between"
                  >
                    <span className="font-semibold">{truck.label}</span>
                    <Badge variant="outline" className="rounded-none text-xs">
                      {truck.status}
                    </Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
