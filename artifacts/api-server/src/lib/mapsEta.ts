export type RouteEta = {
  eta: string;
  durationSeconds: number;
  source: "google_maps";
};

export async function estimateGoogleMapsEta(origin: string, destination: string): Promise<RouteEta | null> {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key || !origin || !destination) return null;

  const url = new URL("https://maps.googleapis.com/maps/api/distancematrix/json");
  url.searchParams.set("origins", origin);
  url.searchParams.set("destinations", destination);
  url.searchParams.set("departure_time", "now");
  url.searchParams.set("key", key);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2500);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) return null;
    const body = await response.json() as {
      rows?: Array<{ elements?: Array<{ status?: string; duration?: { value?: number }; duration_in_traffic?: { value?: number } }> }>;
    };
    const element = body.rows?.[0]?.elements?.[0];
    if (element?.status !== "OK") return null;
    const seconds = element.duration_in_traffic?.value ?? element.duration?.value;
    if (!seconds || seconds <= 0) return null;
    return {
      eta: new Date(Date.now() + seconds * 1000).toISOString(),
      durationSeconds: seconds,
      source: "google_maps",
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
