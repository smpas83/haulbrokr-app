import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@clerk/expo";
import type { Job } from "@/context/AppContext";
import { type GeoCoord } from "@/lib/geocode";

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "/api";

/** Geocode pickup addresses for map markers via the API (Google Geocoding on the server). */
export function useJobCoordinates(jobs: Job[]) {
  const { getToken, isSignedIn } = useAuth();
  const [coordsByJobId, setCoordsByJobId] = useState<Record<string, GeoCoord>>({});
  const [loading, setLoading] = useState(false);

  const jobsKey = useMemo(
    () => jobs.map((j) => `${j.id}:${j.pickupAddress}`).join("|"),
    [jobs],
  );

  useEffect(() => {
    let cancelled = false;
    if (!jobs.length || !isSignedIn) {
      setCoordsByJobId({});
      return;
    }

    (async () => {
      setLoading(true);
      const token = await getToken();
      const next: Record<string, GeoCoord> = {};
      for (const job of jobs) {
        if (!job.pickupAddress?.trim()) continue;
        try {
          const res = await fetch(`${API_BASE}/maps/geocode`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({ address: job.pickupAddress }),
          });
          if (cancelled) return;
          if (!res.ok) continue;
          const coord = (await res.json()) as GeoCoord;
          if (Number.isFinite(coord.latitude) && Number.isFinite(coord.longitude)) {
            next[job.id] = coord;
          }
        } catch {
          // Skip failed geocodes — marker simply won't render
        }
      }
      if (!cancelled) {
        setCoordsByJobId(next);
        setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [jobsKey, jobs, getToken, isSignedIn]);

  return { coordsByJobId, loading };
}
