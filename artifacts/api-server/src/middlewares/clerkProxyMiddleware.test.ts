import { describe, expect, it } from "vitest";
import { getClerkProxyHost } from "./clerkProxyMiddleware";

describe("getClerkProxyHost", () => {
  it("uses the leftmost forwarded host when present", () => {
    expect(
      getClerkProxyHost({
        headers: {
          "x-forwarded-host": "haulbrokr.com, haulbrokr-api.onrender.com",
          host: "haulbrokr-api.onrender.com",
        },
      }),
    ).toBe("haulbrokr.com");
  });

  it("falls back to Origin before Host for external rewrites", () => {
    expect(
      getClerkProxyHost({
        headers: {
          origin: "https://haulbrokr.com",
          host: "haulbrokr-api.onrender.com",
        },
      }),
    ).toBe("haulbrokr.com");
  });

  it("falls back to Referer when Origin is absent", () => {
    expect(
      getClerkProxyHost({
        headers: {
          referer: "https://haulbrokr.com/sign-in",
          host: "haulbrokr-api.onrender.com",
        },
      }),
    ).toBe("haulbrokr.com");
  });
});
