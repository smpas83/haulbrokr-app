export type GeoCoord = { latitude: number; longitude: number };

const cache = new Map<string, GeoCoord | null>();
let lastRequestAt = 0;

/** Forward-geocode a US street address via OpenStreetMap Nominatim (free, no API key). */
export async function geocodeAddress(address: string): Promise<GeoCoord | null> {
  const key = address.trim().toLowerCase();
  if (!key) return null;
  if (cache.has(key)) return cache.get(key) ?? null;

  const now = Date.now();
  const wait = Math.max(0, 1100 - (now - lastRequestAt));
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastRequestAt = Date.now();

  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1&countrycodes=us`;
    const res = await fetch(url, { headers: { "User-Agent": "HaulBrokr/1.0 (jobs-map)" } });
    if (!res.ok) {
      cache.set(key, null);
      return null;
    }
    const data = await res.json();
    if (Array.isArray(data) && data[0]?.lat && data[0]?.lon) {
      const coord = {
        latitude: parseFloat(data[0].lat),
        longitude: parseFloat(data[0].lon),
      };
      if (Number.isFinite(coord.latitude) && Number.isFinite(coord.longitude)) {
        cache.set(key, coord);
        return coord;
      }
    }
    cache.set(key, null);
    return null;
  } catch {
    cache.set(key, null);
    return null;
  }
}

/** Haversine distance in miles between two coordinates. */
export function distanceMiles(
  a: GeoCoord,
  b: GeoCoord,
): number {
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
