import { useCallback, useEffect, useRef, useState } from "react";
import * as Location from "expo-location";

export type UserCoords = { latitude: number; longitude: number };

export type LocationPermissionState = "unknown" | "granted" | "denied" | "unsupported";

export function useFindMyLocation() {
  const [coords, setCoords] = useState<UserCoords | null>(null);
  const [permission, setPermission] = useState<LocationPermissionState>("unknown");
  const [error, setError] = useState<string | null>(null);
  const [following, setFollowing] = useState(false);
  const [locating, setLocating] = useState(false);
  const watchRef = useRef<Location.LocationSubscription | null>(null);

  const stopFollowing = useCallback(() => {
    watchRef.current?.remove();
    watchRef.current = null;
    setFollowing(false);
  }, []);

  const findLocation = useCallback(async (opts?: { follow?: boolean }) => {
    setError(null);
    setLocating(true);
    try {
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        setPermission("unsupported");
        setError("Location services are turned off on this device. Enable them in Settings to use Find My Location.");
        return null;
      }

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setPermission("denied");
        setError("Location permission was denied. Enable location access in Settings, then tap Retry.");
        return null;
      }

      setPermission("granted");
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const next = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
      setCoords(next);

      if (opts?.follow) {
        stopFollowing();
        setFollowing(true);
        watchRef.current = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.Balanced, distanceInterval: 20, timeInterval: 5000 },
          (update) => setCoords({ latitude: update.coords.latitude, longitude: update.coords.longitude }),
        );
      }

      return next;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to determine your location right now.");
      return null;
    } finally {
      setLocating(false);
    }
  }, [stopFollowing]);

  const recenter = useCallback(async () => {
    return findLocation({ follow: following });
  }, [findLocation, following]);

  useEffect(() => () => stopFollowing(), [stopFollowing]);

  return { coords, permission, error, following, locating, findLocation, recenter, stopFollowing, setFollowing };
}
