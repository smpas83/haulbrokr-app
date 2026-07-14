import type { FmcsaLookupResult, FmcsaProvider, FmcsaProviderHealth } from "./types";

/**
 * Safe fallback when live FMCSA credentials are missing or the live provider
 * is unavailable. Never auto-verifies.
 */
export class ManualReviewFmcsaProvider implements FmcsaProvider {
  readonly name = "manual_review";

  async health(): Promise<FmcsaProviderHealth> {
    return "not_applicable";
  }

  async lookupByDot(dotNumber: string): Promise<FmcsaLookupResult> {
    const cleaned = String(dotNumber ?? "").replace(/\D/g, "");
    if (!cleaned) {
      return {
        code: "invalid_input",
        source: "manual_review",
        lookedUpAt: new Date().toISOString(),
        health: "not_applicable",
        autoVerifyEligible: false,
        fields: {
          fmcsaAuthority: "unknown",
          insuranceActive: "unknown",
          dotOperatingStatus: "unknown",
          notSuspended: "unknown",
          safetyRating: null,
        },
        rawFields: {},
        errorMessage: "DOT number is required",
      };
    }

    return {
      code: "provider_incomplete",
      source: "manual_review",
      lookedUpAt: new Date().toISOString(),
      health: "not_applicable",
      autoVerifyEligible: false,
      carrier: { dotNumber: cleaned },
      fields: {
        fmcsaAuthority: "unknown",
        insuranceActive: "unknown",
        dotOperatingStatus: "unknown",
        notSuspended: "unknown",
        safetyRating: null,
      },
      rawFields: { mode: "manual_review", reason: "live_fmcsa_not_configured_or_unavailable" },
      errorMessage: "Live FMCSA verification unavailable — queued for staff manual review",
    };
  }
}
