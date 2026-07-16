import { useEffect, useRef } from "react";
import { useLocation } from "wouter";

const SESSION_KEY = "hb_pv_sid";

function getSessionId(): string {
  try {
    const existing = sessionStorage.getItem(SESSION_KEY);
    if (existing && existing.length >= 8) return existing;
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    sessionStorage.setItem(SESSION_KEY, id);
    return id;
  } catch {
    return `s_${Date.now().toString(36)}`;
  }
}

function shouldTrack(path: string): boolean {
  if (!path) return false;
  if (path.startsWith("/admin")) return false;
  if (path.startsWith("/api")) return false;
  return true;
}

function sendPageView(path: string): void {
  if (!shouldTrack(path)) return;
  const body = JSON.stringify({
    path,
    referrer: typeof document !== "undefined" ? document.referrer || null : null,
    sessionId: getSessionId(),
  });
  const base = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
  const url = `${base}/api/analytics/pageview`;

  try {
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      const blob = new Blob([body], { type: "application/json" });
      if (navigator.sendBeacon(url, blob)) return;
    }
  } catch {
    // fall through to fetch
  }

  void fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    credentials: "omit",
    keepalive: true,
  }).catch(() => {
    /* analytics must never surface errors */
  });
}

/**
 * Fires a page-view beacon on each client-side route change (and initial load).
 * Mount once near the top of the app tree, inside the Wouter router.
 */
export function PageViewTracker() {
  const [location] = useLocation();
  const last = useRef<string | null>(null);

  useEffect(() => {
    const path = location.split("?")[0] || "/";
    if (last.current === path) return;
    last.current = path;
    sendPageView(path);
  }, [location]);

  return null;
}
