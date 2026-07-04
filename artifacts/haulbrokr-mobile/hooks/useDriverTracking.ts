import { useAuth } from "@clerk/expo";
import { useEffect, useRef } from "react";
import * as Location from "expo-location";

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "/api";

async function authFetch(
  getToken: () => Promise<string | null>,
  path: string,
  init?: RequestInit,
) {
  const token = await getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? "Request failed");
  }
  return res;
}

async function pingLocation(
  getToken: () => Promise<string | null>,
  jobId: number,
  lat: number,
  lng: number,
) {
  await authFetch(getToken, `/jobs/${jobId}/location`, {
    method: "POST",
    body: JSON.stringify({ lat, lng }),
  });
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
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        const now = Date.now();
        if (now - lastPing.current < 25_000) return;
        lastPing.current = now;
        await pingLocation(
          getToken,
          jobId,
          loc.coords.latitude,
          loc.coords.longitude,
        );
      } catch {
        // Location may be unavailable in simulator or when permissions are denied.
      }
    };

    tick();
    const id = setInterval(tick, 30_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [jobId, enabled, getToken]);
}

export async function registerPushToken(
  getToken: () => Promise<string | null>,
  token: string,
  platform: string,
) {
  await authFetch(getToken, "/notifications/register", {
    method: "POST",
    body: JSON.stringify({ expoPushToken: token, platform }),
  });
}
