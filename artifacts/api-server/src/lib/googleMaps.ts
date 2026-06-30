export interface LatLng {
  lat: number;
  lng: number;
}

export interface GeocodeResult {
  formattedAddress: string;
  placeId: string | null;
  location: LatLng;
}

export interface PlacePrediction {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText: string;
}

export interface RouteResult {
  origin: LatLng;
  destination: LatLng;
  encodedPolyline: string | null;
  distanceMeters: number;
  durationSeconds: number;
  trafficDurationSeconds: number | null;
  etaAt: Date;
  calculatedAt: Date;
}

export type RoutePoint = LatLng | { address: string };

const GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json";
const PLACES_AUTOCOMPLETE_URL = "https://maps.googleapis.com/maps/api/place/autocomplete/json";
const DIRECTIONS_URL = "https://maps.googleapis.com/maps/api/directions/json";
const ROUTES_URL = "https://routes.googleapis.com/directions/v2:computeRoutes";

function googleMapsApiKey(): string {
  const key = (process.env.GOOGLE_MAPS_SERVER_API_KEY ?? process.env.GOOGLE_MAPS_API_KEY ?? "").trim();
  if (!key) {
    throw Object.assign(new Error("Google Maps server API key is not configured."), { status: 503 });
  }
  return key;
}

export function assertValidLatLng(value: LatLng): void {
  if (!Number.isFinite(value.lat) || value.lat < -90 || value.lat > 90) {
    throw Object.assign(new Error("Latitude must be between -90 and 90."), { status: 400 });
  }
  if (!Number.isFinite(value.lng) || value.lng < -180 || value.lng > 180) {
    throw Object.assign(new Error("Longitude must be between -180 and 180."), { status: 400 });
  }
}

export function isLatLng(value: RoutePoint): value is LatLng {
  return typeof (value as LatLng).lat === "number" && typeof (value as LatLng).lng === "number";
}

async function fetchJson(url: string, init?: RequestInit): Promise<any> {
  const res = await fetch(url, init);
  if (!res.ok) {
    throw Object.assign(new Error(`Google Maps request failed with ${res.status}.`), { status: 502 });
  }
  return res.json();
}

function googleStatusOk(status: string | undefined): boolean {
  return status === "OK" || status === "ZERO_RESULTS";
}

export async function geocodeAddress(address: string): Promise<GeocodeResult> {
  const trimmed = address.trim();
  if (!trimmed) throw Object.assign(new Error("Address is required."), { status: 400 });
  const url = new URL(GEOCODE_URL);
  url.searchParams.set("address", trimmed);
  url.searchParams.set("key", googleMapsApiKey());
  const body = await fetchJson(url.toString());
  if (!googleStatusOk(body.status)) {
    throw Object.assign(new Error(body.error_message ?? `Google geocoding failed: ${body.status}`), { status: 502 });
  }
  const first = body.results?.[0];
  if (!first?.geometry?.location) {
    throw Object.assign(new Error("Address could not be geocoded."), { status: 404 });
  }
  return {
    formattedAddress: first.formatted_address,
    placeId: first.place_id ?? null,
    location: {
      lat: Number(first.geometry.location.lat),
      lng: Number(first.geometry.location.lng),
    },
  };
}

export async function placesAutocomplete(input: string, sessionToken?: string): Promise<PlacePrediction[]> {
  const trimmed = input.trim();
  if (trimmed.length < 2) return [];
  const url = new URL(PLACES_AUTOCOMPLETE_URL);
  url.searchParams.set("input", trimmed);
  url.searchParams.set("key", googleMapsApiKey());
  url.searchParams.set("types", "address");
  if (sessionToken) url.searchParams.set("sessiontoken", sessionToken);
  const body = await fetchJson(url.toString());
  if (!googleStatusOk(body.status)) {
    throw Object.assign(new Error(body.error_message ?? `Google Places failed: ${body.status}`), { status: 502 });
  }
  return (body.predictions ?? []).map((prediction: any) => ({
    placeId: prediction.place_id,
    description: prediction.description,
    mainText: prediction.structured_formatting?.main_text ?? prediction.description,
    secondaryText: prediction.structured_formatting?.secondary_text ?? "",
  }));
}

async function resolveRoutePoint(point: RoutePoint): Promise<LatLng> {
  if (isLatLng(point)) {
    assertValidLatLng(point);
    return point;
  }
  return (await geocodeAddress(point.address)).location;
}

