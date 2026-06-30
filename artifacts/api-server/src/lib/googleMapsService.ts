type LatLng = { lat: number; lng: number };

export type RouteRequest = {
  origin: string | LatLng;
  destination: string | LatLng;
  departureTime?: string;
};

export type RouteResult = {
  distanceMeters: number;
  durationSeconds: number;
  trafficDurationSeconds: number | null;
  eta: string | null;
  encodedPolyline: string | null;
  providerPayload: unknown;
};

function apiKey(): string {
  const key = process.env.GOOGLE_MAPS_API_KEY ?? process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!key) throw Object.assign(new Error("Google Maps API key is not configured."), { status: 503 });
  return key;
}

async function fetchJson(url: URL, init?: RequestInit): Promise<any> {
  const res = await fetch(url, init);
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    throw Object.assign(new Error(`Google Maps request failed with HTTP ${res.status}`), { status: 502, details: data });
  }
  return data;
}

function formatLatLng(value: string | LatLng): string {
  return typeof value === "string" ? value : `${value.lat},${value.lng}`;
}

export async function geocodeAddress(address: string): Promise<any> {
  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("address", address);
  url.searchParams.set("key", apiKey());
  return fetchJson(url);
}

export async function reverseGeocode(lat: number, lng: number): Promise<any> {
  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("latlng", `${lat},${lng}`);
  url.searchParams.set("key", apiKey());
  return fetchJson(url);
}

export async function placesAutocomplete(input: string): Promise<any> {
  const url = new URL("https://maps.googleapis.com/maps/api/place/autocomplete/json");
  url.searchParams.set("input", input);
  url.searchParams.set("types", "geocode");
  url.searchParams.set("key", apiKey());
  return fetchJson(url);
}

export async function calculateRoute(input: RouteRequest): Promise<RouteResult> {
  const url = new URL("https://routes.googleapis.com/directions/v2:computeRoutes");
  const body = {
    origin: { address: formatLatLng(input.origin) },
    destination: { address: formatLatLng(input.destination) },
    travelMode: "DRIVE",
    routingPreference: "TRAFFIC_AWARE",
    computeAlternativeRoutes: false,
    departureTime: input.departureTime,
  };
  const data = await fetchJson(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-goog-api-key": apiKey(),
      "x-goog-fieldmask": "routes.duration,routes.staticDuration,routes.distanceMeters,routes.polyline.encodedPolyline",
    },
    body: JSON.stringify(body),
  });
  const route = data?.routes?.[0];
  if (!route) {
    throw Object.assign(new Error("Google Routes returned no route."), { status: 422, details: data });
  }
  const durationSeconds = parseDuration(route.staticDuration ?? route.duration);
  const trafficDurationSeconds = route.duration ? parseDuration(route.duration) : null;
  const eta = trafficDurationSeconds == null
    ? null
    : new Date(Date.now() + trafficDurationSeconds * 1000).toISOString();
  return {
    distanceMeters: Number(route.distanceMeters ?? 0),
    durationSeconds,
    trafficDurationSeconds,
    eta,
    encodedPolyline: route.polyline?.encodedPolyline ?? null,
    providerPayload: data,
  };
}

function parseDuration(value: string | undefined): number {
  if (!value) return 0;
  const match = value.match(/^([0-9.]+)s$/);
  return match ? Math.round(Number(match[1])) : 0;
}
