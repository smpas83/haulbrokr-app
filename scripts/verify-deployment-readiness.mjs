#!/usr/bin/env node
import fs from "node:fs";

loadEnvFile(process.env.ENV_FILE ?? ".env");

const TARGET_ENV = process.env.TARGET_ENV ?? "staging";
const WEB_URL = (process.env.WEB_URL ?? "https://haulbrokr.com").replace(/\/$/, "");
const API_DIRECT = (process.env.API_DIRECT ?? "https://haulbrokr-api.onrender.com").replace(/\/$/, "");
const VERIFY_LIVE_THIRD_PARTY = truthy(process.env.VERIFY_LIVE_THIRD_PARTY);
const SKIP_ENDPOINT_CHECKS = truthy(process.env.SKIP_ENDPOINT_CHECKS);

const checks = [];
const failures = [];
const warnings = [];

function truthy(value) {
  return ["1", "true", "yes", "on"].includes(String(value ?? "").toLowerCase());
}

function loadEnvFile(path) {
  if (!fs.existsSync(path)) return;
  const raw = fs.readFileSync(path, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    const [, key, value] = match;
    if (process.env[key] !== undefined) continue;
    process.env[key] = value.replace(/^['"]|['"]$/g, "");
  }
}

function env(name) {
  return (process.env[name] ?? "").trim();
}

function pass(label) {
  checks.push({ label, status: "PASS" });
}

function warn(label, message) {
  warnings.push(`${label}: ${message}`);
  checks.push({ label, status: "WARN" });
}

function fail(label, message) {
  failures.push(`${label}: ${message}`);
  checks.push({ label, status: "FAIL" });
}

function requireEnv(name, description) {
  const value = env(name);
  if (!value) {
    fail(name, `${description} is missing.`);
    return "";
  }
  pass(name);
  return value;
}

function optionalEnv(name) {
  if (env(name)) pass(name);
  else warn(name, "optional and not set");
}

function expectPrefix(name, prefixes) {
  const value = env(name);
  if (!value) return;
  if (!prefixes.some((prefix) => value.startsWith(prefix))) {
    fail(name, `expected ${prefixes.join(" or ")} prefix.`);
  }
}

function expectMinLength(name, min) {
  const value = env(name);
  if (!value) return;
  if (value.length < min) fail(name, `must be at least ${min} characters.`);
}

function expectUrl(name, protocol = "https:") {
  const value = env(name);
  if (!value) return;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== protocol) fail(name, `must use ${protocol}.`);
  } catch {
    fail(name, "must be a valid URL.");
  }
}

function validateDatabaseUrl() {
  const value = requireEnv("DATABASE_URL", "Neon/Supabase Postgres URL");
  if (!value) return;
  if (!/^postgres(ql)?:\/\//.test(value)) {
    fail("DATABASE_URL", "must start with postgres:// or postgresql://.");
    return;
  }
  try {
    const parsed = new URL(value.replace(/^postgres:/, "postgresql:"));
    const ssl = parsed.searchParams.get("sslmode") ?? parsed.searchParams.get("ssl");
    if (ssl !== "require" && ssl !== "true") {
      fail("DATABASE_URL", "must include sslmode=require or ssl=true.");
    }
  } catch {
    fail("DATABASE_URL", "is not parseable.");
  }
}

function validateEnv() {
  validateDatabaseUrl();

  for (const name of [
    "CLERK_SECRET_KEY",
    "CLERK_PUBLISHABLE_KEY",
    "VITE_CLERK_PUBLISHABLE_KEY",
    "VITE_CLERK_PROXY_URL",
    "EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY",
    "STRIPE_SECRET_KEY",
    "STRIPE_PUBLISHABLE_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "RESEND_API_KEY",
    "RESEND_FROM_EMAIL",
    "R2_ACCOUNT_ID",
    "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY",
    "R2_BUCKET",
    "R2_PUBLIC_URL",
    "PRIVATE_OBJECT_DIR",
    "PUBLIC_OBJECT_SEARCH_PATHS",
    "UPLOAD_TOKEN_SECRET",
    "TICKET_QR_SECRET",
    "STAFF_AUTH_SECRET",
    "ADMIN_USER_IDS",
    "EXPO_PUBLIC_DOMAIN",
    "GOOGLE_MAPS_API_KEY",
    "VITE_GOOGLE_MAPS_API_KEY",
  ]) {
    requireEnv(name, "required deployment variable");
  }

  optionalEnv("CORS_ALLOWED_ORIGINS");
  optionalEnv("AUTOMATION_KEY");
  optionalEnv("STAFF_DEFAULT_PASSWORD");
  optionalEnv("LOG_LEVEL");

  expectPrefix("CLERK_SECRET_KEY", ["sk_test_", "sk_live_"]);
  expectPrefix("CLERK_PUBLISHABLE_KEY", ["pk_test_", "pk_live_"]);
  expectPrefix("VITE_CLERK_PUBLISHABLE_KEY", ["pk_test_", "pk_live_"]);
  expectPrefix("EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY", ["pk_test_", "pk_live_"]);
  expectPrefix("STRIPE_SECRET_KEY", ["sk_test_", "sk_live_"]);
  expectPrefix("STRIPE_PUBLISHABLE_KEY", ["pk_test_", "pk_live_"]);
  expectPrefix("STRIPE_WEBHOOK_SECRET", ["whsec_"]);
  expectPrefix("RESEND_API_KEY", ["re_"]);
  expectUrl("R2_PUBLIC_URL");
  expectMinLength("UPLOAD_TOKEN_SECRET", 32);
  expectMinLength("TICKET_QR_SECRET", 32);
  expectMinLength("STAFF_AUTH_SECRET", 32);
  if (env("AUTOMATION_KEY")) expectMinLength("AUTOMATION_KEY", 32);

  if (TARGET_ENV === "production") {
    if (truthy(env("PAYMENTS_MOCK_MODE"))) {
      fail("PAYMENTS_MOCK_MODE", "must be unset or false in production.");
    }
    expectPrefix("STRIPE_SECRET_KEY", ["sk_live_"]);
    expectPrefix("STRIPE_PUBLISHABLE_KEY", ["pk_live_"]);
  } else {
    expectPrefix("STRIPE_SECRET_KEY", ["sk_test_"]);
    expectPrefix("STRIPE_PUBLISHABLE_KEY", ["pk_test_"]);
  }
}