export async function directions(origin: RoutePoint, destination: RoutePoint): Promise<RouteResult> {
  const [originLocation, destinationLocation] = await Promise.all([
    resolveRoutePoint(origin),
    resolveRoutePoint(destination),
  ]);
  const url = new URL(DIRECTIONS_URL);
  url.searchParams.set("origin", `${originLocation.lat},${originLocation.lng}`);
  url.searchParams.set("destination", `${destinationLocation.lat},${destinationLocation.lng}`);
  url.searchParams.set("mode", "driving");
  url.searchParams.set("departure_time", "now");
  url.searchParams.set("traffic_model", "best_guess");
  url.searchParams.set("key", googleMapsApiKey());
  const body = await fetchJson(url.toString());
  if (!googleStatusOk(body.status)) {
    throw Object.assign(new Error(body.error_message ?? `Google Directions failed: ${body.status}`), { status: 502 });
  }
  const route = body.routes?.[0];
  const leg = route?.legs?.[0];
  if (!route || !leg) {
    throw Object.assign(new Error("No route found."), { status: 404 });
  }
  const durationSeconds = Number(leg.duration?.value ?? 0);
  const trafficDurationSeconds = leg.duration_in_traffic?.value != null ? Number(leg.duration_in_traffic.value) : null;
  const calculatedAt = new Date();
  const etaAt = new Date(calculatedAt.getTime() + (trafficDurationSeconds ?? durationSeconds) * 1000);
  return {
    origin: originLocation,
    destination: destinationLocation,
    encodedPolyline: route.overview_polyline?.points ?? null,
    distanceMeters: Number(leg.distance?.value ?? 0),
    durationSeconds,
    trafficDurationSeconds,
    etaAt,
    calculatedAt,
  };
}

export async function routes(origin: RoutePoint, destination: RoutePoint): Promise<RouteResult> {
  const [originLocation, destinationLocation] = await Promise.all([
    resolveRoutePoint(origin),
    resolveRoutePoint(destination),
  ]);
  const body = await fetchJson(ROUTES_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": googleMapsApiKey(),
      "X-Goog-FieldMask": "routes.distanceMeters,routes.duration,routes.staticDuration,routes.polyline.encodedPolyline",
    },
    body: JSON.stringify({
      origin: { location: { latLng: { latitude: originLocation.lat, longitude: originLocation.lng } } },
      destination: { location: { latLng: { latitude: destinationLocation.lat, longitude: destinationLocation.lng } } },
      travelMode: "DRIVE",
      routingPreference: "TRAFFIC_AWARE_OPTIMAL",
      computeAlternativeRoutes: false,
    }),
  });
  const route = body.routes?.[0];
  if (!route) {
    throw Object.assign(new Error("No route found."), { status: 404 });
  }
  const trafficDurationSeconds = parseGoogleDuration(route.duration);
  const durationSeconds = parseGoogleDuration(route.staticDuration) ?? trafficDurationSeconds ?? 0;
  const calculatedAt = new Date();
  const etaAt = new Date(calculatedAt.getTime() + (trafficDurationSeconds ?? durationSeconds) * 1000);
  return {
    origin: originLocation,
    destination: destinationLocation,
    encodedPolyline: route.polyline?.encodedPolyline ?? null,
    distanceMeters: Number(route.distanceMeters ?? 0),
    durationSeconds,
    trafficDurationSeconds,
    etaAt,
    calculatedAt,
  };
}

function parseGoogleDuration(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const match = /^(\d+(?:\.\d+)?)s$/.exec(value);
  return match ? Math.round(Number(match[1])) : null;
}

export async function calculateTrafficAwareRoute(origin: RoutePoint, destination: RoutePoint): Promise<RouteResult> {
  try {
    return await routes(origin, destination);
  } catch (err: any) {
    if (err?.status === 503) throw err;
    return directions(origin, destination);
  }
}

export function distanceMeters(a: LatLng, b: LatLng): number {
  assertValidLatLng(a);
  assertValidLatLng(b);
  const radiusMeters = 6371000;
  const phi1 = a.lat * Math.PI / 180;
  const phi2 = b.lat * Math.PI / 180;
  const deltaPhi = (b.lat - a.lat) * Math.PI / 180;
  const deltaLambda = (b.lng - a.lng) * Math.PI / 180;
  const sinPhi = Math.sin(deltaPhi / 2);
  const sinLambda = Math.sin(deltaLambda / 2);
  const h = sinPhi * sinPhi + Math.cos(phi1) * Math.cos(phi2) * sinLambda * sinLambda;
  return Math.round(radiusMeters * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)));
}
