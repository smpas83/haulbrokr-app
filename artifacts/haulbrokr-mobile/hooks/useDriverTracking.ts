import { useEffect, useRef } from "react";
import * as Location from "expo-location";

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "/api";

async function pingLocation(jobId: number, lat: number, lng: number) {
  await fetch(`${API_BASE}/jobs/${jobId}/location`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lat, lng }),
  });
}

/** Periodically ping driver GPS to backend for live tracking. */
export function useDriverLocationPing(jobId: number | null, enabled: boolean) {
  const lastPing = useRef(0);

  useEffect(() => {
    if (!enabled || jobId == null) return;

    let cancelled = false;

    const tick = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted" || cancelled) return;
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        const now = Date.now();
        if (now - lastPing.current < 25_000) return;
        lastPing.current = now;
        await pingLocation(jobId, loc.coords.latitude, loc.coords.longitude);
      } catch {
        // Silent — location may be unavailable in simulator
      }
    };

    tick();
    const id = setInterval(tick, 30_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [jobId, enabled]);
}

export async function registerPushToken(token: string, platform: string) {
  await fetch(`${API_BASE}/notifications/register`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ expoPushToken: token, platform }),
  });
}
