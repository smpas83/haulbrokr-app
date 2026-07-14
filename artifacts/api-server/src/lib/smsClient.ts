import { logger } from "./logger";

export type SmsSendResult =
  | { ok: true; sid: string }
  | { ok: false; reason: string };

function twilioCredentials(): {
  accountSid: string;
  authToken: string;
  fromNumber: string;
} | null {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  const fromNumber = process.env.TWILIO_FROM_NUMBER?.trim();
  if (!accountSid || !authToken || !fromNumber) return null;
  return { accountSid, authToken, fromNumber };
}

export function isSmsConfigured(): boolean {
  return twilioCredentials() != null;
}

/**
 * Send an SMS via Twilio REST API. No-ops with a clear reason when Twilio is
 * not configured — never invents delivery.
 */
export async function sendSms(
  to: string,
  body: string,
): Promise<SmsSendResult> {
  const creds = twilioCredentials();
  if (!creds) {
    logger.warn(
      "SMS skipped — TWILIO_ACCOUNT_SID/AUTH_TOKEN/FROM_NUMBER not configured",
    );
    return { ok: false, reason: "sms_not_configured" };
  }

  const normalizedTo = to.trim();
  if (!normalizedTo) return { ok: false, reason: "missing_phone" };

  const url = `https://api.twilio.com/2010-04-01/Accounts/${creds.accountSid}/Messages.json`;
  const params = new URLSearchParams({
    To: normalizedTo,
    From: creds.fromNumber,
    Body: body.slice(0, 1500),
  });

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization:
          "Basic " +
          Buffer.from(`${creds.accountSid}:${creds.authToken}`).toString(
            "base64",
          ),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    const data = (await res.json()) as {
      sid?: string;
      message?: string;
      error_message?: string;
    };
    if (!res.ok) {
      logger.warn(
        { status: res.status, data, to: normalizedTo },
        "Twilio SMS send failed",
      );
      return {
        ok: false,
        reason:
          data.message || data.error_message || `twilio_http_${res.status}`,
      };
    }
    if (!data.sid) return { ok: false, reason: "twilio_missing_sid" };
    return { ok: true, sid: data.sid };
  } catch (err) {
    logger.error({ err, to: normalizedTo }, "Twilio SMS request error");
    return { ok: false, reason: "twilio_network_error" };
  }
}
