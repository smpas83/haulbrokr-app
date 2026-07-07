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
import Stripe from "stripe";

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

async function main() {
  console.log("==> HaulBrokr Stripe refund go-live");
  console.log(`    Webhook URL: ${WEBHOOK_URL}`);
  console.log("");

  // API route smoke (no auth — expect 401/403, not 404)
  for (const path of ["/api/admin/jobs/1/refund", "/api/admin/jobs/1/payment-history"]) {
    const res = await fetch(`https://haulbrokr.com${path}`, { method: path.endsWith("refund") ? "POST" : "GET" });
    if (res.status === 404) fail(`${path} returned 404 — API deploy may be incomplete`);
    ok(`${path} reachable (HTTP ${res.status})`);
  }

  if (!SECRET) {
    console.log("");
    console.log("SKIP: STRIPE_SECRET_KEY not set — cannot auto-enable webhook events.");
    console.log("Manual: Stripe Dashboard → Webhooks → enable charge.refunded, refund.created, refund.updated");
    return;
  }

  const stripe = new Stripe(SECRET, { apiVersion: "2025-08-27.basil" });

  let endpoint;
  if (WEBHOOK_ID) {
    endpoint = await stripe.webhookEndpoints.retrieve(WEBHOOK_ID);
  } else {
    const list = await stripe.webhookEndpoints.list({ limit: 100 });
    endpoint = list.data.find((e) => e.url === WEBHOOK_URL);
    if (!endpoint) {
      fail(`No webhook endpoint found for ${WEBHOOK_URL}. Create one in Stripe Dashboard first.`);
    }
  }

  const merged = new Set([...(endpoint.enabled_events ?? []), ...REFUND_EVENTS]);
  const updated = await stripe.webhookEndpoints.update(endpoint.id, {
    enabled_events: [...merged],
  });

  ok(`Webhook ${updated.id} enabled events: ${updated.enabled_events.join(", ")}`);
  console.log("");
  console.log("Next: issue one live refund via POST /api/admin/jobs/:id/refund and verify payment-history.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
