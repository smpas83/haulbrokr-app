import { useEffect } from "react";
import { useLocation } from "wouter";

/**
 * Lightweight session check for the public landing page.
 * Avoids loading the Clerk SDK (~150KB gzipped) just to redirect signed-in users.
 */
export function SignedInRedirect({ to = "/dashboard" }: { to?: string }) {
  const [, setLocation] = useLocation();

  useEffect(() => {
    const controller = new AbortController();

    fetch("/api/profiles/me", {
      credentials: "include",
      signal: controller.signal,
    })
      .then((res) => {
        if (res.ok) setLocation(to);
      })
      .catch(() => {});

    return () => controller.abort();
  }, [setLocation, to]);

  return null;
}