async function fetchCheck(label, url, init, validate) {
  try {
    const res = await fetch(url, init);
    const text = await res.text();
    if (validate(res, text)) pass(label);
    else fail(label, `unexpected HTTP ${res.status}: ${text.slice(0, 240).replace(/\s+/g, " ")}`);
  } catch (error) {
    fail(label, error instanceof Error ? error.message : String(error));
  }
}

async function validateEndpoints() {
  if (SKIP_ENDPOINT_CHECKS) {
    warn("endpoint checks", "skipped by SKIP_ENDPOINT_CHECKS");
    return;
  }
  await fetchCheck("web homepage", WEB_URL, {}, (res) => res.status === 200);
  await fetchCheck("web admin login", `${WEB_URL}/admin/login`, {}, (res) => res.status === 200);
  await fetchCheck("API direct health", `${API_DIRECT}/api/healthz`, {}, (res, text) => res.status === 200 && text.includes('"ok"'));
  await fetchCheck("API direct readiness", `${API_DIRECT}/api/readyz`, {}, (res, text) => res.status === 200 && text.includes('"ok"'));
  await fetchCheck("API proxied readiness", `${WEB_URL}/api/readyz`, {}, (res, text) => res.status === 200 && text.includes('"ok"'));
  await fetchCheck("admin anonymous gate", `${WEB_URL}/api/admin/access`, {}, (res, text) => res.status === 200 && text.includes('"isAdmin":false'));
  await fetchCheck("Stripe webhook unsigned rejection", `${WEB_URL}/api/webhooks/stripe`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
  }, (res) => res.status === 400);
}

async function validateThirdParty() {
  if (!VERIFY_LIVE_THIRD_PARTY) {
    warn("third-party live checks", "skipped; set VERIFY_LIVE_THIRD_PARTY=1 to call provider APIs");
    return;
  }

  await fetchCheck("Clerk API credentials", "https://api.clerk.com/v1/instance", {
    headers: { Authorization: `Bearer ${env("CLERK_SECRET_KEY")}` },
  }, (res) => res.status === 200);

  await fetchCheck("Stripe API credentials", "https://api.stripe.com/v1/account", {
    headers: { Authorization: `Bearer ${env("STRIPE_SECRET_KEY")}` },
  }, (res) => res.status === 200);

  await fetchCheck("Resend API credentials", "https://api.resend.com/domains", {
    headers: { Authorization: `Bearer ${env("RESEND_API_KEY")}` },
  }, (res) => res.status === 200);

  await fetchCheck("Google Maps key", `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(env("GOOGLE_MAPS_API_KEY"))}`, {}, (_res, text) => {
    return !text.includes("InvalidKeyMapError") && !text.includes("ApiNotActivatedMapError") && !text.includes("RefererNotAllowedMapError");
  });

  await fetchCheck("R2 public URL", env("R2_PUBLIC_URL"), { method: "HEAD" }, (res) => res.status < 500);
}

function printSummary() {
  console.log(`HaulBrokr deployment readiness (${TARGET_ENV})`);
  for (const check of checks) {
    const icon = check.status === "PASS" ? "OK" : check.status === "WARN" ? "WARN" : "FAIL";
    console.log(`${icon} ${check.label}`);
  }
  if (warnings.length) {
    console.log("\nWarnings:");
    for (const item of warnings) console.log(`- ${item}`);
  }
  if (failures.length) {
    console.error("\nFailures:");
    for (const item of failures) console.error(`- ${item}`);
    process.exit(1);
  }
  console.log("\nAll required deployment readiness checks passed.");
}

validateEnv();
await validateEndpoints();
await validateThirdParty();
printSummary();
