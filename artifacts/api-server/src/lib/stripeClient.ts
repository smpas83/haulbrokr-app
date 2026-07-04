import Stripe from "stripe";
import {
  createMockStripeClient,
  MOCK_PUBLISHABLE_KEY,
} from "./mockStripeClient";
import { logger } from "./logger";

let connectionSettings: any;

/**
 * Force mock payment mode regardless of any configured connection. Useful to
 * keep a deployment in simulation even if a sandbox connection lingers, or to
 * exercise the mock flow locally while a real (test) connection exists.
 */
function mockModeForced(): boolean {
  const v = (process.env.PAYMENTS_MOCK_MODE ?? "").toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

/** True when running inside a published Replit Deployment (production). */
function isProductionDeployment(): boolean {
  return process.env.REPLIT_DEPLOYMENT === "1";
}

/**
 * Result of looking up the Stripe connection for this environment:
 *  - `connected`     → live keys are available; use real Stripe.
 *  - `not_connected` → no Stripe connection is configured (the expected state
 *                      for a deployment shipped without Stripe). Safe to mock.
 *  - `error`         → the lookup itself failed (connector proxy unreachable,
 *                      non-OK response, malformed payload, or a connection that
 *                      exists but is missing usable keys). A connection probably
 *                      DOES exist but is temporarily unavailable — must NOT be
 *                      silently treated as "no Stripe" in production.
 */
type CredResult =
  | { kind: "connected"; publishableKey: string; secretKey: string }
  | { kind: "not_connected" }
  | { kind: "error"; error: unknown };

async function getCredentials(): Promise<CredResult> {
  const envSecret = process.env.STRIPE_SECRET_KEY;
  const envPublishable = process.env.STRIPE_PUBLISHABLE_KEY;
  if (envSecret && envPublishable) {
    return {
      kind: "connected",
      publishableKey: envPublishable,
      secretKey: envSecret,
    };
  }

  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? "repl " + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
      ? "depl " + process.env.WEB_REPL_RENEWAL
      : null;

  // No connector infrastructure / auth token at all → there is simply no Stripe
  // connection to use (the normal state for an app deployed without Stripe).
  if (!hostname || !xReplitToken) return { kind: "not_connected" };

  const connectorName = "stripe";
  const targetEnvironment = isProductionDeployment()
    ? "production"
    : "development";

  const url = new URL(`https://${hostname}/api/v2/connection`);
  url.searchParams.set("include_secrets", "true");
  url.searchParams.set("connector_names", connectorName);
  url.searchParams.set("environment", targetEnvironment);

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      headers: { Accept: "application/json", "X-Replit-Token": xReplitToken },
    });
  } catch (error) {
    // Network failure reaching the connector proxy — a lookup error, NOT proof
    // that Stripe is unconfigured.
    return { kind: "error", error };
  }

  if (!response.ok) {
    return {
      kind: "error",
      error: new Error(
        `Stripe connector lookup returned HTTP ${response.status}`,
      ),
    };
  }

  let data: { items?: any[] };
  try {
    data = (await response.json()) as { items?: any[] };
  } catch (error) {
    return { kind: "error", error };
  }

  connectionSettings = data.items?.[0];

  // A successful response with no items means no Stripe connection is configured
  // for this environment → safe to fall back to mock payment mode.
  if (!connectionSettings) return { kind: "not_connected" };

  const publishableKey = connectionSettings.settings?.publishable;
  const secretKey = connectionSettings.settings?.secret;
  // A connection exists but is missing usable keys is a misconfiguration, not an
  // "unconfigured" state — surface it as an error so production fails closed.
  if (!publishableKey || !secretKey) {
    return {
      kind: "error",
      error: new Error("Stripe connection is missing publishable/secret keys"),
    };
  }

  return { kind: "connected", publishableKey, secretKey };
}

// Log "running in mock mode" at most once per distinct reason so ops can see that
// payments are simulated without flooding the logs (this client is never cached).
const warnedMockReasons = new Set<string>();
function warnMockOnce(reason: string): void {
  if (warnedMockReasons.has(reason)) return;
  warnedMockReasons.add(reason);
  logger.warn(
    { reason, deployment: isProductionDeployment() },
    "Stripe is running in MOCK payment mode — payments are SIMULATED and no money moves. Connect a live Stripe account to process real payments.",
  );
}

/**
 * In production we must never silently simulate payments because a connector
 * lookup failed: a real connection likely exists and is just briefly
 * unreachable, and falling back to mock would record phantom paid/released jobs.
 * So a lookup `error` in production is fatal (caller surfaces a 5xx). In
 * development a lookup error falls back to mock for convenience.
 */
function failClosedOnError(creds: CredResult): boolean {
  return creds.kind === "error" && isProductionDeployment();
}

// WARNING: Never cache this client. Always call this fresh — tokens expire.
// Falls back to a mock client (simulated, always-successful payments) when no
// Stripe connection is configured (or mock mode is forced), so the app never
// hard-requires Stripe. A connector LOOKUP error in production fails closed.
export async function getUncachableStripeClient(): Promise<Stripe> {
  if (mockModeForced()) {
    warnMockOnce("forced");
    return createMockStripeClient();
  }
  const creds = await getCredentials();
  if (creds.kind === "connected") {
    // Pin to snippet-provided API version; cast because installed @types ships a newer one.
    return new Stripe(creds.secretKey, {
      apiVersion: "2025-08-27.basil" as Stripe.LatestApiVersion,
    });
  }
  if (failClosedOnError(creds)) {
    logger.error(
      { err: (creds as { error: unknown }).error },
      "Stripe connector unavailable in production — refusing to fall back to mock payments",
    );
    throw new Error(
      "Payment processing is temporarily unavailable. Please try again shortly.",
    );
  }
  warnMockOnce(creds.kind);
  return createMockStripeClient();
}

// The publishable key is safe to hand to the browser; Stripe Elements needs it to
// initialise Stripe.js. Fetched fresh alongside the secret (tokens expire). In
// mock payment mode a placeholder key is returned (client-side card capture is
// inert until a real Stripe account is connected). A connector lookup error in
// production fails closed rather than returning a placeholder key.
export async function getStripePublishableKey(): Promise<string> {
  if (mockModeForced()) return MOCK_PUBLISHABLE_KEY;
  const creds = await getCredentials();
  if (creds.kind === "connected") return creds.publishableKey;
  if (failClosedOnError(creds)) {
    throw new Error(
      "Payment processing is temporarily unavailable. Please try again shortly.",
    );
  }
  return MOCK_PUBLISHABLE_KEY;
}

/**
 * Whether the app is currently running in mock payment mode. True when mock mode
 * is forced or no Stripe connection is configured. A connector lookup error in
 * production is NOT mock mode (it's an outage that fails closed); in development
 * such an error does fall back to mock.
 */
export async function isMockPaymentMode(): Promise<boolean> {
  if (mockModeForced()) return true;
  const creds = await getCredentials();
  if (creds.kind === "connected") return false;
  if (creds.kind === "error") return !isProductionDeployment();
  return true;
}
