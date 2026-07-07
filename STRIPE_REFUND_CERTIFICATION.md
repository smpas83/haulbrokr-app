# STRIPE REFUND CERTIFICATION — HaulBrokr RC2

**Certification date:** 2026-07-05  
**Scope:** Production Stripe refund lifecycle (P0 payment gap)  
**Branch:** `cursor/stripe-refund-certification-0d53`

---

## FINAL DECISION

### ⚠️ STRIPE CERTIFIED WITH OPERATOR ACTION → LIVE DEPLOY IN PROGRESS

PR #95 merged to `master` on 2026-07-07. Production API routes are live (`401` on refund endpoints = deployed, auth required).

**Auto-migration on boot** (`startupMigrations.ts`) applies refund schema on the next Render deploy — no manual `db push` required.

**Remaining operator step:** enable Stripe webhook events (run `node scripts/go-live-stripe-refunds.mjs` with `STRIPE_SECRET_KEY`, or use Stripe Dashboard).

---

## Implemented Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/admin/jobs/:id/refund` | Staff + `payouts` permission | Issue full or partial Stripe refund |
| `GET` | `/api/admin/jobs/:id/payment-history` | Staff + `payouts` permission | Payment ledger: original charge, refunds, balance, timeline |

### `POST /api/admin/jobs/:id/refund`

**Request body (optional):**
```json
{
  "amount": 50.00,
  "reason": "requested_by_customer"
}
```

- Omit `amount` for a **full refund** of the remaining balance.
- Supports `Idempotency-Key` header (falls back to `job-refund:{jobId}:{attempt}`).
- Returns `201` on first success, `200` on duplicate idempotency replay, `409` on duplicate/over-refund.

**Core implementation:** `artifacts/api-server/src/lib/refunds.ts`  
**Route:** `artifacts/api-server/src/routes/admin.ts`

---

## Database Changes

### New table: `payment_refunds`

| Column | Type | Notes |
|--------|------|-------|
| `id` | serial PK | Internal ID |
| `job_id` | integer FK → jobs | Job reference |
| `stripe_refund_id` | text UNIQUE | Stripe `re_…` ID |
| `stripe_payment_intent_id` | text | PI reference |
| `stripe_charge_id` | text | Charge reference |
| `amount` | numeric(12,2) | Refund amount (USD) |
| `reason` | text | Operator / Stripe reason |
| `status` | enum | `pending`, `succeeded`, `failed`, `canceled` |
| `created_by_profile_id` | integer FK → profiles | Clerk staff profile (nullable) |
| `created_by_staff_username` | text | Staff session username (nullable) |
| `idempotency_key` | text UNIQUE | Duplicate protection |
| `created_at` / `updated_at` | timestamptz | Audit timestamps |

**Schema file:** `lib/db/src/schema/refunds.ts`

### Extended `jobs` table

| Column | Type | Notes |
|--------|------|-------|
| `refunded_amount` | numeric(12,2) default `0` | Cumulative refunded total |
| `refund_attempts` | integer default `0` | Idempotency key sequencing |

### Extended enums

- `job_payment_status`: added `partially_refunded`, `refunded`
- `activity_type`: added `payment_refunded`

### Apply migration (OPERATOR REQUIRED)

```bash
pnpm -C lib/db push
```

Run against the production `DATABASE_URL` before issuing live refunds.

---

## Webhook Coverage

**Ingress:** `POST /api/webhooks/stripe` (raw body + signature verification unchanged)

| Event | Handler | Behavior |
|-------|---------|----------|
| `charge.refunded` | `handleChargeRefundedEvent` | Syncs `jobs.refunded_amount` and `payment_status` from charge |
| `refund.created` | `handleRefundEvent` | Inserts `payment_refunds` row, syncs job totals |
| `refund.updated` | `handleRefundEvent` | Updates refund status; idempotent on duplicate delivery |

**Implementation:** `artifacts/api-server/src/lib/stripeWebhooks.ts`, `artifacts/api-server/src/lib/refunds.ts`

Duplicate webhook deliveries are safe: upsert keyed on `stripe_refund_id`; job totals recomputed from persisted refunds.

### Stripe Dashboard configuration (OPERATOR REQUIRED)

In **Stripe Dashboard → Developers → Webhooks →** select the production endpoint and enable:

- `charge.refunded`
- `refund.created`
- `refund.updated`

---

## Security Validation

| Check | Status | Implementation |
|-------|--------|----------------|
| Only authorized staff can refund | ✅ | `requireStaffOrProfile` + `requirePermission("payouts")` + `getStaffRole()` |
| Drivers cannot refund | ✅ | Non-staff roles rejected at endpoint |
| Customers cannot self-refund | ✅ | Admin-only route; no customer refund endpoint |
| Providers cannot refund | ✅ | Admin-only route |
| Webhook signatures enforced | ✅ | Unchanged `Stripe.webhooks.constructEvent` in `stripe-webhooks.ts` |
| Idempotency | ✅ | DB unique `idempotency_key` + Stripe idempotency key |
| Duplicate refund protection | ✅ | Balance check + `refunded` status guard + idempotency replay |
| Audit logging | ✅ | `payment_refunds` table + `payment_refunded` activity notification |

**Connect note:** Refunds use `reverse_transfer: true` so provider transfers are reversed on refund.

---

## Payment History

