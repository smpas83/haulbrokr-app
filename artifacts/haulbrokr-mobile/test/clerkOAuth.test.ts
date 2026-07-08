import { describe, expect, it, vi } from "vitest";

vi.mock("expo-constants", () => ({
  default: {
    expoConfig: { scheme: "haulbrokr" },
  },
}));

import {
  CLERK_ALLOWED_REDIRECT_URIS,
  clerkOAuthRedirectUri,
  isClerkRedirectUriAllowlisted,
} from "@/lib/clerkOAuth";

describe("clerkOAuthRedirectUri", () => {
  it("returns canonical SSO callback matching the Clerk allowlist", () => {
    expect(clerkOAuthRedirectUri("sso-callback")).toBe("haulbrokr://sso-callback");
    expect(isClerkRedirectUriAllowlisted("haulbrokr://sso-callback")).toBe(true);
  });

  it("returns canonical oauth-native-callback", () => {
    expect(clerkOAuthRedirectUri("oauth-native-callback")).toBe("haulbrokr://oauth-native-callback");
    expect(isClerkRedirectUriAllowlisted("haulbrokr://oauth-native-callback")).toBe(true);
  });

  it("rejects expo-auth-session style single-slash redirects", () => {
    expect(isClerkRedirectUriAllowlisted("haulbrokr:/sso-callback")).toBe(false);
    expect(isClerkRedirectUriAllowlisted("haulbrokr:/")).toBe(false);
  });

  it("covers every configured allowlist entry with a generator or root scheme", () => {
    const generated = new Set([
      clerkOAuthRedirectUri("sso-callback"),
      clerkOAuthRedirectUri("oauth-native-callback"),
      clerkOAuthRedirectUri("callback"),
      "haulbrokr://",
    ]);

    for (const allowed of CLERK_ALLOWED_REDIRECT_URIS) {
      expect(generated.has(allowed)).toBe(true);
    }
  });
});
