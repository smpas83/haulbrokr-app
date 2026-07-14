import { LiveQcMobileFmcsaProvider } from "./liveQcMobileProvider";
import { ManualReviewFmcsaProvider } from "./manualReviewProvider";
import type { FmcsaLookupResult, FmcsaProvider, FmcsaProviderHealth } from "./types";

export * from "./types";
export { LiveQcMobileFmcsaProvider } from "./liveQcMobileProvider";
export { ManualReviewFmcsaProvider } from "./manualReviewProvider";
export { clearFmcsaCache } from "./liveQcMobileProvider";

let cachedProvider: FmcsaProvider | null = null;

/**
 * Resolve the active FMCSA provider.
 * Prefers live QCMobile when FMCSA_WEB_KEY is set; otherwise manual review.
 */
export function getFmcsaProvider(): FmcsaProvider {
  if (cachedProvider) return cachedProvider;
  const live = new LiveQcMobileFmcsaProvider();
  cachedProvider = live.hasCredentials() ? live : new ManualReviewFmcsaProvider();
  return cachedProvider;
}

/** Test hook */
export function setFmcsaProviderForTests(provider: FmcsaProvider | null): void {
  cachedProvider = provider;
}

export async function getFmcsaReadiness(): Promise<{
  provider: string;
  health: FmcsaProviderHealth;
  liveConfigured: boolean;
  manualFallbackAvailable: boolean;
}> {
  const live = new LiveQcMobileFmcsaProvider();
  const liveConfigured = live.hasCredentials();
  const health = liveConfigured ? await live.health() : "missing_credentials";
  return {
    provider: liveConfigured ? "qc_mobile_live" : "manual_review",
    health,
    liveConfigured,
    manualFallbackAvailable: true,
  };
}

/**
 * Lookup carrier; fall back to manual review on live failure / missing creds.
 * Never auto-verifies on incomplete data.
 */
export async function lookupCarrierByDot(dotNumber: string): Promise<FmcsaLookupResult> {
  const live = new LiveQcMobileFmcsaProvider();
  if (!live.hasCredentials()) {
    return new ManualReviewFmcsaProvider().lookupByDot(dotNumber);
  }

  const result = await live.lookupByDot(dotNumber);
  if (
    result.code === "provider_unavailable" ||
    result.code === "missing_credentials"
  ) {
    const manual = await new ManualReviewFmcsaProvider().lookupByDot(dotNumber);
    return {
      ...manual,
      errorMessage: result.errorMessage ?? manual.errorMessage,
      rawFields: { ...manual.rawFields, liveError: result.code },
    };
  }
  return result;
}
