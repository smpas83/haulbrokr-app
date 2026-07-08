import { useCallback, useState } from "react";
import { useAuth } from "@clerk/react";

/** Reverse-geocode browser GPS coordinates via the API (Google Geocoding on the server). */
export function useReverseGeocode() {
  const { getToken } = useAuth();
  const [loading, setLoading] = useState(false);

  const getAddressFromLocation = useCallback(async (): Promise<string | null> => {
    if (!navigator.geolocation) return null;
    setLoading(true);
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 8000 }),
      );
      const { latitude, longitude } = pos.coords;
      const token = await getToken();
      const resp = await fetch("/api/maps/reverse-geocode", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ lat: latitude, lng: longitude }),
      });
      if (!resp.ok) return null;
      const data = (await resp.json()) as { address?: string };
      return data.address ?? null;
    } catch {
      return null;
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  return { getAddressFromLocation, geoLoading: loading };
}
