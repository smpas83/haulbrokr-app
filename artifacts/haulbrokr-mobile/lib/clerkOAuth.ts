import Constants from "expo-constants";

/** Clerk Native Application redirect allowlist (dashboard → Native applications). */
export const CLERK_ALLOWED_REDIRECT_URIS = [
  "haulbrokr://",
  "haulbrokr://callback",
  "haulbrokr://oauth-native-callback",
  "haulbrokr://sso-callback",
] as const;

export type ClerkOAuthRedirectPath = "sso-callback" | "oauth-native-callback" | "callback";

export type ClerkOAuthAuthPath =
  | "startGoogleAuthenticationFlow"
  | "startAppleAuthenticationFlow"
  | "startSSOFlow";

const LOG_PREFIX = "[ClerkOAuth]";

function resolveAppScheme(): string {
  const fromConfig = Constants.expoConfig?.scheme;
  if (typeof fromConfig === "string" && fromConfig.length > 0) {
    return fromConfig;
  }
  if (Array.isArray(fromConfig) && typeof fromConfig[0] === "string" && fromConfig[0].length > 0) {
    return fromConfig[0];
  }
  return "haulbrokr";
}

/**
 * Canonical redirect URI for Clerk browser-based OAuth / SSO flows.
 * Matches Clerk's useSSO default path (`sso-callback`) using an explicit
 * `scheme://path` form so it aligns with the Native applications allowlist.
 */
export function clerkOAuthRedirectUri(path: ClerkOAuthRedirectPath = "sso-callback"): string {
  const scheme = resolveAppScheme();
  if (path === "callback") {
    return `${scheme}://callback`;
  }
  return `${scheme}://${path}`;
}

export function isClerkRedirectUriAllowlisted(redirectUrl: string): boolean {
  const normalized = redirectUrl.trim();
  return CLERK_ALLOWED_REDIRECT_URIS.some((allowed) => allowed === normalized);
}

export type ClerkOAuthDebugPayload = {
  authPath: ClerkOAuthAuthPath;
  strategy?: "oauth_google" | "oauth_apple";
  redirectUrl?: string;
  redirectAllowlisted?: boolean;
  phase: "start" | "success" | "error" | "cancelled";
  message?: string;
  error?: unknown;
};

export function logClerkOAuthDebug(payload: ClerkOAuthDebugPayload): void {
  const redirectAllowlisted =
    payload.redirectAllowlisted ??
    (payload.redirectUrl == null ? undefined : isClerkRedirectUriAllowlisted(payload.redirectUrl));

  const entry = {
    ...payload,
    redirectAllowlisted,
    appScheme: resolveAppScheme(),
    allowedRedirectUris: CLERK_ALLOWED_REDIRECT_URIS,
    timestamp: new Date().toISOString(),
  };

  if (payload.phase === "error") {
    console.error(LOG_PREFIX, entry);
    return;
  }

  console.log(LOG_PREFIX, entry);
}

export function clerkOAuthUserMessage(error: unknown, provider: "google" | "apple"): string {
  const msg =
    (error as any)?.errors?.[0]?.longMessage ??
    (error as any)?.errors?.[0]?.message ??
    (error as any)?.message ??
    "";

  if (/redirect url.*does not match|authorized redirect uri/i.test(msg)) {
    const redirectUrl = clerkOAuthRedirectUri("sso-callback");
    const allowlisted = isClerkRedirectUriAllowlisted(redirectUrl);
    logClerkOAuthDebug({
      authPath: "startSSOFlow",
      strategy: provider === "google" ? "oauth_google" : "oauth_apple",
      redirectUrl,
      redirectAllowlisted: allowlisted,
      phase: "error",
      message: "Clerk rejected redirect URL",
      error,
    });
    return `Sign-in redirect mismatch (${redirectUrl}, allowlisted=${allowlisted}). Check Clerk Native applications allowlist.`;
  }

  if (/not enabled|provider.*not.*configured|strategy.*not.*allowed/i.test(msg)) {
    return `Sign in with ${provider === "google" ? "Google" : "Apple"} isn't enabled yet — turn it on in the Auth pane.`;
  }

  return msg;
}

export function isOAuthUserCancelled(error: unknown): boolean {
  const code = (error as any)?.code;
  return code === "SIGN_IN_CANCELLED" || code === "-5";
}
