# HaulBrokr — Stripe Production Certification (RC2)

**Audit date:** 2026-07-05  
**Scope:** Stripe payments, Connect, webhooks, payouts, refunds, security  
**Engineering freeze respected:** No new features, UI redesign, or unrelated refactors  

---

## Final Decision

### ❌ STRIPE NOT READY

Core charge, Connect onboarding, and stuck-payout recovery paths are **production-viable after the P0 fixes in this branch**, but **refunds are not implemented** and several webhook/operator prerequisites remain. Do not certify Stripe for full production until refunds are built or explicitly waived by product.

---

## Executive Summary

| Area | Status | Notes |
|------|--------|-------|
| Production startup validation | ✅ Pass | Fails fast on missing/invalid Stripe env (after fix: rejects test keys) |
| Mock mode blocked in prod | ✅ Pass | `PAYMENTS_MOCK_MODE=true` rejected at boot |
| Customer → charge → transfer flow | ✅ Pass | Fixed double-charge on transfer failure |
| 3DS / `requires_action` flow | ✅ Pass | On-session confirm + webhook recovery |
| Stripe Connect Express onboarding | ✅ Pass | Account create, link, status sync |
| Stuck payout retry (scheduler + admin) | ✅ Pass | Transfer-only retry, admin alerts |
| Checkout destination charge | ✅ Pass | Application fee + transfer_data |
| **Refunds** | ❌ **Fail** | No API, webhook, DB, or UI support |
| `charge.refunded` webhook | ❌ Missing | Not implemented |
| `payout.paid` / `payout.failed` webhooks | ❌ Missing | Not implemented |
| Webhook event deduplication store | ⚠️ Partial | Handler idempotency only |
| Pricing field RBAC (API) | ⚠️ Partial | Job API returns full fee breakdown to all members |

---

## P0 Fixes Applied (This Branch)

### 1. Double-charge prevention on transfer failure

**Bug:** When `paymentIntents.create` succeeded but `transfers.create` failed on `/charge` or `/release`, the job was marked `failed` without persisting `stripePaymentIntentId`. A customer retry could create a **second charge**.

**Fix:** Transfer failures after a succeeded charge now park the job in `requires_action` with the PI id preserved (same pattern as `/confirm-payment`). Only true charge failures mark `failed`.

**Files:** `artifacts/api-server/src/routes/jobs.ts`

### 2. ACH / async PaymentIntent handling

**Bug:** `settleProviderPayout` attempted transfer immediately even when PI status was `processing` (ACH).

**Fix:** Non-`succeeded` PI statuses (except `requires_action`) park the job in `requires_action`; `payment_intent.succeeded` webhook completes the transfer.

### 3. Re-charge guard

**Bug:** `/charge` did not block jobs already in `requires_action`.

**Fix:** Returns 409 — customer must complete settlement via `/confirm-payment` or wait for webhook.

### 4. Live key enforcement at boot

**Bug:** `validateProductionEnv` accepted `sk_test_` / `pk_test_` in production.

**Fix:** Production now requires `sk_live_` and `pk_live_`.

**Files:** `artifacts/api-server/src/lib/validateProductionEnv.ts`

### 5. Staging return URL allowlist

**Fix:** Added `haulbrokr.vercel.app` to Connect/Checkout return URL allowlist.

**Files:** `artifacts/api-server/src/lib/returnUrl.ts`

---

## Environment Validation

### Variables

| Variable | Required (prod) | Where used | Production validation |
|----------|-----------------|------------|----------------------|
| `STRIPE_SECRET_KEY` | Yes | `stripeClient.ts` — SDK init | Required; must be `sk_live_*` (boot) |
| `STRIPE_PUBLISHABLE_KEY` | Yes | `stripeClient.ts` → API responses for Elements/3DS | Required; must be `pk_live_*` (boot) |
| `STRIPE_WEBHOOK_SECRET` | Yes | `stripe-webhooks.ts` — signature verification | Required; must start with `whsec_` |
| `STRIPE_CONNECT_CLIENT_ID` | **No** | Not referenced | N/A — Express accounts created via API, not OAuth |
| `PAYMENTS_MOCK_MODE` | Must be false/unset | `stripeClient.ts` — mock fallback | Rejected if `true`/`1`/`yes` in production |

### Startup behavior

```typescript
// artifacts/api-server/src/index.ts
validateProductionEnv(); // throws before app.listen()
```

