import { useAuth } from "@clerk/react";
import { useQuery } from "@tanstack/react-query";
import { MapPin, RefreshCw, Truck, Layers, Loader2, Navigation, Cloud, Clock, Shield } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/design";
import { MapContainer } from "@/components/map/map-container";
import type { MarketplaceMapData } from "@/lib/map-types";

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

/** PLACEHOLDER map layer controls — enable when backend APIs are available */
function MapLayerPlaceholders() {
  const layers = [
    { icon: Navigation, label: "Live GPS", note: "PLACEHOLDER" },
    { icon: Layers, label: "Traffic", note: "PLACEHOLDER" },
    { icon: Cloud, label: "Weather", note: "PLACEHOLDER" },
    { icon: Clock, label: "ETA", note: "PLACEHOLDER" },
    { icon: MapPin, label: "Facility Status", note: "PLACEHOLDER" },
    { icon: Truck, label: "Clustered Trucks", note: "Active" },
    { icon: Shield, label: "Geofence", note: "PLACEHOLDER" },
  ];

  return (
    <div className="flex flex-wrap gap-2" aria-label="Map layer controls">
      {layers.map((layer) => (
        <Badge
          key={layer.label}
          variant="outline"
          className="rounded-lg text-xs gap-1 opacity-70 cursor-not-allowed"
          title={`${layer.label}: ${layer.note}`}
        >
          <layer.icon className="h-3 w-3" />
          {layer.label}
          <span className="text-muted-foreground">· {layer.note}</span>
        </Badge>
      ))}
    </div>
  );
}

export default function MapPage() {
  const { getToken } = useAuth();

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["map", "marketplace"],
    queryFn: () => fetchMarketplace(getToken),
    refetchInterval: 30_000,
  });

  return (
    <div className="flex flex-col gap-4 max-w-7xl mx-auto page-enter">
      <PageHeader
        eyebrow="Operations"
        title="Live Operations Map"
        description="Nationwide loads, fleet trucks, and demand heat zones."
        actions={
          <>
            {data?.demoMode && (
              <Badge variant="outline" className="rounded-lg border-blue-400/50 text-blue-400">
                Demo Mode
              </Badge>
            )}
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
              {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              <span className="ml-2">Refresh</span>
            </Button>
          </>
        }
        toolbar={<MapLayerPlaceholders />}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Open Loads", value: data?.stats.openLoads ?? "—", icon: MapPin },
          { label: "Active Jobs", value: data?.stats.activeJobs ?? "—", icon: Layers },
          { label: "Trucks", value: data?.trucks.length ?? "—", icon: Truck },
          { label: "Carriers", value: data?.stats.providers ?? "—", icon: Truck },
        ].map((stat) => (
          <Card key={stat.label} className="surface-panel border-border/60">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardDescription className="flex items-center gap-1 text-xs uppercase tracking-wider">
                <stat.icon className="h-3 w-3" /> {stat.label}
              </CardDescription>
              <CardTitle className="text-2xl font-bold">{stat.value}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      <Card className="surface-panel border-border/60 flex-1 min-h-[480px] overflow-hidden">
        <CardContent className="p-0 h-full min-h-[480px] relative">
          <MapContainer
            data={data}
            isLoading={isLoading}
            isError={isError}
            onRetry={() => refetch()}
            minHeight={480}
          />
        </CardContent>
      </Card>

      {data && (
        <div className="grid md:grid-cols-2 gap-4">
          <Card className="surface-panel border-border/60">
            <CardHeader>
              <CardTitle className="text-base">Nearby Loads</CardTitle>
              <CardDescription>{data.loads.slice(0, 8).length} shown · {data.loads.length} total on map</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 max-h-64 overflow-y-auto">
              {data.loads.slice(0, 8).map((load) => (
                <div key={load.id} className="text-sm border-b border-border pb-2">
                  <div className="font-semibold">{load.projectName}</div>
                  <div className="text-muted-foreground text-xs">{load.material} · ${load.budgetPerHour}/hr · {load.bidsCount} bids</div>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card className="surface-panel border-border/60">
            <CardHeader>
              <CardTitle className="text-base">Fleet Trucks</CardTitle>
              <CardDescription>{data.stats.availableTrucks} available · {data.trucks.length} on map</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 max-h-64 overflow-y-auto">
              {data.trucks.slice(0, 8).map((truck) => (
                <div key={truck.id} className="text-sm border-b border-border pb-2 flex justify-between gap-2">
                  <span className="font-semibold truncate">{truck.label}</span>
                  <Badge variant="outline" className="rounded-lg text-xs shrink-0">{truck.status}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
