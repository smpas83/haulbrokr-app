import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/apiFetch";
import type { OperationsCenterData } from "@/lib/operations-types";

export function useOperationsCenter(pollMs = 30_000) {
  const [data, setData] = useState<OperationsCenterData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setError(null);
    return apiFetch<OperationsCenterData>("/operations/center")
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load operations"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, pollMs);
    return () => clearInterval(id);
  }, [refresh, pollMs]);

  return { data, loading, error, refresh };
}
