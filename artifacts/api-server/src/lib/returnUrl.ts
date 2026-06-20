/**
 * Helpers for building HTTPS return pages and safely bouncing back into the app
 * after a Stripe-hosted flow (Connect onboarding, Checkout). Stripe requires
 * https success/return URLs, so we land on our own page and then redirect to the
 * caller-supplied destination — but ONLY if it is on the allowlist below, so the
 * return page can never become an open redirect.
 */

/** Origin (proto://host) of the incoming request, honouring the proxy headers. */
export function returnUrlBase(req: any): string {
  const proto = (req.headers["x-forwarded-proto"] as string) || req.protocol || "https";
  const host = (req.headers["x-forwarded-host"] as string) || req.get("host");
  return `${proto}://${host}`;
}

/**
 * Whitelist the deep-link / URL the app may be redirected back to after a Stripe
 * flow. Only the app's own custom scheme, Expo dev URLs, and Replit-hosted web
 * previews are allowed.
 */
export function isAllowedReturnTo(value: string): boolean {
  if (value.startsWith("dumpbroker://")) return true;
  if (value.startsWith("exp://")) return true;
  try {
    const u = new URL(value);
    if (u.protocol !== "https:" && u.protocol !== "http:") return false;
    const host = u.hostname;
    return (
      host === "localhost" ||
      host === "replit.com" ||
      host.endsWith(".replit.dev") ||
      host.endsWith(".replit.app") ||
      host.endsWith(".repl.co") ||
      host.endsWith(".worf.replit.dev") ||
      host.endsWith(".janeway.replit.dev")
    );
  } catch {
    return false;
  }
}
