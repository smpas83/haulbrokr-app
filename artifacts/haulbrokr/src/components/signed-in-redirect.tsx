import { useEffect, useState } from "react";
import { lazy, Suspense } from "react";

const SignedInRedirectInner = lazy(() => import("./signed-in-redirect-inner"));

/**
 * After the landing page paints, lazily load Clerk during idle time and redirect
 * signed-in users to the dashboard without blocking initial page load.
 */
export function SignedInRedirect() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const schedule =
      typeof requestIdleCallback === "function"
        ? requestIdleCallback
        : (cb: () => void) => window.setTimeout(cb, 1);
    const cancel =
      typeof cancelIdleCallback === "function"
        ? cancelIdleCallback
        : (id: number) => window.clearTimeout(id);

    const id = schedule(() => setReady(true));
    return () => cancel(id);
  }, []);

  if (!ready) return null;

  return (
    <Suspense fallback={null}>
      <SignedInRedirectInner />
    </Suspense>
  );
}