- **Production + missing Stripe secrets:** Server **refuses to boot** with grouped error message.
- **Production + mock mode:** Server **refuses to boot**.
- **Non-production:** Validation skipped; mock mode allowed when keys absent.

### Safe failure behavior

| Scenario | Behavior |
|----------|----------|
| Missing webhook secret | `503` on webhook endpoint |
| Invalid webhook signature | `400`, event rejected |
| Webhook handler error | `500`, Stripe retries |
| Connector lookup error (Replit prod) | Fatal — no silent mock |
| Missing env keys on Render | Boot failure (validation) |

### Deployment script (additional gate)

`scripts/verify-deployment-readiness.mjs` validates live key prefixes and optionally probes Stripe API when `VERIFY_LIVE_THIRD_PARTY=true`.

---

## Payment Flow Validation

```
Customer
  ↓ POST /account/payment-method/setup-intent (card) or bank-setup-intent (ACH)
  ↓ POST/PATCH /account/payment-method (attach + persist pm_*)
  ↓ POST /jobs/:id/charge (instant) OR invoiced (net terms) OR /checkout-session
  ↓ PaymentIntent created + confirmed off-session
  ↓ Transfer to Connect account (or destination charge via Checkout)
  ↓ Webhook payment_intent.succeeded (async recovery / ACH / 3DS)
  ↓ DB: paymentStatus=released, stripePaymentIntentId, stripeTransferId
  ↓ Invoice PDF: GET /jobs/:id/invoice
  ↓ Broker settlement: 15% retained on platform (application_fee or charge−transfer)
  ↓ Driver earnings: GET /wallet (providerNetAmount aggregate)
  ↓ Driver payout: Stripe Connect → bank (Stripe-managed; not tracked in-app)
  ↓ Payment history: activity feed + wallet transactions (derived from jobs)
```

| Step | Endpoint / handler | Verified |
|------|-------------------|----------|
| Create Customer | `ensureStripeCustomerId()` in `account.ts` | ✅ Lazy on first SetupIntent |
| Create Payment Intent | `settleProviderPayout()` / Checkout session | ✅ Idempotency keys |
| Confirm Payment | `/confirm-payment`, 3DS via Elements | ✅ Transfer-only after PI succeeded |
| Webhook | `POST /api/webhooks/stripe` | ✅ Signature required |
| Persist DB | `jobs` table columns | ✅ |
| Invoice | `GET /jobs/:id/invoice` | ✅ PDF, no Stripe call |
| Broker settlement | 15% fee in charge or application_fee | ✅ |
| Driver earnings | `GET /wallet` | ✅ providerNetAmount only |
| Driver payout | Connect transfer + Stripe bank payout | ✅ Transfer tracked; bank payout not |
| Payment history | Activity + wallet | ✅ No dedicated ledger table |

### Payment paths

1. **Off-session charge + transfer** — `POST /jobs/:id/charge`, `POST /jobs/:id/release`
2. **3DS recovery** — `requires_action` → `/payment-confirmation` → `/confirm-payment`
3. **Checkout destination charge** — `POST /jobs/:id/checkout-session` → verify or webhook
4. **Net terms** — invoice without charge; release when due

---

## Stripe Connect Validation

| Feature | Implementation | Status |
|---------|---------------|--------|
| Account onboarding | `POST /payouts/connect-link` | ✅ |
| Express account create | `stripe.accounts.create` + idempotency | ✅ |
| Capabilities | `transfers`, `card_payments` requested | ✅ |
| Verification / requirements | `GET /payouts/status`, `buildPayoutRequirements()` | ✅ |
| Charges enabled | `syncStripeStatus()` | ✅ |
| Payouts enabled | `checkProviderPayoutReadiness()` gate before charge | ✅ |
| Account refresh | `account.updated` webhook + manual status poll | ✅ |
| Reconnect flow | `refresh_url` → `/api/payouts/return?status=refresh` | ✅ |

**Note:** Legacy `POST /account/payout` stores manual bank details in DB but is not the Connect payout path.

---

## Driver Payout Validation

