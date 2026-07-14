export type FmcsaProviderHealth =
  | "configured_healthy"
  | "configured_unavailable"
  | "missing_credentials"
  | "not_applicable";

export type FmcsaLookupCode =
  | "ok"
  | "carrier_not_found"
  | "provider_incomplete"
  | "provider_unavailable"
  | "missing_credentials"
  | "invalid_input";

export type FmcsaFieldStatus = "verified" | "failed" | "unknown" | "incomplete";

export type FmcsaLookupResult = {
  code: FmcsaLookupCode;
  source: "live" | "manual_review" | "cache";
  lookedUpAt: string;
  health: FmcsaProviderHealth;
  /** Never auto-verify when incomplete. */
  autoVerifyEligible: boolean;
  carrier?: {
    legalName?: string;
    dbaName?: string;
    dotNumber?: string;
    mcNumber?: string;
    operatingStatus?: string;
    authorityStatus?: string;
    insuranceStatus?: string;
    safetyRating?: string;
    outOfService?: boolean;
  };
  fields: {
    fmcsaAuthority: FmcsaFieldStatus;
    insuranceActive: FmcsaFieldStatus;
    dotOperatingStatus: FmcsaFieldStatus;
    notSuspended: FmcsaFieldStatus;
    safetyRating: string | null;
  };
  rawFields: Record<string, unknown>;
  errorMessage?: string;
};

export interface FmcsaProvider {
  readonly name: string;
  health(): Promise<FmcsaProviderHealth>;
  lookupByDot(dotNumber: string): Promise<FmcsaLookupResult>;
}
