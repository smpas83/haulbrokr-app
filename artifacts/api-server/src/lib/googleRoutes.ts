/**
 * Google Routes API + Distance Matrix for driving distance, ETA, and polylines.
 * Haversine fallback is allowed only outside production when GOOGLE_MAPS_API_KEY is unset.
 */

export type LatLng = { latitude: number; longitude: number };

export type RouteResult = {
  distanceMiles: number;
  durationSeconds: number;
  durationInTrafficSeconds: number | null;
  etaIso: string;
  polyline: LatLng[];
  encodedPolyline: string;
  source: "google_routes" | "haversine_dev_fallback";
};

export type DistanceResult = {
  destinationIndex: number;
  distanceMiles: number;
  durationSeconds: number;
  source: "google_distance_matrix" | "haversine_dev_fallback";
};

const EARTH_RADIUS_MI = 3958.8;
const ROUTES_URL = "https://routes.googleapis.com/directions/v2:computeRoutes";
const DISTANCE_MATRIX_URL = "https://maps.googleapis.com/maps/api/distancematrix/json";

export function isGoogleMapsConfigured(): boolean {
  return Boolean(process.env.GOOGLE_MAPS_API_KEY?.trim());
}

export function allowDevFallback(): boolean {
  return process.env.NODE_ENV !== "production";
}

export function haversineMiles(a: LatLng, b: LatLng): number {
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_MI * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/** Decode Google's encoded polyline into lat/lng points. */
export function decodePolyline(encoded: string): LatLng[] {
  const points: LatLng[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte: number;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    shift = 0;
    result = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;

    points.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }

  return points;
}

function haversineRouteFallback(origin: LatLng, destination: LatLng): RouteResult {
  const distanceMiles = haversineMiles(origin, destination);
  const durationSeconds = Math.round((distanceMiles / 35) * 3600);
  const eta = new Date(Date.now() + durationSeconds * 1000);
  return {
    distanceMiles: Math.round(distanceMiles * 10) / 10,
    durationSeconds,
    durationInTrafficSeconds: null,
    etaIso: eta.toISOString(),
    polyline: [origin, destination],
    encodedPolyline: "",
    source: "haversine_dev_fallback",
  };
}

function haversineDistanceFallback(origin: LatLng, destinations: LatLng[]): DistanceResult[] {
  return destinations.map((dest, destinationIndex) => {
    const distanceMiles = haversineMiles(origin, dest);
    const durationSeconds = Math.round((distanceMiles / 35) * 3600);
    return {
      destinationIndex,
      distanceMiles: Math.round(distanceMiles * 10) / 10,
      durationSeconds,
      source: "haversine_dev_fallback" as const,
    };
  });
}

function parseDurationSeconds(duration: string | undefined): number {
  if (!duration) return 0;
  const match = duration.match(/^(\d+)s$/);
  return match ? parseInt(match[1], 10) : 0;
}

function metersToMiles(meters: number): number {
  return Math.round((meters / 1609.344) * 10) / 10;
}

export async function computeDrivingRoute(origin: LatLng, destination: LatLng): Promise<RouteResult> {
  const key = process.env.GOOGLE_MAPS_API_KEY?.trim();
  if (!key) {
    if (allowDevFallback()) return haversineRouteFallback(origin, destination);
    throw new Error("GOOGLE_MAPS_API_KEY is required in production for route calculation.");
  }

  const res = await fetch(ROUTES_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask":
        "routes.duration,routes.staticDuration,routes.distanceMeters,routes.polyline.encodedPolyline",
    },
    body: JSON.stringify({
      origin: { location: { latLng: { latitude: origin.latitude, longitude: origin.longitude } } },
      destination: {
        location: { latLng: { latitude: destination.latitude, longitude: destination.longitude } },
      },
      travelMode: "DRIVE",
      routingPreference: "TRAFFIC_AWARE",
      computeAlternativeRoutes: false,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Google Routes API error (${res.status}): ${text.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    routes?: {
      duration?: string;
      staticDuration?: string;
      distanceMeters?: number;
      polyline?: { encodedPolyline?: string };
    }[];
  };

  const route = data.routes?.[0];
  if (!route) {
    throw new Error("No route found between origin and destination.");
  }

  const encodedPolyline = route.polyline?.encodedPolyline ?? "";
  const polyline = encodedPolyline ? decodePolyline(encodedPolyline) : [origin, destination];
  const durationSeconds = parseDurationSeconds(route.duration ?? route.staticDuration);
  const staticSeconds = parseDurationSeconds(route.staticDuration);
  const durationInTrafficSeconds =
    route.duration && route.staticDuration && durationSeconds !== staticSeconds
      ? durationSeconds
      : durationSeconds || staticSeconds;

  const eta = new Date(Date.now() + durationInTrafficSeconds * 1000);

  return {
    distanceMiles: metersToMiles(route.distanceMeters ?? 0),
    durationSeconds: durationInTrafficSeconds,
    durationInTrafficSeconds: route.duration ? durationInTrafficSeconds : null,
    etaIso: eta.toISOString(),
    polyline,
    encodedPolyline,
    source: "google_routes",
  };
}

/** Batch driving distances from one origin to many destinations (max 25 per Google request). */
export async function computeDrivingDistances(
  origin: LatLng,
  destinations: LatLng[],
): Promise<DistanceResult[]> {
  if (destinations.length === 0) return [];

  const key = process.env.GOOGLE_MAPS_API_KEY?.trim();
  if (!key) {
    if (allowDevFallback()) return haversineDistanceFallback(origin, destinations);
    throw new Error("GOOGLE_MAPS_API_KEY is required in production for driving distance.");
  }

  const results: DistanceResult[] = [];
  const batchSize = 25;

  for (let offset = 0; offset < destinations.length; offset += batchSize) {
    const batch = destinations.slice(offset, offset + batchSize);
    const destParam = batch.map((d) => `${d.latitude},${d.longitude}`).join("|");
    const url = new URL(DISTANCE_MATRIX_URL);
    url.searchParams.set("origins", `${origin.latitude},${origin.longitude}`);
    url.searchParams.set("destinations", destParam);
    url.searchParams.set("mode", "driving");
    url.searchParams.set("units", "imperial");
    url.searchParams.set("departure_time", "now");
    url.searchParams.set("key", key);

    const res = await fetch(url.toString());
    if (!res.ok) {
      throw new Error(`Google Distance Matrix error (${res.status})`);
    }

    const data = (await res.json()) as {
      rows?: { elements?: { status: string; distance?: { value: number }; duration?: { value: number } }[] }[];
    };

    const elements = data.rows?.[0]?.elements ?? [];
    for (let i = 0; i < batch.length; i++) {
      const el = elements[i];
      if (el?.status === "OK" && el.distance && el.duration) {
        results.push({
          destinationIndex: offset + i,
          distanceMiles: metersToMiles(el.distance.value),
          durationSeconds: el.duration.value,
          source: "google_distance_matrix",
        });
      } else if (allowDevFallback()) {
        results.push(haversineDistanceFallback(origin, [batch[i]])[0]);
      } else {
        throw new Error(`Distance Matrix element failed: ${el?.status ?? "UNKNOWN"}`);
      }
    }
  }

  return results;
}

export function formatEtaLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "ETA unavailable";
  const diffMin = Math.max(0, Math.round((date.getTime() - Date.now()) / 60_000));
  if (diffMin < 60) return `${diffMin} min`;
  const h = Math.floor(diffMin / 60);
  const m = diffMin % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}