| Scenario | Mechanism | Status |
|----------|-----------|--------|
| Payout created | `transfers.create` with `source_transaction` | ✅ |
| Status updates | Job `paymentStatus`; Connect flags in `payout_accounts` | ✅ |
| Completed payout | Job → `released`; wallet shows earning | ✅ |
| Failed payout (transfer) | Job stays `requires_action`; no re-charge | ✅ Fixed |
| Retry | 5-min scheduler + `POST /admin/stuck-payouts/:id/retry` | ✅ |
| Admin alert | After 3 consecutive failures (in-app + email) | ✅ |
| History | Wallet transactions + admin stuck-payout dashboard | ✅ |
| Stripe bank payout tracking | `payout.paid` / `payout.failed` webhooks | ❌ Not implemented |

---

## Refund Validation

| Requirement | Status |
|-------------|--------|
| `POST /refund` route | ❌ Not implemented |
| `stripe.refunds.create` | ❌ Not implemented |
| `charge.refunded` webhook | ❌ Not implemented |
| Database refund columns / status | ❌ No `refunded` in `job_payment_status` enum |
| UI refund flow | ❌ Not implemented |
| Payment history update on refund | ❌ Not implemented |

**Blocker:** Refunds must be processed manually in the Stripe Dashboard until an API is built. This blocks full production certification.

---

## Webhook Validation

**Endpoint:** `POST /api/webhooks/stripe` (raw body via `express.raw()` in `app.ts`)

| Event | Handler | Status |
|-------|---------|--------|
| `payment_intent.succeeded` | `handlePaymentIntentSucceeded` | ✅ |
| `payment_intent.payment_failed` | `handlePaymentIntentPaymentFailed` | ✅ |
| `checkout.session.completed` | `handleCheckoutSessionCompleted` | ✅ |
| `account.updated` | `handleAccountUpdated` | ✅ |
| `charge.refunded` | — | ❌ Not handled |
| `payout.paid` | — | ❌ Not handled |
| `payout.failed` | — | ❌ Not handled |
| Unhandled events | Returns `{ handled: false, reason: "ignored_event_type" }` with 200 | ✅ |

### Security controls

| Control | Status |
|---------|--------|
| Signature validation | ✅ `Stripe.webhooks.constructEvent` |
| Missing signature | ✅ 400 |
| Missing secret | ✅ 503 |
| Replay protection | ⚠️ Stripe timestamp tolerance only; no `event.id` persistence |
| Idempotency | ⚠️ Job status short-circuit; no processed-events table |
| Handler failure → retry | ✅ Returns 500 |

---

## Security Validation

| Control | Status | Notes |
|---------|--------|-------|
| Secret keys server-side only | ✅ | Never sent to client |
| Publishable key via authenticated API | ✅ | SetupIntent / payment-confirmation |
| Webhook signatures required | ✅ | |
| Payment actions RBAC | ✅ | Customer must own job (`customerId === profile.id`) |
| Payout actions RBAC | ✅ | Own Connect account only |
| Admin stuck payouts RBAC | ✅ | `requireStaffOrProfile` + `payouts` permission |
| PaymentMethod ownership check | ✅ | Rejects PM attached to another customer |
| Drivers cannot see customer pricing (UI actions) | ✅ | Pay buttons gated to `isCustomer` |
| Drivers cannot see customer pricing (API) | ⚠️ | Job API returns `customerTotalAmount`, `platformFeeAmount` to all job members |
| Customers cannot see broker margin (wallet) | ✅ | Wallet is provider-only; shows net |
| Fleet isolation (payments) | ⚠️ | Charge requires job owner, not org-scoped customer members |
| Organization isolation (webhooks) | ✅ | Metadata `jobId` lookup; Stripe-signed |

---

## Performance Metrics

Measurements below are from **local unit-test environment** (mock Stripe, no network). Production latencies depend on Stripe API region and payment rail.

| Operation | Mock/local estimate | Production expectation |
|-----------|--------------------|-----------------------|
| Payment creation (`/charge` handler) | ~5–20 ms (excl. Stripe RTT) | 300–1500 ms (card); 1–5 s (ACH init) |
| Webhook handler (in-process) | Sub-ms per event | + Stripe delivery latency (~1–30 s) |
| Refund | N/A — not implemented | — |
| Payout transfer (`transfers.create`) | ~5–15 ms (mock) | 200–800 ms |
| Stuck-payout sweep | ~5 ms/job (mock) | Scales linearly; 5-min interval |

**Recommendation:** Monitor Stripe Dashboard → Developers → Webhooks for delivery latency and error rates after go-live.

---

## Test Results

