import * as AuthSession from "expo-auth-session";
import * as Linking from "expo-linking";

import {
  buildClerkRedirectAllowlist,
  CLERK_ALLOWED_REDIRECT_PATTERNS,
  HAULBROKR_OAUTH_CALLBACK_PATH,
  HAULBROKR_OAUTH_SCHEME,
} from "./authRedirectConfig";

export {
  CLERK_ALLOWED_REDIRECT_PATTERNS,
  buildClerkRedirectAllowlist,
  HAULBROKR_OAUTH_CALLBACK_PATH,
  HAULBROKR_OAUTH_SCHEME,
} from "./authRedirectConfig";

/**
 * OAuth redirect URI for Clerk native SSO flows.
 * Uses the app-owned deep link scheme so Clerk accepts haulbrokr:// callbacks.
 */
export function getClerkOAuthRedirectUri(): string {
  const explicit = Linking.createURL(HAULBROKR_OAUTH_CALLBACK_PATH, {
    scheme: HAULBROKR_OAUTH_SCHEME,
  });

  if (explicit.startsWith(`${HAULBROKR_OAUTH_SCHEME}://`)) {
    return explicit;
  }

  return AuthSession.makeRedirectUri({
    scheme: HAULBROKR_OAUTH_SCHEME,
    path: HAULBROKR_OAUTH_CALLBACK_PATH,
    preferLocalhost: false,
  });
}

/** All redirect URIs that should be registered in the Clerk dashboard. */
export function getClerkRedirectUriAllowlist(): string[] {
  return buildClerkRedirectAllowlist(getClerkOAuthRedirectUri());
}
