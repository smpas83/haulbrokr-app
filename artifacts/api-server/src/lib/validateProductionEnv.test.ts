import { describe, it, expect } from "vitest";
import {
  collectProductionEnvIssues,
  isProductionRuntime,
  PRODUCTION_ENV_REQUIREMENTS,
  validateProductionEnv,
} from "./validateProductionEnv";

const VALID_PRODUCTION_ENV: Record<string, string> = {
  NODE_ENV: "production",
  PORT: "8080",
  DATABASE_URL: "postgresql://haulbrokr:secret@ep-damp-boat-aftkv449.us-east-2.aws.neon.tech/neondb?sslmode=require",
  CLERK_SECRET_KEY: "sk_live_clerk_secret",
  CLERK_PUBLISHABLE_KEY: "pk_live_clerk_publishable",
  STRIPE_SECRET_KEY: "sk_live_stripe_secret",
  STRIPE_PUBLISHABLE_KEY: "pk_live_stripe_publishable",
  STRIPE_WEBHOOK_SECRET: "whsec_stripe_webhook",
  PAYMENTS_MOCK_MODE: "false",
  GOOGLE_MAPS_SERVER_API_KEY: "google-maps-server-key",
  RESEND_API_KEY: "re_resend_api_key",
  RESEND_FROM_EMAIL: "noreply@haulbrokr.com",
  SMS_WEBHOOK_URL: "https://sms.haulbrokr.com/send",
  PUSH_WEBHOOK_URL: "https://push.haulbrokr.com/send",
  REALTIME_WEBHOOK_URL: "https://realtime.haulbrokr.com/fanout",
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
};

describe("validateProductionEnv", () => {
  it("documents required variables for each production integration", () => {
    const services = new Set(PRODUCTION_ENV_REQUIREMENTS.map((req) => req.service));
    expect(services.has("neon")).toBe(true);
    expect(services.has("clerk")).toBe(true);
    expect(services.has("stripe")).toBe(true);
    expect(services.has("google_maps")).toBe(true);
    expect(services.has("resend")).toBe(true);
    expect(services.has("sms")).toBe(true);
    expect(services.has("push")).toBe(true);
    expect(services.has("realtime")).toBe(true);
    expect(services.has("r2")).toBe(true);
    expect(services.has("render")).toBe(true);
    expect(services.has("vercel")).toBe(true);
  });

  it("skips validation outside production", () => {
    expect(collectProductionEnvIssues({ NODE_ENV: "development" })).toEqual([]);
    expect(() => validateProductionEnv({ NODE_ENV: "test" })).not.toThrow();
  });

  it("detects isProductionRuntime from NODE_ENV", () => {
    expect(isProductionRuntime()).toBe(process.env.NODE_ENV === "production");
  });

  it("passes when all required production variables are valid", () => {
    expect(collectProductionEnvIssues(VALID_PRODUCTION_ENV)).toEqual([]);
    expect(() => validateProductionEnv(VALID_PRODUCTION_ENV)).not.toThrow();
  });

  it("collects missing Neon, Clerk, Stripe, notification, R2, Render, and core secrets", () => {
    const issues = collectProductionEnvIssues({ NODE_ENV: "production", PORT: "8080" });
    const variables = issues.map((issue) => issue.variable);

    expect(variables).toContain("DATABASE_URL");
    expect(variables).toContain("CLERK_SECRET_KEY");
    expect(variables).toContain("STRIPE_SECRET_KEY");
    expect(variables).toContain("GOOGLE_MAPS_SERVER_API_KEY");
    expect(variables).toContain("RESEND_API_KEY");
    expect(variables).toContain("SMS_WEBHOOK_URL");
    expect(variables).toContain("PUSH_WEBHOOK_URL");
    expect(variables).toContain("REALTIME_WEBHOOK_URL");
    expect(variables).toContain("R2_BUCKET");
    expect(variables).toContain("UPLOAD_TOKEN_SECRET");
    expect(variables).toContain("ADMIN_USER_IDS");
  });

  it("rejects mock payments in production", () => {
    const issues = collectProductionEnvIssues({
      ...VALID_PRODUCTION_ENV,
      PAYMENTS_MOCK_MODE: "true",
    });
    expect(issues.some((issue) => issue.variable === "PAYMENTS_MOCK_MODE")).toBe(true);
  });

  it("rejects Neon URLs without sslmode=require", () => {
    const issues = collectProductionEnvIssues({
      ...VALID_PRODUCTION_ENV,
      DATABASE_URL: "postgresql://user:pass@ep-real-host.us-east-2.aws.neon.tech/neondb",
    });
    expect(issues.some((issue) => issue.service === "neon" && issue.variable === "DATABASE_URL")).toBe(true);
  });

  it("rejects placeholder DATABASE_URL values", () => {
    const issues = collectProductionEnvIssues({
      ...VALID_PRODUCTION_ENV,
      DATABASE_URL: "postgresql://user:pass@ep-xxxxx.neon.tech/neondb?sslmode=require",
    });
    expect(issues.some((issue) => issue.variable === "DATABASE_URL")).toBe(true);
  });

  it("rejects non-HTTPS notification webhooks", () => {
    const issues = collectProductionEnvIssues({
      ...VALID_PRODUCTION_ENV,
      SMS_WEBHOOK_URL: "http://sms.example.test/send",
    });
    expect(issues.some((issue) => issue.variable === "SMS_WEBHOOK_URL")).toBe(true);
  });

  it("throws a grouped error message on startup validation failure", () => {
    expect(() => validateProductionEnv({ NODE_ENV: "production", PORT: "8080" })).toThrow(
      /Production environment validation failed/,
    );
    expect(() => validateProductionEnv({ NODE_ENV: "production", PORT: "8080" })).toThrow(/\[NEON\]/);
    expect(() => validateProductionEnv({ NODE_ENV: "production", PORT: "8080" })).toThrow(/VITE_CLERK_PUBLISHABLE_KEY/);
  });
});
