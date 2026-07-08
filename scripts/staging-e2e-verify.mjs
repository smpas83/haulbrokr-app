#!/usr/bin/env node
/**
 * Staging / production E2E verification script.
 * Run: node scripts/staging-e2e-verify.mjs
 */
const WEB = (process.env.WEB_URL ?? "https://haulbrokr.com").replace(/\/$/, "");
const API = (
  process.env.API_DIRECT ?? "https://haulbrokr-api.onrender.com"
).replace(/\/$/, "");

const checklist = [];

function record(name, pass, detail = "") {
  checklist.push({ name, pass, detail });
  const icon = pass ? "PASS" : "FAIL";
  console.log(`${icon}  ${name}${detail ? ` — ${detail}` : ""}`);
}

async function fetchCheck(name, url, init, validate) {
  try {
    const res = await fetch(url, init);
    const text = await res.text();
    const pass = validate(res, text);
    record(
      name,
      pass,
      pass ? `HTTP ${res.status}` : `HTTP ${res.status}: ${text.slice(0, 120)}`,
    );
    return pass;
  } catch (e) {
    record(name, false, e instanceof Error ? e.message : String(e));
    return false;
  }
}

console.log(`\nHaulBrokr Staging E2E Verification\nWeb: ${WEB}\nAPI: ${API}\n`);

// Infrastructure
await fetchCheck("Web homepage", WEB, {}, (r) => r.status === 200);
await fetchCheck(
  "Web admin login",
  `${WEB}/admin/login`,
  {},
  (r) => r.status === 200,
);
await fetchCheck(
  "API healthz",
  `${API}/api/healthz`,
  {},
  (r, t) => r.status === 200 && t.includes("ok"),
);
await fetchCheck(
  "API readyz",
  `${API}/api/readyz`,
  {},
  (r, t) => r.status === 200 && t.includes("ok"),
);
await fetchCheck(
  "API proxied readyz",
  `${WEB}/api/readyz`,
  {},
  (r, t) => r.status === 200 && t.includes("ok"),
);

// Auth gates
await fetchCheck(
  "Profiles require auth",
  `${API}/api/profiles/me`,
  {},
  (r) => r.status === 401,
);
await fetchCheck(
  "Copilot requires auth",
  `${API}/api/copilot/insights`,
  {},
  (r) => r.status === 401,
);
await fetchCheck(
  "Dispatch requires auth",
  `${API}/api/dispatch/overview`,
  {},
  (r) => r.status === 401,
);
await fetchCheck(
  "Tracking requires auth",
  `${API}/api/jobs/1/tracking`,
  {},
  (r) => r.status === 401,
);
await fetchCheck(
  "Notifications require auth",
  `${API}/api/notifications`,
  {},
  (r) => r.status === 401,
);

// Public endpoints
await fetchCheck(
  "Dump sites public",
  `${API}/api/dump-sites`,
  {},
  (r) => r.status === 200,
);
await fetchCheck(
  "Admin access anonymous",
  `${API}/api/admin/access`,
  {},
  (r, t) => r.status === 200 && t.includes("isAdmin"),
);

// Stripe webhook security
await fetchCheck(
  "Stripe webhook rejects unsigned",
  `${WEB}/api/webhooks/stripe`,
  {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
  },
  (r) => r.status === 400,
);

// Rate limit headers
try {
  const r = await fetch(`${API}/api/dump-sites`);
  const hasLimit = r.headers.has("x-ratelimit-limit");
  record(
    "Rate limit headers present",
    hasLimit,
    hasLimit ? "X-RateLimit-* set" : "missing after deploy",
  );
} catch (e) {
  record("Rate limit headers present", false, String(e));
}

const passed = checklist.filter((c) => c.pass).length;
const failed = checklist.filter((c) => !c.pass).length;

console.log(
  `\n--- Results: ${passed}/${checklist.length} passed, ${failed} failed ---\n`,
);

if (failed > 0) {
  console.log("NOT CERTIFIED — fix failures and redeploy before launch.");
  process.exit(1);
}

console.log(
  "Infrastructure checks passed. Run authenticated flows in staging with real Clerk/Stripe credentials.",
);
console.log(
  "Launch NOT fully certified until POST_LAUNCH_CHECKLIST.md live runs complete.",
);
