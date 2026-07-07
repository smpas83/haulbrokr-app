import Constants from "expo-constants";
import * as AuthSession from "expo-auth-session";
import { Platform } from "react-native";

/** Custom URL scheme registered in app.json — must match Clerk Native Applications. */
export const HAULBROKR_URL_SCHEME = "haulbrokr";

/**
 * OAuth callback path used by @clerk/expo useSSO when no redirectUrl is passed.
 * Register `haulbrokr://sso-callback` (and wildcards) in the Clerk dashboard.
 */
export const CLERK_SSO_CALLBACK_PATH = "sso-callback";

/** Clerk dashboard redirect URI allowlist for production native + web flows. */
export const CLERK_ALLOWED_REDIRECT_URIS = [
  "haulbrokr://",
  "haulbrokr://*",
  "https://haulbrokr.com/*",
  "https://www.haulbrokr.com/*",
] as const;

/**
 * Stable redirect URI for Clerk OAuth / SSO on native builds.
 * Uses explicit scheme + path so production iOS matches Clerk Native Applications.
 */
export function clerkOAuthRedirectUri(): string {
  return AuthSession.makeRedirectUri({
    scheme: HAULBROKR_URL_SCHEME,
    path: CLERK_SSO_CALLBACK_PATH,
    native: `${HAULBROKR_URL_SCHEME}://${CLERK_SSO_CALLBACK_PATH}`,
  });
}

/** All redirect URIs the running build may emit (for startup diagnostics). */
export function clerkOAuthRedirectUriCandidates(): string[] {
  const primary = clerkOAuthRedirectUri();
  const root = AuthSession.makeRedirectUri({
    scheme: HAULBROKR_URL_SCHEME,
    native: `${HAULBROKR_URL_SCHEME}://`,
  });
  return Array.from(new Set([primary, root]));
}

export function hasGoogleNativeSignInConfig(): boolean {
  const extra = Constants.expoConfig?.extra ?? {};
  const web =
    (extra.EXPO_PUBLIC_CLERK_GOOGLE_WEB_CLIENT_ID as string | undefined) ??
    process.env.EXPO_PUBLIC_CLERK_GOOGLE_WEB_CLIENT_ID;
  const ios =
    (extra.EXPO_PUBLIC_CLERK_GOOGLE_IOS_CLIENT_ID as string | undefined) ??
    process.env.EXPO_PUBLIC_CLERK_GOOGLE_IOS_CLIENT_ID;
  if (!web) return false;
  if (Platform.OS === "ios") return !!ios;
  return true;
}

export function shouldUseNativeAppleSignIn(): boolean {
  return Platform.OS === "ios";
}
