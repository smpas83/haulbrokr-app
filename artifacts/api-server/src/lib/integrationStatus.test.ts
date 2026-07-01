import { describe, expect, it } from "vitest";
import { collectIntegrationStatus } from "./integrationStatus";

const COMPLETE_ENV: Record<string, string> = {
  STRIPE_SECRET_KEY: "sk_live_x",
  STRIPE_PUBLISHABLE_KEY: "pk_live_x",
  STRIPE_WEBHOOK_SECRET: "whsec_x",
  PAYMENTS_MOCK_MODE: "false",
  GOOGLE_MAPS_API_KEY: "AIza_test",
  CLERK_SECRET_KEY: "sk_live_x",
  CLERK_PUBLISHABLE_KEY: "pk_live_x",
  RESEND_API_KEY: "re_x",
  RESEND_FROM_EMAIL: "noreply@haulbrokr.com",
  R2_ACCOUNT_ID: "account",
  R2_ACCESS_KEY_ID: "access",
  R2_SECRET_ACCESS_KEY: "secret",
  R2_BUCKET: "bucket",
  R2_PUBLIC_URL: "https://cdn.haulbrokr.com",
  PRIVATE_OBJECT_DIR: "/private",
  PUBLIC_OBJECT_SEARCH_PATHS: "/public",
};

describe("collectIntegrationStatus", () => {
  it("reports configured integrations without exposing secret values", () => {
    const status = collectIntegrationStatus(COMPLETE_ENV);

    expect(status.integrations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "stripe", status: "configured" }),
        expect.objectContaining({ key: "googleMaps", status: "configured" }),
        expect.objectContaining({ key: "clerk", status: "configured" }),
        expect.objectContaining({ key: "email", status: "configured" }),
        expect.objectContaining({ key: "cloudStorage", status: "configured" }),
      ]),
    );
    expect(JSON.stringify(status)).not.toContain("sk_live_x");
    expect(JSON.stringify(status)).not.toContain("re_x");
  });

  it("surfaces disabled SMS and push integrations clearly", () => {
    const status = collectIntegrationStatus(COMPLETE_ENV);

    expect(status.integrations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "sms", status: "disabled", required: false }),
        expect.objectContaining({ key: "push", status: "disabled", required: false }),
      ]),
    );
  });

  it("marks Stripe missing when mock mode is enabled", () => {
    const status = collectIntegrationStatus({
      ...COMPLETE_ENV,
      PAYMENTS_MOCK_MODE: "true",
    });

    expect(status.integrations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "stripe", status: "missing" }),
      ]),
    );
  });
});
