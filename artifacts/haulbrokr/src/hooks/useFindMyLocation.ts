import { useCallback, useEffect, useRef, useState } from "react";

export type UserCoords = { latitude: number; longitude: number };

export type LocationPermissionState = "unknown" | "granted" | "denied" | "unsupported";

export function useFindMyLocation() {
  const [coords, setCoords] = useState<UserCoords | null>(null);
  const [permission, setPermission] = useState<LocationPermissionState>("unknown");
  const [error, setError] = useState<string | null>(null);
  const [following, setFollowing] = useState(false);
  const [locating, setLocating] = useState(false);
  const watchRef = useRef<number | null>(null);

  const stopFollowing = useCallback(() => {
    if (watchRef.current != null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchRef.current);
    }
    watchRef.current = null;
    setFollowing(false);
  }, []);

  const findLocation = useCallback(async (opts?: { follow?: boolean }) => {
    setError(null);

    if (!navigator.geolocation) {
      setPermission("unsupported");
      setError("Your browser does not support location services.");
      return null;
    }

    setLocating(true);

    return new Promise<UserCoords | null>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const next = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
          setCoords(next);
          setPermission("granted");
          setLocating(false);

          if (opts?.follow) {
            stopFollowing();
            setFollowing(true);
            watchRef.current = navigator.geolocation.watchPosition(
              (update) => setCoords({ latitude: update.coords.latitude, longitude: update.coords.longitude }),
              () => {},
              { enableHighAccuracy: true, maximumAge: 10_000, timeout: 15_000 },
            );
          }

          resolve(next);
        },
        (err) => {
          setLocating(false);
          if (err.code === err.PERMISSION_DENIED) {
            setPermission("denied");
            setError("Location permission was denied. Allow location access in your browser settings, then tap Retry.");
          } else if (err.code === err.POSITION_UNAVAILABLE) {
            setError("Your location is currently unavailable. Try again in a moment.");
          } else {
            setError("Unable to determine your location right now.");
          }
          resolve(null);
        },
        { enableHighAccuracy: true, maximumAge: 15_000, timeout: 15_000 },
      );
    });
  }, [stopFollowing]);

  const recenter = useCallback(async () => findLocation({ follow: following }), [findLocation, following]);

  useEffect(() => () => stopFollowing(), [stopFollowing]);

  return { coords, permission, error, following, locating, findLocation, recenter, stopFollowing, setFollowing };
}
