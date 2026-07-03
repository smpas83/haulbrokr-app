import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "haulbrokr-driver-online";

export type DriverPresence = "online" | "offline" | "busy";

export function useDriverOnline(hasActiveLoad: boolean) {
  const [isOnline, setIsOnlineState] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(STORAGE_KEY) === "true";
  });

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, String(isOnline));
  }, [isOnline]);

  const setIsOnline = useCallback((value: boolean) => {
    setIsOnlineState(value);
  }, []);

  const toggleOnline = useCallback(() => {
    setIsOnlineState((prev) => !prev);
  }, []);

  const presence: DriverPresence = hasActiveLoad ? "busy" : isOnline ? "online" : "offline";

  return { isOnline, setIsOnline, toggleOnline, presence };
}
