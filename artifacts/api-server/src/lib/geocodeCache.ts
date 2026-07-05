/**
 * Server-side geocode cache for marketplace map coordinates.
 * Production: Google Geocoding API only (GOOGLE_MAPS_API_KEY required).
 * Development: Google when configured; Nominatim fallback for local dev without a key.
 */

import { geocodeAddressGoogle } from "./googleMapsService";

type GeoResult = { latitude: number; longitude: number };

const cache = new Map<string, GeoResult>();
const inflight = new Map<string, Promise<GeoResult | null>>();

async function geocodeNominatimDevOnly(address: string): Promise<GeoResult | null> {
  if (process.env.NODE_ENV === "production") return null;
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", address);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "us");
  const res = await fetch(url.toString(), {
    headers: { "User-Agent": "HaulBrokr/1.0 (marketplace-map-dev)" },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { lat?: string; lon?: string }[];
  const hit = data[0];
  if (!hit?.lat || !hit.lon) return null;
  return { latitude: parseFloat(hit.lat), longitude: parseFloat(hit.lon) };
}

export async function geocodeAddressCached(address: string): Promise<GeoResult | null> {
  const key = address.trim().toLowerCase();
  if (!key) return null;
  const hit = cache.get(key);
  if (hit) return hit;

  let pending = inflight.get(key);
  if (!pending) {
    pending = (async () => {
      const google = await geocodeAddressGoogle(address);
      const result = google ?? await geocodeNominatimDevOnly(address);
      if (result) cache.set(key, result);
      inflight.delete(key);
      return result;
    })();
    inflight.set(key, pending);
  }
  return pending;
}

/** Test helper — reset in-memory cache between tests. */
export function resetGeocodeCacheForTests(): void {
  cache.clear();
  inflight.clear();
}
