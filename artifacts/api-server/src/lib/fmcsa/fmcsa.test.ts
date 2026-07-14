import { beforeEach, describe, expect, it, vi } from "vitest";
import { LiveQcMobileFmcsaProvider, clearFmcsaCache } from "./liveQcMobileProvider";
import { ManualReviewFmcsaProvider } from "./manualReviewProvider";
import { lookupCarrierByDot, setFmcsaProviderForTests } from "./index";

describe("FMCSA providers", () => {
  beforeEach(() => {
    clearFmcsaCache();
    setFmcsaProviderForTests(null);
    delete process.env.FMCSA_WEB_KEY;
  });

  it("reports missing credentials when FMCSA_WEB_KEY unset", async () => {
    const live = new LiveQcMobileFmcsaProvider("");
    expect(live.hasCredentials()).toBe(false);
    expect(await live.health()).toBe("missing_credentials");
    const result = await live.lookupByDot("1234567");
    expect(result.code).toBe("missing_credentials");
    expect(result.autoVerifyEligible).toBe(false);
  });

  it("manual review never auto-verifies", async () => {
    const result = await new ManualReviewFmcsaProvider().lookupByDot("1234567");
    expect(result.source).toBe("manual_review");
    expect(result.autoVerifyEligible).toBe(false);
    expect(result.code).toBe("provider_incomplete");
  });

  it("live provider maps complete fixture to autoVerifyEligible", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        content: {
          carrier: {
            legalName: "ACME HAULING LLC",
            operatingStatus: "ACTIVE",
            commonAuthorityStatus: "Active",
            bipdInsuranceOnFile: "Yes",
            safetyRating: "Satisfactory",
          },
        },
      }),
    })) as unknown as typeof fetch;

    const live = new LiveQcMobileFmcsaProvider("test-web-key", undefined, fetchImpl);
    const result = await live.lookupByDot("3847291");
    expect(result.code).toBe("ok");
    expect(result.autoVerifyEligible).toBe(true);
    expect(result.fields.fmcsaAuthority).toBe("verified");
    expect(result.carrier?.legalName).toBe("ACME HAULING LLC");
  });

  it("never auto-verifies partial provider responses", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        content: {
          carrier: {
            legalName: "PARTIAL CARRIER",
            operatingStatus: "ACTIVE",
            // missing authority + insurance
          },
        },
      }),
    })) as unknown as typeof fetch;

    const live = new LiveQcMobileFmcsaProvider("test-web-key", undefined, fetchImpl);
    const result = await live.lookupByDot("111");
    expect(result.code).toBe("provider_incomplete");
    expect(result.autoVerifyEligible).toBe(false);
  });

  it("distinguishes carrier not found", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: false,
      status: 404,
      json: async () => ({}),
    })) as unknown as typeof fetch;
    const live = new LiveQcMobileFmcsaProvider("test-web-key", undefined, fetchImpl);
    const result = await live.lookupByDot("0000000");
    expect(result.code).toBe("carrier_not_found");
    expect(result.autoVerifyEligible).toBe(false);
  });

  it("lookupCarrierByDot falls back to manual when key missing", async () => {
    const result = await lookupCarrierByDot("123");
    expect(result.source).toBe("manual_review");
  });
});
