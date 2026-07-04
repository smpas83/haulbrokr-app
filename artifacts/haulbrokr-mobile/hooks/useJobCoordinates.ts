import { useEffect, useMemo, useState } from "react";
import type { Job } from "@/context/AppContext";
import { geocodeAddress, type GeoCoord } from "@/lib/geocode";

/** Geocode pickup addresses for map markers; results are cached in geocode.ts. */
export function useJobCoordinates(jobs: Job[]) {
  const [coordsByJobId, setCoordsByJobId] = useState<Record<string, GeoCoord>>(
    {},
  );
  const [loading, setLoading] = useState(false);

  const jobsKey = useMemo(
    () => jobs.map((j) => `${j.id}:${j.pickupAddress}`).join("|"),
    [jobs],
  );

  useEffect(() => {
    let cancelled = false;
    if (!jobs.length) {
      setCoordsByJobId({});
      return;
    }

    (async () => {
      setLoading(true);
      const next: Record<string, GeoCoord> = {};
      for (const job of jobs) {
        if (!job.pickupAddress?.trim()) continue;
        const coord = await geocodeAddress(job.pickupAddress);
        if (cancelled) return;
        if (coord) next[job.id] = coord;
      }
      if (!cancelled) {
        setCoordsByJobId(next);
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [jobsKey, jobs]);

  return { coordsByJobId, loading };
}
