import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

import {
  lookupCarrierByDot,
  lookupCarrierByMc,
  lookupCarrierAuthority,
  deriveComplianceFromFmcsa,
  isFmcsaConfigured,
} from "./fmcsaClient";

beforeEach(() => {
  fetchMock.mockReset();
  delete process.env.FMCSA_WEB_KEY;
});

afterEach(() => {
  delete process.env.FMCSA_WEB_KEY;
});

describe("fmcsaClient", () => {
  it("reports not configured without FMCSA_WEB_KEY", () => {
    expect(isFmcsaConfigured()).toBe(false);
  });

  it("returns fmcsa_not_configured when looking up without a key", async () => {
    const result = await lookupCarrierByDot("123456");
    expect(result).toMatchObject({ ok: false, code: "fmcsa_not_configured", retryable: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("looks up a carrier by DOT number", async () => {
    process.env.FMCSA_WEB_KEY = "test-web-key";
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        content: {
          carrier: {
            dotNumber: "123456",
            legalName: "ACME HAULING LLC",
            dbaName: "Acme",
            allowToOperate: "Y",
            outOfService: "N",
            safetyRating: "Satisfactory",
            bipdInsuranceOnFile: "750000",
            commonAuthorityStatus: "ACTIVE",
          },
        },
      }),
    });

    const result = await lookupCarrierByDot("123456");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.carrier.legalName).toBe("ACME HAULING LLC");
      expect(result.carrier.allowedToOperate).toBe(true);
      expect(result.carrier.outOfService).toBe(false);
    }
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/carriers/123456"),
      expect.any(Object),
    );
  });

  it("looks up a carrier by MC / docket number", async () => {
    process.env.FMCSA_WEB_KEY = "test-web-key";
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        content: [
          {
            carrier: {
              dotNumber: "999",
              mcNumber: "1515",
              legalName: "MC Carrier",
              allowToOperate: "Y",
              outOfService: "N",
            },
          },
        ],
      }),
    });

    const result = await lookupCarrierByMc("MC-1515");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.carrier.dotNumber).toBe("999");
      expect(result.carrier.mcNumber).toBe("1515");
    }
  });

  it("retries on 503 then succeeds", async () => {
    process.env.FMCSA_WEB_KEY = "test-web-key";
    fetchMock
      .mockResolvedValueOnce({ ok: false, status: 503, text: async () => "busy" })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ content: { carrier: { dotNumber: "1", legalName: "Ok", allowToOperate: "Y", outOfService: "N" } } }),
      });

    const result = await lookupCarrierByDot("1");
    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("fetches authority details", async () => {
    process.env.FMCSA_WEB_KEY = "test-web-key";
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        content: { commonAuthorityStatus: "ACTIVE", contractAuthorityStatus: "INACTIVE" },
      }),
    });
    const result = await lookupCarrierAuthority("44110");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.commonAuthority).toBe("ACTIVE");
      expect(result.contractAuthority).toBe("INACTIVE");
    }
  });

  it("derives verified compliance when carrier is active and insured", () => {
    const snapshot = deriveComplianceFromFmcsa(
      {
        dotNumber: "1",
        mcNumber: "2",
        legalName: "Acme",
        dbaName: null,
        allowedToOperate: true,
        outOfService: false,
        safetyRating: "Satisfactory",
        phyStreet: null,
        phyCity: null,
        phyState: null,
        phyZip: null,
        telephone: null,
        bipdInsuranceOnFile: "750000",
        bipdInsuranceRequired: "750000",
        cargoInsuranceOnFile: null,
        commonAuthorityStatus: "ACTIVE",
        contractAuthorityStatus: null,
        brokerAuthorityStatus: null,
        raw: {},
      },
      { commonAuthority: "ACTIVE", contractAuthority: null },
    );
    expect(snapshot.status).toBe("verified");
    expect(snapshot.fmcsaAuthority).toBe("verified");
    expect(snapshot.insuranceActive).toBe("verified");
    expect(snapshot.notSuspended).toBe("verified");
  });

  it("derives failed compliance when carrier is out of service", () => {
    const snapshot = deriveComplianceFromFmcsa({
      dotNumber: "1",
      mcNumber: null,
      legalName: "Bad",
      dbaName: null,
      allowedToOperate: false,
      outOfService: true,
      safetyRating: "Unsatisfactory",
      phyStreet: null,
      phyCity: null,
      phyState: null,
      phyZip: null,
      telephone: null,
      bipdInsuranceOnFile: "0",
      bipdInsuranceRequired: "750000",
      cargoInsuranceOnFile: null,
      commonAuthorityStatus: "INACTIVE",
      contractAuthorityStatus: null,
      brokerAuthorityStatus: null,
      raw: {},
    });
    expect(snapshot.status).toBe("failed");
    expect(snapshot.notSuspended).toBe("failed");
    expect(snapshot.dotOperatingStatus).toBe("failed");
  });
});
