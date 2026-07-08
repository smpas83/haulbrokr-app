import { describe, expect, it, vi } from "vitest";

vi.mock("expo-auth-session", () => ({
  makeRedirectUri: (opts?: { scheme?: string; path?: string; native?: string }) => {
    if (opts?.native) return opts.native;
    const scheme = opts?.scheme ?? "haulbrokr";
    const path = opts?.path ? `/${opts.path}` : "";
    return `${scheme}://${path.replace(/^\//, "")}`;
  },
}));

vi.mock("expo-constants", () => ({
  default: {
    expoConfig: {
      ios: {
        bundleIdentifier: "com.haulbrokr.mobile",
        usesAppleSignIn: true,
      },
      extra: {},
    },
  },
}));

vi.mock("react-native", () => ({
  Platform: { OS: "ios" },
}));

import {
  CLERK_ALLOWED_REDIRECT_URIS,
  CLERK_SSO_CALLBACK_PATH,
  EXPECTED_APPLE_TEAM_ID,
  EXPECTED_IOS_BUNDLE_ID,
  HAULBROKR_URL_SCHEME,
  clerkOAuthRedirectUri,
  getAppleSignInConfigAudit,
} from "../lib/clerkOAuth";
import {
  clerkErrorMessage,
  isInvalidVerificationCodeError,
  isUserCancelledAuthError,
  serializeAuthError,
} from "../lib/clerkAuthLogging";

describe("clerkOAuth", () => {
  it("uses stable haulbrokr sso-callback redirect for production", () => {
    expect(HAULBROKR_URL_SCHEME).toBe("haulbrokr");
    expect(CLERK_SSO_CALLBACK_PATH).toBe("sso-callback");
    expect(clerkOAuthRedirectUri()).toBe("haulbrokr://sso-callback");
  });

  it("documents Clerk dashboard allowlist", () => {
    expect(CLERK_ALLOWED_REDIRECT_URIS).toContain("haulbrokr://");
    expect(CLERK_ALLOWED_REDIRECT_URIS).toContain("haulbrokr://*");
    expect(CLERK_ALLOWED_REDIRECT_URIS).toContain("haulbrokr://sso-callback");
    expect(CLERK_ALLOWED_REDIRECT_URIS).toContain("https://haulbrokr.com/*");
    expect(CLERK_ALLOWED_REDIRECT_URIS).toContain("https://www.haulbrokr.com/*");
  });

  it("audits Apple Sign-In configuration at runtime", () => {
    const audit = getAppleSignInConfigAudit();
    expect(audit.expectedBundleId).toBe(EXPECTED_IOS_BUNDLE_ID);
    expect(audit.expectedTeamId).toBe(EXPECTED_APPLE_TEAM_ID);
    expect(audit.bundleIdMatches).toBe(true);
    expect(audit.usesAppleSignIn).toBe(true);
    expect(audit.runtimeRedirectUri).toBe("haulbrokr://sso-callback");
  });
});

describe("clerkAuthLogging", () => {
  it("extracts Clerk error messages", () => {
    expect(clerkErrorMessage({ longMessage: "Email already taken" })).toBe("Email already taken");
    expect(
      clerkErrorMessage({
        errors: [{ code: "form_code_incorrect", message: "is incorrect" }],
      }),
    ).toBe("is incorrect");
  });

  it("detects invalid verification codes only", () => {
    expect(isInvalidVerificationCodeError({ code: "form_code_incorrect", message: "is incorrect" })).toBe(true);
    expect(isInvalidVerificationCodeError({ message: "session activation failed" })).toBe(false);
  });

  it("detects user-cancelled auth errors", () => {
    expect(isUserCancelledAuthError({ code: "ERR_REQUEST_CANCELED" })).toBe(true);
    expect(isUserCancelledAuthError({ code: "SIGN_IN_CANCELLED" })).toBe(true);
    expect(isUserCancelledAuthError({ message: "bundle id mismatch" })).toBe(false);
  });

  it("serializes nested Clerk errors and response bodies", () => {
    const serialized = serializeAuthError({
      message: "OAuth failed",
      errors: [{ code: "oauth_failed", longMessage: "Invalid token", meta: { provider: "apple" } }],
      response: { status: 422, data: { clerk_trace_id: "trace_123" } },
    });
    expect(serialized.message).toBe("OAuth failed");
    expect(serialized.clerkErrors).toEqual([
      { code: "oauth_failed", message: undefined, longMessage: "Invalid token", meta: { provider: "apple" } },
    ]);
    expect(serialized.response).toEqual({
      status: 422,
      data: { clerk_trace_id: "trace_123" },
    });
  });
});
