#!/usr/bin/env node
/**
 * Production go-live helper for Stripe refunds.
 *
 * Usage:
 *   STRIPE_SECRET_KEY=sk_live_... node scripts/go-live-stripe-refunds.mjs
 *
 * Optional:
 *   WEBHOOK_URL=https://haulbrokr.com/api/webhooks/stripe
 *   STRIPE_WEBHOOK_ID=we_...
 */

const WEBHOOK_URL = (process.env.WEBHOOK_URL ?? "https://haulbrokr.com/api/webhooks/stripe").trim();
const SECRET = (process.env.STRIPE_SECRET_KEY ?? "").trim();
const WEBHOOK_ID = (process.env.STRIPE_WEBHOOK_ID ?? "").trim();

const REFUND_EVENTS = ["charge.refunded", "refund.created", "refund.updated"];

function fail(msg) {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
}

function ok(msg) {
  console.log(`OK: ${msg}`);
}

async function stripeRequest(path, method = "GET", body) {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${SECRET}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const json = await res.json();
  if (!res.ok) fail(`Stripe API ${path}: ${json.error?.message ?? res.status}`);
  return json;
}

function formBody(params) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      value.forEach((v, i) => search.append(`${key}[${i}]`, v));
    } else if (value != null) {
      search.append(key, String(value));
    }
  }
  return search;
}

async function main() {
  console.log("==> HaulBrokr Stripe refund go-live");
  console.log(`    Webhook URL: ${WEBHOOK_URL}`);
  console.log("");

  for (const path of ["/api/admin/jobs/1/refund", "/api/admin/jobs/1/payment-history"]) {
    const method = path.endsWith("refund") ? "POST" : "GET";
    const res = await fetch(`https://haulbrokr.com${path}`, {
      method,
      headers: method === "POST" ? { "Content-Type": "application/json" } : undefined,
      body: method === "POST" ? "{}" : undefined,
    });
    if (res.status === 404) fail(`${path} returned 404 — API deploy may be incomplete`);
    ok(`${path} reachable (HTTP ${res.status})`);
  }

  const ready = await fetch("https://haulbrokr-api.onrender.com/api/readyz");
  if (!ready.ok) fail(`/api/readyz returned HTTP ${ready.status}`);
  ok("/api/readyz healthy (includes refund schema after auto-migration deploy)");

  if (!SECRET) {
    console.log("");
    console.log("SKIP: STRIPE_SECRET_KEY not set — cannot auto-enable webhook events.");
    console.log("Manual: Stripe Dashboard → Webhooks → enable charge.refunded, refund.created, refund.updated");
    return;
  }

  let endpoint;
  if (WEBHOOK_ID) {
    endpoint = await stripeRequest(`/webhook_endpoints/${WEBHOOK_ID}`);
  } else {
    const list = await stripeRequest("/webhook_endpoints?limit=100");
    endpoint = (list.data ?? []).find((e) => e.url === WEBHOOK_URL);
    if (!endpoint) fail(`No webhook endpoint found for ${WEBHOOK_URL}`);
  }

  const merged = [...new Set([...(endpoint.enabled_events ?? []), ...REFUND_EVENTS])];
  const updated = await stripeRequest(
    `/webhook_endpoints/${endpoint.id}`,
    "POST",
    formBody({ enabled_events: merged }),
  );

  ok(`Webhook ${updated.id} enabled events: ${updated.enabled_events.join(", ")}`);
  console.log("");
  console.log("Next: issue one live refund via POST /api/admin/jobs/:id/refund and verify payment-history.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
