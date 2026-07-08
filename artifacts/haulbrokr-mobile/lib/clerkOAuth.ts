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
  "haulbrokr://sso-callback",
  "https://haulbrokr.com/*",
  "https://www.haulbrokr.com/*",
] as const;

/** Expected iOS bundle identifier — must match Apple Developer App ID and Clerk Apple provider. */
export const EXPECTED_IOS_BUNDLE_ID = "com.haulbrokr.mobile";

/** Expected Apple Team ID — must match Clerk Native Applications and eas.json submit config. */
export const EXPECTED_APPLE_TEAM_ID = "B7Z55AHC9L";

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

export type AppleSignInConfigAudit = {
  bundleIdentifier: string | undefined;
  expectedBundleId: string;
  bundleIdMatches: boolean;
  usesAppleSignIn: boolean;
  expectedTeamId: string;
  clerkAllowedRedirectUris: readonly string[];
  runtimeRedirectUri: string;
  runtimeRedirectUriCandidates: string[];
  googleNativeConfigured: boolean;
  platform: string;
};

/** Runtime audit of Apple Sign-In + OAuth configuration for App Store review debugging. */
export function getAppleSignInConfigAudit(): AppleSignInConfigAudit {
  const ios = Constants.expoConfig?.ios;
  const bundleIdentifier = ios?.bundleIdentifier;
  return {
    bundleIdentifier,
    expectedBundleId: EXPECTED_IOS_BUNDLE_ID,
    bundleIdMatches: bundleIdentifier === EXPECTED_IOS_BUNDLE_ID,
    usesAppleSignIn: ios?.usesAppleSignIn === true,
    expectedTeamId: EXPECTED_APPLE_TEAM_ID,
    clerkAllowedRedirectUris: CLERK_ALLOWED_REDIRECT_URIS,
    runtimeRedirectUri: clerkOAuthRedirectUri(),
    runtimeRedirectUriCandidates: clerkOAuthRedirectUriCandidates(),
    googleNativeConfigured: hasGoogleNativeSignInConfig(),
    platform: Platform.OS,
  };
}
