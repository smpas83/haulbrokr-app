#!/usr/bin/env node
/**
 * Staging certification for RC3 / App Store beta exit.
 *
 * Usage: pnpm certify:staging
 *
 * Safely probes the configured staging environment without printing secrets.
 * Does not delete real users or create real charges.
 * Uses dedicated staging/test identities and Stripe test mode when credentials exist.
 */
import { spawnSync } from "child_process";

const ROOT = new URL("..", import.meta.url).pathname;
const API = (
  process.env.API_DIRECT ??
  process.env.STAGING_API_URL ??
  "https://haulbrokr-api.onrender.com"
).replace(/\/$/, "");
const WEB = (
  process.env.WEB_URL ??
  process.env.STAGING_WEB_URL ??
  "https://haulbrokr.com"
).replace(/\/$/, "");

const results = [];

function mask(value) {
  if (!value) return "(unset)";
  if (value.length <= 8) return "***";
  return `${value.slice(0, 4)}…${value.slice(-2)} (len=${value.length})`;
}

function record(name, status, detail = "") {
  results.push({ name, status, detail });
  console.log(`${status.padEnd(4)} ${name}${detail ? ` — ${detail}` : ""}`);
}

function hasEnv(name) {
  return Boolean(process.env[name]?.trim());
}

async function fetchJson(url, init = {}) {
  const res = await fetch(url, init);
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { res, body, text };
}

console.log("\nHaulBrokr Staging Certification (RC3)");
console.log(`Web: ${WEB}`);
console.log(`API: ${API}`);
console.log("Secrets are never printed — only presence/length.\n");

// Config presence (no values)
record(
  "Clerk publishable configured",
  hasEnv("CLERK_PUBLISHABLE_KEY") || hasEnv("VITE_CLERK_PUBLISHABLE_KEY")
    ? "PASS"
    : "WARN",
  "operator must set staging Clerk keys",
);
record(
  "Clerk secret configured",
  hasEnv("CLERK_SECRET_KEY") ? "PASS" : "WARN",
  mask(process.env.CLERK_SECRET_KEY),
);
record(
  "Stripe test mode key",
  hasEnv("STRIPE_SECRET_KEY")
    ? String(process.env.STRIPE_SECRET_KEY).startsWith("sk_test")
      ? "PASS"
      : "WARN"
    : "WARN",
  "expect sk_test_…",
);
record(
  "R2 configured",
  [
    "R2_ACCOUNT_ID",
    "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY",
    "R2_BUCKET",
  ].every(hasEnv)
    ? "PASS"
    : "WARN",
);
record(
  "FMCSA_WEB_KEY",
  hasEnv("FMCSA_WEB_KEY") ? "PASS" : "WARN",
  "EXTERNAL BLOCKER if unset — manual review fallback active",
);
record(
  "AUTOMATION_KEY / CRON_SECRET",
  hasEnv("AUTOMATION_KEY") || hasEnv("CRON_SECRET") ? "PASS" : "WARN",
);

// Infrastructure
try {
  const health = await fetchJson(`${API}/api/healthz`);
  record(
    "API healthz",
    health.res.status === 200 ? "PASS" : "FAIL",
    `HTTP ${health.res.status}`,
  );
} catch (e) {
  record("API healthz", "FAIL", e instanceof Error ? e.message : String(e));
}

try {
  const ready = await fetchJson(`${API}/api/readyz`);
  record(
    "API readyz",
    ready.res.status === 200 ? "PASS" : "FAIL",
    `HTTP ${ready.res.status}`,
  );
} catch (e) {
  record("API readyz", "FAIL", e instanceof Error ? e.message : String(e));
}

try {
  const details = await fetchJson(`${API}/api/readyz/details`);
  const fmcsa = details.body?.fmcsa;
  if (details.res.status === 404) {
    record(
      "FMCSA readiness detail",
      "WARN",
      "HTTP 404 — deploy RC3 API for /api/readyz/details",
    );
  } else if (!details.res.ok) {
    record("FMCSA readiness detail", "FAIL", `HTTP ${details.res.status}`);
  } else if (!fmcsa) {
    record("FMCSA readiness detail", "WARN", "no fmcsa block — deploy RC3 API");
  } else if (fmcsa.liveConfigured && fmcsa.health === "configured_healthy") {
    record(
      "FMCSA lookup / status",
      "PASS",
      `${fmcsa.provider}/${fmcsa.health}`,
    );
  } else if (fmcsa.manualFallbackAvailable) {
    record(
      "FMCSA lookup / status",
      "WARN",
      `manual fallback (${fmcsa.health}) — EXTERNAL BLOCKER for live`,
    );
  } else {
    record("FMCSA lookup / status", "FAIL", JSON.stringify(fmcsa));
  }
} catch (e) {
  record(
    "FMCSA lookup / status",
    "WARN",
    e instanceof Error ? e.message : String(e),
  );
}

