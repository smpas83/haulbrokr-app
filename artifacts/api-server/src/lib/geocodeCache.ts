/**
 * Server-side geocode cache for marketplace map coordinates.
 * Uses Google Geocoding API when GOOGLE_MAPS_API_KEY is set.
 * Nominatim is allowed only outside production (local dev without a Google key).
 */

type GeoResult = { latitude: number; longitude: number };

const cache = new Map<string, GeoResult>();
const inflight = new Map<string, Promise<GeoResult | null>>();

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

function googleMapsKey(): string | null {
  const key = process.env.GOOGLE_MAPS_API_KEY?.trim();
  return key || null;
}

async function geocodeGoogle(address: string): Promise<GeoResult | null> {
  const key = googleMapsKey();
  if (!key) return null;
  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("address", address);
  url.searchParams.set("key", key);
  const res = await fetch(url.toString());
  if (!res.ok) return null;
  const data = (await res.json()) as { results?: { geometry?: { location?: { lat: number; lng: number } } }[] };
  const loc = data.results?.[0]?.geometry?.location;
  if (!loc) return null;
  return { latitude: loc.lat, longitude: loc.lng };
}

async function reverseGeocodeGoogle(lat: number, lng: number): Promise<string | null> {
  const key = googleMapsKey();
  if (!key) return null;
  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("latlng", `${lat},${lng}`);
  url.searchParams.set("key", key);
  const res = await fetch(url.toString());
  if (!res.ok) return null;
  const data = (await res.json()) as { results?: { formatted_address?: string }[] };
  return data.results?.[0]?.formatted_address ?? null;
}

async function geocodeNominatim(address: string): Promise<GeoResult | null> {
  if (isProduction()) return null;
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", address);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "us");
  const res = await fetch(url.toString(), {
    headers: { "User-Agent": "HaulBrokr/1.0 (marketplace-map)" },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { lat?: string; lon?: string }[];
  const hit = data[0];
  if (!hit?.lat || !hit?.lon) return null;
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
      const google = await geocodeGoogle(address);
      const result = google ?? await geocodeNominatim(address);
      if (result) cache.set(key, result);
      inflight.delete(key);
      return result;
    })();
    inflight.set(key, pending);
  }
  return pending;
}

const reverseCache = new Map<string, string>();
const reverseInflight = new Map<string, Promise<string | null>>();

export async function reverseGeocodeAddressCached(lat: number, lng: number): Promise<string | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const key = `${lat.toFixed(6)},${lng.toFixed(6)}`;
  const hit = reverseCache.get(key);
  if (hit) return hit;

  let pending = reverseInflight.get(key);
  if (!pending) {
    pending = (async () => {
      const result = await reverseGeocodeGoogle(lat, lng);
      if (result) reverseCache.set(key, result);
      reverseInflight.delete(key);
      return result;
    })();
    reverseInflight.set(key, pending);
  }
  return pending;
}

/** Test helper — reset in-memory cache between tests. */
export function resetGeocodeCacheForTests(): void {
  cache.clear();
  inflight.clear();
  reverseCache.clear();
  reverseInflight.clear();
}
