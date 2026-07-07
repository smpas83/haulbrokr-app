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
  default: { expoConfig: { extra: {} } },
}));

vi.mock("react-native", () => ({
  Platform: { OS: "ios" },
}));

import {
  CLERK_ALLOWED_REDIRECT_URIS,
  CLERK_SSO_CALLBACK_PATH,
  HAULBROKR_URL_SCHEME,
  clerkOAuthRedirectUri,
} from "../lib/clerkOAuth";
import { clerkErrorMessage, isInvalidVerificationCodeError } from "../lib/clerkAuthLogging";

describe("clerkOAuth", () => {
  it("uses stable haulbrokr sso-callback redirect for production", () => {
    expect(HAULBROKR_URL_SCHEME).toBe("haulbrokr");
    expect(CLERK_SSO_CALLBACK_PATH).toBe("sso-callback");
    expect(clerkOAuthRedirectUri()).toBe("haulbrokr://sso-callback");
  });

  it("documents Clerk dashboard allowlist", () => {
    expect(CLERK_ALLOWED_REDIRECT_URIS).toContain("haulbrokr://");
    expect(CLERK_ALLOWED_REDIRECT_URIS).toContain("haulbrokr://*");
    expect(CLERK_ALLOWED_REDIRECT_URIS).toContain("https://haulbrokr.com/*");
    expect(CLERK_ALLOWED_REDIRECT_URIS).toContain("https://www.haulbrokr.com/*");
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
});