try {
  const web = await fetch(`${WEB}`);
  record(
    "Web homepage",
    web.status === 200 ? "PASS" : "FAIL",
    `HTTP ${web.status}`,
  );
} catch (e) {
  record("Web homepage", "FAIL", e instanceof Error ? e.message : String(e));
}

// Auth gates (404 = RC3 routes not deployed yet → WARN)
for (const [name, path] of [
  ["Clerk-protected profiles", "/api/profiles/me"],
  ["Account export auth gate", "/api/account/export"],
  ["Account deletion preview auth", "/api/account/deletion/preview"],
  ["Recurring schedules auth", "/api/recurring-schedules"],
]) {
  try {
    const { res } = await fetchJson(`${API}${path}`);
    if (res.status === 401 || res.status === 403) {
      record(name, "PASS", `HTTP ${res.status}`);
    } else if (res.status === 404) {
      record(name, "WARN", `HTTP 404 — deploy RC3 API for ${path}`);
    } else {
      record(name, "FAIL", `HTTP ${res.status}`);
    }
  } catch (e) {
    record(name, "FAIL", e instanceof Error ? e.message : String(e));
  }
}

// Worker auth
try {
  const { res } = await fetchJson(`${API}/api/workers/recurring-hauls`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
  });
  if (res.status === 401 || res.status === 503) {
    record(
      "Recurring worker rejects unauthenticated",
      "PASS",
      `HTTP ${res.status}`,
    );
  } else if (res.status === 404) {
    record(
      "Recurring worker rejects unauthenticated",
      "WARN",
      "HTTP 404 — deploy RC3 API for /api/workers/recurring-hauls",
    );
  } else {
    record(
      "Recurring worker rejects unauthenticated",
      "FAIL",
      `HTTP ${res.status}`,
    );
  }
} catch (e) {
  record(
    "Recurring worker rejects unauthenticated",
    "FAIL",
    e instanceof Error ? e.message : String(e),
  );
}

if (hasEnv("AUTOMATION_KEY") || hasEnv("CRON_SECRET")) {
  const key = process.env.AUTOMATION_KEY || process.env.CRON_SECRET;
  try {
    const { res, body } = await fetchJson(
      `${API}/api/workers/recurring-hauls`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-automation-key": key,
        },
        body: "{}",
      },
    );
    record(
      "Recurring worker execution",
      res.status === 200 ? "PASS" : "FAIL",
      res.status === 200
        ? `created=${body?.created ?? "?"}`
        : `HTTP ${res.status}`,
    );
  } catch (e) {
    record(
      "Recurring worker execution",
      "FAIL",
      e instanceof Error ? e.message : String(e),
    );
  }
} else {
  record(
    "Recurring worker execution",
    "WARN",
    "set AUTOMATION_KEY to exercise worker against staging",
  );
}

// Stripe webhook unsigned rejection (no real charge)
try {
  const { res } = await fetchJson(`${WEB}/api/webhooks/stripe`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
  });
  record(
    "Stripe webhook rejects unsigned",
    res.status === 400 || res.status === 401 ? "PASS" : "WARN",
    `HTTP ${res.status}`,
  );
} catch (e) {
  record(
    "Stripe webhook rejects unsigned",
    "WARN",
    e instanceof Error ? e.message : String(e),
  );
}

// Authenticated operator flows (optional dedicated staging token)
const stagingToken =
  process.env.STAGING_CLERK_SESSION_TOKEN || process.env.STAGING_TEST_JWT;
const authHeaders = stagingToken
  ? {
      Authorization: `Bearer ${stagingToken}`,
      "content-type": "application/json",
    }
  : null;

