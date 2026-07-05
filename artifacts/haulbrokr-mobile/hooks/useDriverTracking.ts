import { useEffect, useRef } from "react";
import { useAuth } from "@clerk/expo";
import * as Location from "expo-location";

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "/api";

async function pingLocation(
  getToken: () => Promise<string | null>,
  jobId: number,
  lat: number,
  lng: number,
) {
  const token = await getToken();
  const res = await fetch(`${API_BASE}/jobs/${jobId}/location`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ lat, lng }),
  });
  if (!res.ok) {
    throw new Error("Failed to ping location");
  }
}

/** Periodically ping driver GPS to backend for live tracking. */
export function useDriverLocationPing(jobId: number | null, enabled: boolean) {
  const { getToken } = useAuth();
  const lastPing = useRef(0);

  useEffect(() => {
    if (!enabled || jobId == null) return;

    let cancelled = false;

    const tick = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted" || cancelled) return;
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const now = Date.now();
        if (now - lastPing.current < 25_000) return;
        lastPing.current = now;
        await pingLocation(getToken, jobId, loc.coords.latitude, loc.coords.longitude);
      } catch {
        // Silent — location may be unavailable in simulator
      }
    };

    tick();
    const id = setInterval(tick, 30_000);
    return () => { cancelled = true; clearInterval(id); };
  }, [jobId, enabled, getToken]);
}

export async function registerPushToken(token: string, platform: string) {
  await fetch(`${API_BASE}/notifications/register`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ expoPushToken: token, platform }),
  });
}
