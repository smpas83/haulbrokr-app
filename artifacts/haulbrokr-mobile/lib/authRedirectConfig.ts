/** Clerk-authorized redirect URI patterns for production iOS/Android release builds. */
export const CLERK_ALLOWED_REDIRECT_PATTERNS = [
  "haulbrokr://",
  "haulbrokr://*",
  "https://haulbrokr.com/*",
  "https://www.haulbrokr.com/*",
] as const;

export const HAULBROKR_OAUTH_SCHEME = "haulbrokr";
export const HAULBROKR_OAUTH_CALLBACK_PATH = "oauth-callback";

export const HAULBROKR_WEB_ORIGINS = [
  "https://haulbrokr.com",
  "https://www.haulbrokr.com",
] as const;

/** Build the Clerk dashboard allowlist given the resolved native OAuth redirect URI. */
export function buildClerkRedirectAllowlist(nativeOAuthUri: string): string[] {
  return [
    nativeOAuthUri,
    `${HAULBROKR_OAUTH_SCHEME}://`,
    `${HAULBROKR_OAUTH_SCHEME}://${HAULBROKR_OAUTH_CALLBACK_PATH}`,
    "https://haulbrokr.com/*",
    "https://www.haulbrokr.com/*",
    ...HAULBROKR_WEB_ORIGINS.map((origin) => `${origin}/*`),
  ];
}

/** Returns true when a redirect URI uses the authorized haulbrokr native scheme. */
export function isHaulBrokrNativeRedirect(uri: string): boolean {
  return uri.startsWith(`${HAULBROKR_OAUTH_SCHEME}://`);
}
