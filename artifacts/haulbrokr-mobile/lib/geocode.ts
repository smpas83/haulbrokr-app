/**
 * Production geocoding via the HaulBrokr API (Google Maps on the server).
 * Nominatim is not used in production mobile builds.
 */

export type GeoCoord = { latitude: number; longitude: number };

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "/api";

const cache = new Map<string, GeoCoord | null>();

async function mapsFetch<T>(
  getToken: () => Promise<string | null>,
  path: string,
  body: object,
): Promise<T | null> {
  const token = await getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) return null;
  return (await res.json()) as T;
}

/** Forward-geocode via POST /maps/geocode (Google on server). */
export async function geocodeAddressViaApi(
  getToken: () => Promise<string | null>,
  address: string,
): Promise<GeoCoord | null> {
  const key = address.trim().toLowerCase();
  if (!key) return null;
  if (cache.has(key)) return cache.get(key) ?? null;

  const result = await mapsFetch<GeoCoord>(getToken, "/maps/geocode", { address: address.trim() });
  cache.set(key, result);
  return result;
}

/** @deprecated Use geocodeAddressViaApi — kept for tests importing distanceMiles only. */
export async function geocodeAddress(address: string): Promise<GeoCoord | null> {
  if (process.env.NODE_ENV !== "production") {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1&countrycodes=us`;
    try {
      const res = await fetch(url, { headers: { "User-Agent": "HaulBrokr/1.0 (test)" } });
      if (!res.ok) return null;
      const data = await res.json();
      if (Array.isArray(data) && data[0]?.lat && data[0]?.lon) {
        return { latitude: parseFloat(data[0].lat), longitude: parseFloat(data[0].lon) };
      }
    } catch {
      return null;
    }
  }
  return null;
}

export type RouteInfo = {
  distanceMiles: number;
  durationSeconds: number;
  durationText: string;
  etaText: string;
};

export async function fetchRouteDistance(
  getToken: () => Promise<string | null>,
  origin: GeoCoord,
  destination: GeoCoord,
): Promise<RouteInfo | null> {
  return mapsFetch<RouteInfo>(getToken, "/maps/distance", {
    origin: { latitude: origin.latitude, longitude: origin.longitude },
    destination: { latitude: destination.latitude, longitude: destination.longitude },
  });
}

/** Haversine distance in miles between two coordinates. */
export function distanceMiles(a: GeoCoord, b: GeoCoord): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 3958.8;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}
