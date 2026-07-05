/**
 * Production Google Maps integration (Geocoding, Reverse Geocoding, Directions, Distance Matrix).
 * In production, GOOGLE_MAPS_API_KEY is required — no third-party fallbacks.
 */

export type LatLng = { latitude: number; longitude: number };

export type RouteResult = {
  distanceMeters: number;
  distanceMiles: number;
  durationSeconds: number;
  durationText: string;
  etaText: string;
  polyline: string | null;
  startAddress: string | null;
  endAddress: string | null;
};

export type ReverseGeocodeResult = {
  formattedAddress: string;
  latitude: number;
  longitude: number;
};

function mapsKey(): string {
  const key = (process.env.GOOGLE_MAPS_API_KEY ?? "").trim();
  if (!key && process.env.NODE_ENV === "production") {
    throw new Error("GOOGLE_MAPS_API_KEY is required in production.");
  }
  return key;
}

export function isGoogleMapsConfigured(): boolean {
  return Boolean((process.env.GOOGLE_MAPS_API_KEY ?? "").trim());
}

function latLngParam(point: LatLng | string): string {
  if (typeof point === "string") return point;
  return `${point.latitude},${point.longitude}`;
}

async function googleFetch<T>(url: URL): Promise<T | null> {
  const key = mapsKey();
  if (!key) return null;
  url.searchParams.set("key", key);
  const res = await fetch(url.toString());
  if (!res.ok) return null;
  return (await res.json()) as T;
}

/** Forward geocode a street address. */
export async function geocodeAddressGoogle(address: string): Promise<LatLng | null> {
  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("address", address);
  url.searchParams.set("region", "us");
  const data = await googleFetch<{ results?: { geometry?: { location?: { lat: number; lng: number } } }[]; status?: string }>(url);
  if (!data || data.status !== "OK") return null;
  const loc = data.results?.[0]?.geometry?.location;
  if (!loc) return null;
  return { latitude: loc.lat, longitude: loc.lng };
}

/** Reverse geocode coordinates to a formatted address. */
export async function reverseGeocodeGoogle(lat: number, lng: number): Promise<ReverseGeocodeResult | null> {
  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("latlng", `${lat},${lng}`);
  const data = await googleFetch<{ results?: { formatted_address?: string; geometry?: { location?: { lat: number; lng: number } } }[]; status?: string }>(url);
  if (!data || data.status !== "OK") return null;
  const hit = data.results?.[0];
  if (!hit?.formatted_address) return null;
  return {
    formattedAddress: hit.formatted_address,
    latitude: hit.geometry?.location?.lat ?? lat,
    longitude: hit.geometry?.location?.lng ?? lng,
  };
}

function parseRouteLeg(data: {
  routes?: {
    legs?: {
      distance?: { value: number; text: string };
      duration?: { value: number; text: string };
      start_address?: string;
      end_address?: string;
    }[];
    overview_polyline?: { points?: string };
  }[];
  status?: string;
}): RouteResult | null {
  if (data.status !== "OK") return null;
  const route = data.routes?.[0];
  const leg = route?.legs?.[0];
  if (!leg?.distance?.value || !leg?.duration?.value) return null;
  const distanceMeters = leg.distance.value;
  return {
    distanceMeters,
    distanceMiles: distanceMeters / 1609.344,
    durationSeconds: leg.duration.value,
    durationText: leg.duration.text,
    etaText: leg.duration.text,
    polyline: route?.overview_polyline?.points ?? null,
    startAddress: leg.start_address ?? null,
    endAddress: leg.end_address ?? null,
  };
}

/** Driving directions + ETA between two points or addresses. */
export async function getDrivingRoute(origin: LatLng | string, destination: LatLng | string): Promise<RouteResult | null> {
  const url = new URL("https://maps.googleapis.com/maps/api/directions/json");
  url.searchParams.set("origin", latLngParam(origin));
  url.searchParams.set("destination", latLngParam(destination));
  url.searchParams.set("mode", "driving");
  url.searchParams.set("units", "imperial");
  url.searchParams.set("region", "us");
  const data = await googleFetch<Parameters<typeof parseRouteLeg>[0]>(url);
  if (!data) return null;
  return parseRouteLeg(data);
}

/** Distance + duration via Distance Matrix (used when Directions is unavailable). */
export async function getDrivingDistance(origin: LatLng | string, destination: LatLng | string): Promise<RouteResult | null> {
  const url = new URL("https://maps.googleapis.com/maps/api/distancematrix/json");
  url.searchParams.set("origins", latLngParam(origin));
  url.searchParams.set("destinations", latLngParam(destination));
  url.searchParams.set("mode", "driving");
  url.searchParams.set("units", "imperial");
  const data = await googleFetch<{
    rows?: { elements?: { status?: string; distance?: { value: number; text: string }; duration?: { value: number; text: string } }[] }[];
    origin_addresses?: string[];
    destination_addresses?: string[];
    status?: string;
  }>(url);
  if (!data || data.status !== "OK") return null;
  const el = data.rows?.[0]?.elements?.[0];
  if (!el || el.status !== "OK" || !el.distance?.value || !el.duration?.value) return null;
  const distanceMeters = el.distance.value;
  return {
    distanceMeters,
    distanceMiles: distanceMeters / 1609.344,
    durationSeconds: el.duration.value,
    durationText: el.duration.text,
    etaText: el.duration.text,
    polyline: null,
    startAddress: data.origin_addresses?.[0] ?? null,
    endAddress: data.destination_addresses?.[0] ?? null,
  };
}

/** Prefer Directions; fall back to Distance Matrix. */
export async function getRouteWithEta(origin: LatLng | string, destination: LatLng | string): Promise<RouteResult | null> {
  const directions = await getDrivingRoute(origin, destination);
  if (directions) return directions;
  return getDrivingDistance(origin, destination);
}

export function haversineMiles(a: LatLng, b: LatLng): number {
  const R = 3958.8;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}