| Command | Result |
|---------|--------|
| `pnpm run typecheck` | ✅ Pass |
| `pnpm run build` | ✅ Pass |
| `pnpm test` (api-server) | ✅ **330/330** tests pass |

### Stripe-related test files

- `jobs.test.ts` — charge, release, 3DS, confirm, checkout, transfer failure
- `stripe-webhooks.test.ts` — signature, all 4 handled events
- `account.test.ts` — SetupIntent, PM attach, ACH microdeposits
- `ach-capture.test.ts` — ACH end-to-end
- `payoutRetry.test.ts` — stuck payout retry, admin alerts
- `payoutStatus.test.ts` — readiness guard
- `validateProductionEnv.test.ts` — Stripe env + live key rejection
- `wallet.test.ts`, `admin.test.ts`, `job-invoice.test.ts`

---

## Operator Actions Required

Complete these **before** switching Render to live Stripe keys:

### 1. Stripe Dashboard — Live mode

1. Enable **Stripe Connect** with **Express** accounts.
2. Copy live keys to Render:
   - `STRIPE_SECRET_KEY=sk_live_…`
   - `STRIPE_PUBLISHABLE_KEY=pk_live_…`
3. Confirm `PAYMENTS_MOCK_MODE` is **unset** on Render.

### 2. Webhook endpoint

Create webhook: `https://haulbrokr-api.onrender.com/api/webhooks/stripe`

**Subscribe (minimum — implemented):**
- `payment_intent.succeeded`
- `payment_intent.payment_failed`
- `checkout.session.completed`
- `account.updated`

**Subscribe (recommended — not yet handled in code):**
- `charge.refunded` (for future refund support)
- `payout.paid`
- `payout.failed`

Copy `STRIPE_WEBHOOK_SECRET=whsec_…` to Render.

### 3. Connect settings

- Set platform business profile and branding.
- Configure Express dashboard settings.
- Verify payout schedule for connected accounts.

### 4. Pre-deploy verification

```bash
TARGET_ENV=production VERIFY_LIVE_THIRD_PARTY=true node scripts/verify-deployment-readiness.mjs
```

### 5. Staging smoke test (live test keys)

1. Provider completes Connect onboarding.
2. Customer adds card via SetupIntent.
3. Complete job → charge → verify `released` + transfer in Stripe Dashboard.
4. Test 3DS card (if available) → `requires_action` → confirm.
5. Test Checkout session path.
6. Trigger `account.updated` (complete onboarding) → verify `/payouts/status`.

### 6. Refunds (manual until API exists)

Process refunds in **Stripe Dashboard → Payments → Refund**. Manually update job status in admin/DB if needed. **Do not rely on in-app refund flow.**

---

## Remaining Blockers

| Priority | Blocker | Owner |
|----------|---------|-------|
| **P0** | Refund API + `charge.refunded` webhook + DB status | Engineering (post-freeze) |
| **P1** | `payout.paid` / `payout.failed` webhook handlers | Engineering |
| **P1** | Webhook `event.id` deduplication table | Engineering |
| **P2** | API field redaction — hide `customerTotalAmount` / `platformFeeAmount` from drivers | Engineering |
| **P2** | Org-scoped customer payment actions | Engineering |
| **P2** | Dedicated payment ledger table for reconciliation | Engineering |

---

## Files Reference

| Path | Purpose |
|------|---------|
| `artifacts/api-server/src/lib/stripeClient.ts` | SDK init, mock mode |
| `artifacts/api-server/src/lib/validateProductionEnv.ts` | Boot validation |
| `artifacts/api-server/src/routes/stripe-webhooks.ts` | Webhook receiver |
| `artifacts/api-server/src/lib/stripeWebhooks.ts` | Event handlers |
| `artifacts/api-server/src/routes/jobs.ts` | Charge, release, confirm, checkout |
| `artifacts/api-server/src/routes/payouts.ts` | Connect onboarding |
| `artifacts/api-server/src/lib/payoutRetry.ts` | Stuck payout recovery |
| `artifacts/api-server/src/lib/payoutStatus.ts` | Connect readiness |
| `artifacts/api-server/src/routes/account.ts` | Customer + SetupIntent |
| `artifacts/api-server/src/routes/wallet.ts` | Provider earnings |
| `lib/db/src/schema/jobs.ts` | Payment status enum + Stripe ids |

---

*Certification performed under engineering freeze. Scope limited to Stripe production readiness.*