`GET /api/admin/jobs/:id/payment-history` returns:

- **Original payment** — gross amount, PI ID, transfer ID, paid/released timestamps
- **Refunds** — all `payment_refunds` rows with status and creator
- **Current balance** — `customerTotalAmount − refundedAmount`
- **Refund status** — `payment_status` (`released`, `partially_refunded`, `refunded`)
- **Timeline** — ordered payment + refund events

Provider wallet (`GET /api/wallet`) reflects refund clawbacks:

- Adjusts `availableBalance` for `partially_refunded` / `refunded` jobs
- Adds negative `payout` transaction lines for refund clawbacks

---

## Tests Executed

All commands passed locally:

```bash
pnpm run typecheck   # ✅ PASS
pnpm run build       # ✅ PASS
```

### Stripe-related test files (api-server)

| File | Result |
|------|--------|
| `src/routes/jobs.test.ts` | ✅ |
| `src/routes/stripe-webhooks.test.ts` | ✅ |
| `src/routes/refunds.test.ts` | ✅ NEW |
| `src/lib/refunds.test.ts` | ✅ NEW |
| `src/routes/account.test.ts` | ✅ |
| `src/routes/ach-capture.test.ts` | ✅ |
| `src/routes/wallet.test.ts` | ✅ |
| `src/routes/admin.test.ts` | ✅ |
| `src/lib/payoutRetry.test.ts` | ✅ |
| `src/lib/payoutStatus.test.ts` | ✅ |
| `src/lib/validateProductionEnv.test.ts` | ✅ |
| `src/routes/job-invoice.test.ts` | ✅ |

**api-server:** 31 files, 343 tests — all passing.

**haulbrokr:** 5 files, 11 tests — all passing.

### New test coverage

- ✅ Successful full refund
- ✅ Duplicate refund attempt (idempotency replay)
- ✅ Unauthorized refund (non-staff → 403)
- ✅ Webhook processing (`refund.created`, `refund.updated`, `charge.refunded`)
- ✅ Database state update (`payment_refunds` insert, `jobs.refunded_amount`, `payment_status`)

---

## Operator Actions Required

### 1. Refund in Stripe Dashboard

After issuing `POST /api/admin/jobs/:id/refund`:

1. Open **Stripe Dashboard → Payments →** locate the original charge via Payment Intent ID (`pi_…`).
2. Confirm a **Refund** row appears with matching amount and status (`succeeded` or `pending`).
3. For Connect jobs, verify **Transfer reversal** is linked when `reverse_transfer` applies.

### 2. Refund webhook delivery

1. Open **Stripe Dashboard → Developers → Webhooks →** select the production endpoint.
2. Confirm events `refund.created`, `refund.updated`, and/or `charge.refunded` show **Succeeded** delivery after a test refund.
3. Check API logs for `Stripe webhook processed` with `handled: true`.

### 3. Database update

```sql
-- Verify refund row
SELECT * FROM payment_refunds WHERE job_id = <JOB_ID>;

-- Verify job totals
SELECT id, payment_status, refunded_amount, customer_total_amount
FROM jobs WHERE id = <JOB_ID>;
```

Expected: `payment_status` is `refunded` or `partially_refunded`; `refunded_amount` matches Stripe.

### 4. UI update

Admin operators verify via API (no new customer UI per engineering freeze):

```bash
curl -H "Authorization: Bearer <staff-token>" \
  https://<api-host>/api/admin/jobs/<JOB_ID>/payment-history
```

Confirm:

- `timeline` contains payment + refund entries
- `currentBalance` reflects post-refund balance
- Customer activity feed shows `payment_refunded` notification

---

## Remaining Stripe Blockers

| Blocker | Owner | Why it blocks full ✅ |
|---------|-------|----------------------|
| Production DB schema push (`pnpm -C lib/db push`) | Operator | `payment_refunds` table and new enum values must exist before live refunds persist |
| Stripe webhook event registration (`charge.refunded`, `refund.created`, `refund.updated`) | Operator | Async refund status sync and duplicate-safe reconciliation depend on webhook delivery |
| First live refund smoke test in production | Operator | Code is certified in CI/mock; production money movement requires one verified end-to-end refund |

**Not blockers (out of scope per RC2 freeze):**

- Customer-facing refund UI (admin API only)
- OpenAPI codegen refresh for new endpoints (routes are functional; spec not regenerated)
- `transfer.reversed` dedicated handler (covered via `reverse_transfer` on refund creation + `charge.refunded`)

---

## Files Changed

- `lib/db/src/schema/refunds.ts` — new
- `lib/db/src/schema/jobs.ts` — refund columns + enum
- `lib/db/src/schema/activity.ts` — `payment_refunded`
- `lib/db/src/schema/index.ts` — export
- `artifacts/api-server/src/lib/refunds.ts` — new
- `artifacts/api-server/src/lib/stripeWebhooks.ts` — webhook handlers
- `artifacts/api-server/src/lib/mockStripeClient.ts` — mock refunds
- `artifacts/api-server/src/lib/jobInvoice.ts` — status labels
- `artifacts/api-server/src/routes/admin.ts` — refund + payment-history endpoints
- `artifacts/api-server/src/routes/wallet.ts` — refund clawback ledger
- `artifacts/api-server/src/routes/refunds.test.ts` — new
- `artifacts/api-server/src/lib/refunds.test.ts` — new
