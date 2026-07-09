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
import {
  isOAuthUserCancel,
  resolveOAuthSessionId,
  sanitizeClerkUsername,
  usernameFromEmail,
} from "../lib/completeOAuthSignUp";

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

describe("completeOAuthSignUp", () => {
  it("sanitizes usernames for Clerk", () => {
    expect(sanitizeClerkUsername("Apple Review!")).toMatch(/^apple_review/);
    expect(sanitizeClerkUsername("ab").length).toBeGreaterThanOrEqual(4);
  });

  it("builds usernames from email local-parts", () => {
    const name = usernameFromEmail("reviewer@privaterelay.appleid.com");
    expect(name.startsWith("reviewer_")).toBe(true);
    expect(name.length).toBeLessThanOrEqual(48);
  });

  it("returns existing session ids without updating sign-up", async () => {
    const update = vi.fn();
    const session = await resolveOAuthSessionId({
      createdSessionId: "sess_existing",
      signUp: { status: "missing_requirements", missingFields: ["username"], update },
    });
    expect(session).toBe("sess_existing");
    expect(update).not.toHaveBeenCalled();
  });

  it("fills missing username on Apple transfer sign-up", async () => {
    const signUp = {
      status: "missing_requirements",
      emailAddress: "newuser@example.com",
      missingFields: ["username"],
      createdSessionId: null as string | null,
      update: vi.fn(async () => {
        signUp.createdSessionId = "sess_after_username";
        signUp.status = "complete";
      }),
    };

    const session = await resolveOAuthSessionId({
      createdSessionId: null,
      signUp,
    });

    expect(signUp.update).toHaveBeenCalledOnce();
    expect(signUp.update).toHaveBeenCalledWith(
      expect.objectContaining({ username: expect.stringMatching(/^newuser_/) }),
    );
    expect(session).toBe("sess_after_username");
  });

  it("does not treat missing_requirements as a user cancel", () => {
    expect(
      isOAuthUserCancel({
        createdSessionId: null,
        signUp: { status: "missing_requirements", missingFields: ["username"] },
      }),
    ).toBe(false);
  });
});