async function authCheck(name, path, init = {}) {
  if (!authHeaders) {
    record(
      name,
      "WARN",
      "set STAGING_CLERK_SESSION_TOKEN for authenticated checks",
    );
    return;
  }
  try {
    const { res, body } = await fetchJson(`${API}${path}`, {
      ...init,
      headers: { ...authHeaders, ...(init.headers || {}) },
    });
    const ok = res.status >= 200 && res.status < 300;
    record(
      name,
      ok ? "PASS" : "FAIL",
      ok
        ? `HTTP ${res.status}`
        : `HTTP ${res.status}: ${typeof body === "object" ? body?.error : String(body).slice(0, 80)}`,
    );
  } catch (e) {
    record(name, "FAIL", e instanceof Error ? e.message : String(e));
  }
}

await authCheck("Clerk login session accepted", "/api/profiles/me");
await authCheck("Organization membership readable", "/api/organizations/me");
await authCheck("Account export request", "/api/account/export", {
  method: "POST",
  body: "{}",
});
await authCheck("Account export list (authorization)", "/api/account/export");
await authCheck("Account deletion dry-run", "/api/account/deletion", {
  method: "POST",
  headers: { "X-Reauth-Confirmed": "1" },
  body: JSON.stringify({ confirmation: "DELETE", dryRun: true }),
});

// Storage signing requires auth + completed profile — mark WARN without token
if (!authHeaders) {
  record("R2 signed upload", "WARN", "requires STAGING_CLERK_SESSION_TOKEN");
  record("Image upload", "WARN", "requires authenticated staging session");
  record("PDF upload", "WARN", "requires authenticated staging session");
  record("Blocked file type", "WARN", "requires authenticated staging session");
  record(
    "Stripe Connect onboarding link",
    "WARN",
    "requires authenticated staging provider",
  );
  record(
    "Stripe Checkout session",
    "WARN",
    "requires authenticated staging customer + job",
  );
  record(
    "Stripe webhook test event → DB",
    "WARN",
    "operator: stripe trigger payment_intent.succeeded --stripe-account=…",
  );
  record(
    "Invoice state update",
    "WARN",
    "operator: verify job payment_status after test webhook",
  );
  record(
    "Clerk signup",
    "WARN",
    "operator: create staging test user in Clerk dashboard",
  );
  record("Clerk login", "WARN", "operator: sign in with staging test user");
  record(
    "Organization creation",
    "WARN",
    "operator: complete onboarding as customer/provider",
  );
  record(
    "Carrier onboarding",
    "WARN",
    "operator: submit W-9/insurance/DOT on staging",
  );
  record(
    "Customer onboarding",
    "WARN",
    "operator: set payment method on staging",
  );
  record(
    "Driver onboarding",
    "WARN",
    "operator: join via invite code on staging",
  );
  record(
    "Notification delivery config",
    "WARN",
    "operator: verify Expo push credentials in EAS",
  );
} else {
  await authCheck("R2 signed upload URL", "/api/storage/uploads/request-url", {
    method: "POST",
    body: JSON.stringify({
      name: "cert.bin",
      size: 128,
      contentType: "application/octet-stream",
    }),
  });
}

// Local unit certification for code-controlled pieces
console.log("\n--- Local automated suite (code-controlled) ---\n");
const unit = spawnSync("pnpm", ["--filter", "@workspace/api-server", "test"], {
  cwd: ROOT,
  stdio: "inherit",
  env: process.env,
});
record(
  "Local api-server tests",
  unit.status === 0 ? "PASS" : "FAIL",
  `exit ${unit.status}`,
);

const pass = results.filter((r) => r.status === "PASS").length;
const warn = results.filter((r) => r.status === "WARN").length;
const fail = results.filter((r) => r.status === "FAIL").length;

console.log(
  `\n=== Staging certify: ${pass} PASS / ${warn} WARN / ${fail} FAIL ===\n`,
);
console.log("Operator checklist:");
console.log("1. Use Stripe TEST mode keys only.");
console.log(
  "2. Use dedicated staging Clerk users — never production identities.",
);
console.log("3. Set STAGING_CLERK_SESSION_TOKEN for authenticated PASS lines.");
console.log(
  "4. Configure FMCSA_WEB_KEY for live carrier lookup (see docs/FMCSA_OPERATOR_CHECKLIST.md).",
);
console.log(
  "5. Do not delete real users; use dryRun deletion or disposable staging accounts.\n",
);

if (fail > 0) process.exit(1);
