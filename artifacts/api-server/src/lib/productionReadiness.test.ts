import { describe, expect, it } from "vitest";
import { collectProductionReadiness } from "./productionReadiness";

const COMPLETE_ENV: Record<string, string> = {
  NODE_ENV: "production",
  TARGET_ENV: "production",
  PORT: "8080",
  DATABASE_URL: "postgresql://haulbrokr:secret@ep-damp-boat-aftkv449.us-east-2.aws.neon.tech/neondb?sslmode=require",
  CLERK_SECRET_KEY: "sk_live_clerk_secret",
  CLERK_PUBLISHABLE_KEY: "pk_live_clerk_publishable",
  VITE_CLERK_PUBLISHABLE_KEY: "pk_live_clerk_publishable",
  VITE_CLERK_PROXY_URL: "https://haulbrokr.com/api/__clerk",
  EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_live_clerk_publishable",
  STRIPE_SECRET_KEY: "sk_live_stripe_secret",
  STRIPE_PUBLISHABLE_KEY: "pk_live_stripe_publishable",
  STRIPE_WEBHOOK_SECRET: "whsec_stripe_webhook",
  PAYMENTS_MOCK_MODE: "false",
  RESEND_API_KEY: "re_resend_api_key",
  RESEND_FROM_EMAIL: "noreply@haulbrokr.com",
  R2_ACCOUNT_ID: "cloudflare-account-id",
  R2_ACCESS_KEY_ID: "r2-access-key",
  R2_SECRET_ACCESS_KEY: "r2-secret-access-key",
  R2_BUCKET: "haulbrokr-uploads",
  R2_PUBLIC_URL: "https://cdn.haulbrokr.com",
  PRIVATE_OBJECT_DIR: "/haulbrokr/private",
  PUBLIC_OBJECT_SEARCH_PATHS: "/haulbrokr/public",
  UPLOAD_TOKEN_SECRET: "upload-token-secret-32-characters-min",
  TICKET_QR_SECRET: "ticket-qr-secret-32-characters-minimum",
  STAFF_AUTH_SECRET: "staff-auth-secret-32-characters-min",
  ADMIN_USER_IDS: "user_admin_clerk_id",
  EXPO_PUBLIC_DOMAIN: "https://haulbrokr.com",
  GOOGLE_MAPS_API_KEY: "google-maps-key",
};

describe("collectProductionReadiness", () => {
  it("returns go when all launch-critical configuration is present", () => {
    const report = collectProductionReadiness(COMPLETE_ENV);

    expect(report.goNoGo).toBe("go");
    expect(report.summary.launchCriticalFailures).toBe(0);
    expect(report.checks.find((check) => check.name === "GOOGLE_MAPS_API_KEY")?.status).toBe("pass");
  });

  it("returns no-go when launch-critical configuration is missing", () => {
    const { STRIPE_WEBHOOK_SECRET: _webhook, GOOGLE_MAPS_API_KEY: _maps, ...env } = COMPLETE_ENV;
    const report = collectProductionReadiness(env);

    expect(report.goNoGo).toBe("no-go");
    expect(report.summary.launchCriticalFailures).toBeGreaterThanOrEqual(2);
    expect(report.checks.find((check) => check.name === "STRIPE_WEBHOOK_SECRET")?.status).toBe("fail");
    expect(report.checks.find((check) => check.name === "GOOGLE_MAPS_API_KEY")?.status).toBe("fail");
  });

  it("classifies mock payments as production-blocking", () => {
    const report = collectProductionReadiness({ ...COMPLETE_ENV, PAYMENTS_MOCK_MODE: "true" });

    expect(report.goNoGo).toBe("no-go");
    expect(report.checks.find((check) => check.name === "PAYMENTS_MOCK_MODE")?.status).toBe("fail");
  });
});
