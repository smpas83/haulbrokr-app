import { describe, it, expect, beforeEach, vi } from "vitest";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

import { sendSms, isSmsConfigured } from "./smsClient";

beforeEach(() => {
  fetchMock.mockReset();
  delete process.env.TWILIO_ACCOUNT_SID;
  delete process.env.TWILIO_AUTH_TOKEN;
  delete process.env.TWILIO_FROM_NUMBER;
});

describe("smsClient", () => {
  it("reports not configured without Twilio env", () => {
    expect(isSmsConfigured()).toBe(false);
  });

  it("returns sms_not_configured without inventing delivery", async () => {
    const result = await sendSms("+15551212", "hello");
    expect(result).toEqual({ ok: false, reason: "sms_not_configured" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends via Twilio when configured", async () => {
    process.env.TWILIO_ACCOUNT_SID = "ACxxxx";
    process.env.TWILIO_AUTH_TOKEN = "token";
    process.env.TWILIO_FROM_NUMBER = "+15550001111";
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ sid: "SM999" }),
    });

    const result = await sendSms("+15551212", "Job update");
    expect(result).toEqual({ ok: true, sid: "SM999" });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("api.twilio.com"),
      expect.objectContaining({ method: "POST" }),
    );
  });
});
