# HaulBrokr Launch Report

**Date:** 2026-07-14  
**Branch:** `cursor/production-ready-features-6765`  
**Scope:** HIGH priority production features after infrastructure stabilization and product audit

---

## Production readiness

| Metric                       | Value                                                                                                 |
| ---------------------------- | ----------------------------------------------------------------------------------------------------- |
| **Production readiness**     | **88%**                                                                                               |
| **Recommended go-live date** | **2026-07-28** (two-week buffer for env secrets, Stripe webhook certification, and closed-beta smoke) |

Readiness is scored against marketplace payment → payout → compliance → notify → operate loops. Remaining points are ops/credential and non-blocking product gaps (see blockers).

---

## Completed features (this release)

### 1. Stripe webhook processing

- Handlers: `payment_intent.succeeded`, `payment_intent.payment_failed`, `checkout.session.completed`, `invoice.paid`, `account.updated`, `charge.refunded`, `refund.created` / `refund.updated`, `payout.paid` / `failed` / `canceled` / `updated`, `transfer.*`
- Idempotency via `stripe_webhook_events` ledger (duplicate event IDs short-circuit)
- Invoice.paid marks net-terms jobs `paid` and notifies customer + provider
- Connect payout events sync `payout_accounts` last-payout fields and notify providers

### 2. FMCSA live integration

- QCMobile client: DOT lookup, MC/docket lookup, authority endpoint
- Derives authority, insurance-on-file, operating status, OOS / not-suspended, safety rating
- `POST /account/compliance/fmcsa-lookup` persists snapshot + raw payload
- Graceful retry (3 attempts on 429/5xx/network); clear `fmcsa_not_configured` when `FMCSA_WEB_KEY` missing
- Staff manual verify retained as fallback

### 3. Notification platform

- Channels: Expo push, Resend email, Twilio SMS
- Persisted preferences (`notification_preferences`): channels + topics (jobs, payments, bids, compliance, reminders, marketing)
- APIs: `GET/PUT /notifications/preferences`, broadcast by org role, test send
- Role routing: driver / customer / dispatcher / fleet_manager audiences via `notifyOrgRoles`
- `recordActivity` remains push+in-app for hot paths; `notifyUser` for multi-channel

### 4. Organization administration

- Company profile update (`PATCH /organizations/me`) — name, billing email, address, phone
- Org roles: `owner`, `admin`, `member`, **`fleet_manager`**, **`dispatcher`**
- Permission matrix (`orgPermissions`) for manage company/members/fleet, dispatch, compliance, invites
- Roster endpoint grouping drivers, customers, dispatchers, fleet managers
- Member invite (`POST /organizations/members/invite`) for existing Clerk profiles

### 5. Recurring hauling jobs

- Schema: `recurring_hauls` + `recurring_haul_occurrences`
- CRUD + pause/cancel; frequencies: daily / weekly / biweekly / monthly
- Background scheduler creates marketplace requests when due
- Calendar API: `GET /recurring-hauls/calendar`
- Reminder notifications within configured hours-before window
- Manual ops trigger: `POST /recurring-hauls/run-scheduler`

### Verification run

- `pnpm typecheck` — pass
- `pnpm lint` — (see CI / local run)
- `pnpm --filter @workspace/api-server test` — **385 passed**
- `pnpm build` — (see CI / local run)

New env vars (optional but required for full channel/FMCSA coverage):

- `FMCSA_WEB_KEY`
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`

---

## Remaining launch blockers

| Priority | Blocker                                                                                                        | Owner action                                                        |
| -------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| **P0**   | Configure `FMCSA_WEB_KEY` in Render production                                                                 | Obtain webKey from FMCSA QCDevsite; set secret                      |
| **P0**   | Configure Twilio secrets if SMS is in launch scope                                                             | Set `TWILIO_*` on API host                                          |
| **P0**   | Stripe Dashboard webhook endpoint must subscribe to new event types (`invoice.paid`, `payout.*`, `transfer.*`) | Update webhook destination + rotate/confirm `STRIPE_WEBHOOK_SECRET` |
| **P1**   | Run startup migrations on production boot / verify Neon schema                                                 | Deploy API; confirm boot log “Startup migrations applied”           |
| **P1**   | Closed-beta E2E: charge → webhook → payout; FMCSA lookup; recurring series create → auto request               | Staging checklist                                                   |
| **P2**   | QuickBooks remains simulated (known audit gap)                                                                 | Post-launch                                                         |
| **P2**   | Expo push delivery needs EAS credentials in store builds                                                       | Mobile release track                                                |
| **P2**   | OpenAPI codegen not fully regenerated for all new routes                                                       | Follow-up codegen pass                                              |

None of the P2 items block a controlled marketplace go-live if payments, compliance verify, and notifications (push/email) are certified.

---

## Go-live recommendation

**Target: 2026-07-28**

Suggested sequence:

1. **Day 0–2:** Deploy API + apply schema; set FMCSA + Twilio + Stripe webhook events
2. **Day 3–7:** Staging certification (payments, refunds, FMCSA, org roles, one recurring series)
3. **Day 8–10:** Closed beta with 2–3 carriers and 2 customers
4. **Day 11–14:** Fix any P0/P1 findings; open general availability

If Stripe webhook subscription and FMCSA key are already production-ready, go-live can pull forward to **2026-07-21**.
