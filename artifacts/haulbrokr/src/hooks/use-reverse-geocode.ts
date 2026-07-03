import { useCallback, useState } from "react";

/** Browser geolocation + OpenStreetMap Nominatim reverse geocoding. */
export function useReverseGeocode() {
  const [loading, setLoading] = useState(false);

  const getAddress = useCallback(async (): Promise<string | null> => {
    if (!navigator.geolocation) return null;
    setLoading(true);
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
        }),
      );
      const { latitude, longitude } = pos.coords;
      const resp = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`,
        { headers: { Accept: "application/json", "Accept-Language": "en" } },
      );
      if (!resp.ok) return null;
      const data = await resp.json();
      const a = data.address || {};
      const parts = [
        a.house_number,
        a.road,
        a.city || a.town || a.village || a.county,
        a.state,
        a.postcode,
      ].filter(Boolean);
      return parts.join(", ") || data.display_name || null;
    } catch {
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    getAddress,
    getAddressFromLocation: getAddress,
    loading,
    geoLoading: loading,
  };
}
