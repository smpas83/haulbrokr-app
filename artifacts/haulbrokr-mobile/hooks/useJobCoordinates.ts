import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@clerk/expo";
import type { Job } from "@/context/AppContext";
import { geocodeAddressViaApi, type GeoCoord } from "@/lib/geocode";

/** Geocode pickup addresses via production Google Maps API (server proxy). */
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
      const next: Record<string, GeoCoord> = {};
      for (const job of jobs) {
        if (!job.pickupAddress?.trim()) continue;
        const coord = await geocodeAddressViaApi(getToken, job.pickupAddress);
        if (cancelled) return;
        if (coord) next[job.id] = coord;
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
