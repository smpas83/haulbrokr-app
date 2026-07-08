type MapConfigResponse = {
  googleMapsApiKey?: string;
  error?: string;
};

let cachedRuntimeKey: string | null = null;

export async function resolveGoogleMapsApiKey(): Promise<string> {
  const viteKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  if (viteKey) return viteKey;

  if (cachedRuntimeKey) return cachedRuntimeKey;

  const res = await fetch("/api/map/config");
  const body = (await res.json().catch(() => ({}))) as MapConfigResponse;

  if (!res.ok) {
    throw new Error(body.error ?? "Failed to load Google Maps config");
  }

  if (!body.googleMapsApiKey) {
    throw new Error("GOOGLE_MAPS_API_KEY not configured");
  }

  cachedRuntimeKey = body.googleMapsApiKey;
  return cachedRuntimeKey;
}

export function resetGoogleMapsKeyCacheForTests(): void {
  cachedRuntimeKey = null;
}
