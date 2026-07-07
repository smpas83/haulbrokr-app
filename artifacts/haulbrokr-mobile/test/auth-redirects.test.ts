import { describe, expect, it } from "vitest";

import {
  buildClerkRedirectAllowlist,
  CLERK_ALLOWED_REDIRECT_PATTERNS,
  HAULBROKR_OAUTH_CALLBACK_PATH,
  HAULBROKR_OAUTH_SCHEME,
  isHaulBrokrNativeRedirect,
} from "../lib/authRedirectConfig";

describe("authRedirectConfig", () => {
  it("uses haulbrokr scheme constants", () => {
    expect(HAULBROKR_OAUTH_SCHEME).toBe("haulbrokr");
    expect(HAULBROKR_OAUTH_CALLBACK_PATH).toBe("oauth-callback");
    expect(isHaulBrokrNativeRedirect("haulbrokr://oauth-callback")).toBe(true);
  });

  it("builds production Clerk allowlist entries", () => {
    const allowlist = buildClerkRedirectAllowlist("haulbrokr://oauth-callback");
    expect(allowlist).toContain("haulbrokr://oauth-callback");
    expect(allowlist).toContain("https://haulbrokr.com/*");
    expect(allowlist).toContain("https://www.haulbrokr.com/*");
  });

  it("documents required Clerk dashboard patterns", () => {
    expect(CLERK_ALLOWED_REDIRECT_PATTERNS).toContain("haulbrokr://");
    expect(CLERK_ALLOWED_REDIRECT_PATTERNS).toContain("haulbrokr://*");
  });
});
