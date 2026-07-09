import { getExpoPublicDomain } from "@/lib/apiConfig";

type MapConfigResponse = {
  googleMapsApiKey?: string;
  error?: string;
};

let cachedRuntimeKey: string | null = null;

function mapConfigUrl(): string {
  const domain = getExpoPublicDomain();
  if (domain) return `https://${domain}/api/map/config`;
  return "/api/map/config";
}

export async function resolveGoogleMapsApiKey(): Promise<string> {
  const envKey =
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ||
    process.env.GOOGLE_MAPS_API_KEY;
  if (envKey) return envKey;

  if (cachedRuntimeKey) return cachedRuntimeKey;

  const res = await fetch(mapConfigUrl());
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
