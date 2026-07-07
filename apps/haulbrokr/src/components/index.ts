/** Branding and UI metadata owned by the HaulBrokr application adapter. */
export const HAULBROKR_BRANDING = {
  appName: "HaulBrokr",
  supportEmail: "support@haulbrokr.com",
  copilotName: "HaulBrokr AI",
  primaryDomain: "haulbrokr.com",
  deepLinkScheme: "haulbrokr",
} as const;

export const HAULBROKR_AUTH_REDIRECTS = {
  nativeScheme: "haulbrokr",
  nativeCallbackPath: "oauth-callback",
  webOrigins: ["https://haulbrokr.com", "https://www.haulbrokr.com"],
} as const;
