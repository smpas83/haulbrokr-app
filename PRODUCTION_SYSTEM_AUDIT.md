# HaulBrokr Production System Audit

**Audit date:** 2026-07-05  
**Auditor role:** Production Release Engineer  
**Scope:** Full-stack production readiness — auth, database, maps, marketplace, payments, storage, email, SMS, push, mobile, admin  
**Method:** Static code audit, environment contract review (`validateProductionEnv.ts`, `ENVIRONMENT_INVENTORY.md`), and live probes against deployed endpoints (`https://haulbrokr.com`, `https://haulbrokr-api.onrender.com`)

---

## Executive Summary

Production infrastructure is **deployed and passing health checks**. The Render API enforces real credentials at startup (`validateProductionEnv()` in `artifacts/api-server/src/index.ts`), which means Neon, Clerk, Stripe, Resend, and R2 keys must be present and `PAYMENTS_MOCK_MODE` must be unset/false for the API to be running.

However, several user-facing capabilities remain **partial or unimplemented**: Google Maps/ETA/directions, outbound push delivery, SMS, refund flows, welcome/dispatch/invoice emails, and mobile scale-ticket capture. Live E2E certification with production credentials has **not** been completed in this environment (`KNOWN_ISSUES.md`).

**Recommendation:** **NO-GO** for a full public production launch until blockers below are resolved and `POST_LAUNCH_CHECKLIST.md` is executed with real accounts.

---

## Live Production Probes (2026-07-05)

| Probe | Result |
|---|---|
| `GET https://haulbrokr.com` | HTTP 200 — Vercel web live |
| `GET https://haulbrokr.com/api/readyz` | HTTP 200 `{"status":"ok"}` |
| `GET https://haulbrokr-api.onrender.com/api/readyz` | HTTP 200 `{"status":"ok"}` (includes Neon `select 1`) |
| `GET https://haulbrokr.com/api/admin/access` | HTTP 200 anonymous gate |
| `POST https://haulbrokr.com/api/webhooks/stripe` (unsigned) | HTTP 400 — webhook route live, signature enforced |

---

## Status Legend

| Symbol | Meaning |
|---|---|
| ✅ LIVE | Production-wired; no mock/demo fallback on the production code path |
| ⚠️ PARTIAL | Implemented but incomplete, unverified, or uses a non-production fallback |
| ❌ DEMO | Synthetic/demo data served to users |
| ❌ MOCK | Simulated third-party integration |
| ❌ DISABLED | Not implemented |

---

## AUTH

| System | Status | Notes |
|---|---|---|
| Clerk production | ⚠️ PARTIAL | Clerk is integrated (`@clerk/express`, `@clerk/clerk-react`, `@clerk/expo`). Production proxy at `/api/__clerk` (`clerkProxyMiddleware.ts`). Cannot confirm `pk_live_` / `sk_live_` vs test keys without dashboard access. |
| Login | ✅ LIVE | Clerk sign-in on web and mobile. |
| Logout | ✅ LIVE | Clerk session termination (standard SDK). |
| Sessions | ✅ LIVE | `requireAuth` / `requireProfile` middleware; staff cookie sessions for admin (`staffAuth.ts`). |
| Roles | ✅ LIVE | `profiles.role` (customer/provider/driver/supervisor) + `staffRole` RBAC (`requireAdmin.ts`). |

### Clerk production — remediation (if still on test keys)

1. **Why not fully verified live:** Clerk live vs test keys are not exposed in the public web bundle (redacted at build time). Production could still be on `pk_test_` keys.
2. **Controls:** `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY` (Render); `VITE_CLERK_PUBLISHABLE_KEY` (Vercel); `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` (EAS).
3. **Change:** Swap all Clerk keys to **live** keys in Render, Vercel, and EAS; configure production allowed origins/domains in Clerk dashboard.
4. **Estimated time:** 1–2 hours (dashboard + redeploys + smoke test).

---

## DATABASE

| System | Status | Notes |
|---|---|---|
| Neon production | ✅ LIVE | `/api/readyz` executes `pool.query("select 1")` — DB reachable in production. |
| Migrations | ✅ LIVE | Drizzle schema via `lib/db/drizzle/`; deploy with `pnpm --filter @workspace/db run push`. |
| Real data | ⚠️ PARTIAL | Cannot inspect production row contents from this audit environment. |
| Demo data removal | ⚠️ PARTIAL | Synthetic marketplace data is **not served** to users (`map.ts` uses DB or empty payload). Seed script refuses production unless `SEED_MARKETPLACE_FORCE=1` (`seed-marketplace.ts`). Run `audit-production-data.ts` against prod to confirm zero `demo-seed-*` rows. |

### Real data — remediation

1. **Why partial:** No production DB credentials in this workspace to verify customer/provider/job counts.
2. **Controls:** `DATABASE_URL` on Render; audit script `artifacts/api-server/scripts/audit-production-data.ts`.
3. **Change:** Run audit script against production Neon; remove any `demo-seed-*` profiles/requests if found.
4. **Estimated time:** 30 minutes (read-only audit) + variable cleanup time if seeded data exists.

### Demo data removal — remediation

1. **Why partial:** Guardrails exist in code but production DB cleanliness is unverified.
2. **Controls:** `artifacts/api-server/scripts/seed-marketplace.ts` (blocked in prod), `audit-production-data.ts`.
3. **Change:** Execute audit script; delete seeded rows matching `demo-seed-%` / `@haulbrokr-seed.local` if present.
4. **Estimated time:** 30 minutes–2 hours depending on findings.

---

## MAPS

| System | Status | Notes |
|---|---|---|
| Google Maps API | ⚠️ PARTIAL | Server: optional `GOOGLE_MAPS_API_KEY` (`geocodeCache.ts`). Web: `VITE_GOOGLE_MAPS_API_KEY` (`haulbrokr/src/pages/map.tsx`). Mobile native: `GOOGLE_MAPS_API_KEY` via EAS/`app.config.js`; iOS defaults to Apple Maps (`react-native-maps`). |
| Geocoding | ⚠️ PARTIAL | Server: Google → Nominatim fallback. Mobile job map: **Nominatim only** (`haulbrokr-mobile/lib/geocode.ts`). |
| Reverse geocoding | ❌ DISABLED | No reverse-geocode endpoint or client implementation found. |
| ETA | ❌ DISABLED | No Google Distance Matrix / Directions integration. Only haversine distance (`geocode.ts`, `map.ts`). |
| Directions | ❌ DISABLED | No turn-by-turn or route polyline API. |
| Live markers | ✅ LIVE | `GET /map/marketplace` builds markers from live DB requests/jobs/trucks. |
| Demo mode disabled | ✅ LIVE | Production path always returns `demoMode: false` (`buildLiveMarketplace`, `buildEmptyMarketplace`). `buildDemoMarketplace()` is seed/test-only. |

### Google Maps API — remediation

1. **Why partial:** Keys may be unset on server (Nominatim fallback) or mobile (Apple Maps on iOS).
2. **Controls:** `GOOGLE_MAPS_API_KEY` (Render + EAS), `VITE_GOOGLE_MAPS_API_KEY` (Vercel).
3. **Change:** Create restricted production keys; set on all three hosts; enable Geocoding + Maps JS + mobile SDKs.
4. **Estimated time:** 2–4 hours (GCP console + deploy + device test).

### Geocoding — remediation

1. **Why partial:** Mobile bypasses Google entirely; server falls back to Nominatim (rate-limited, not SLA-backed).
2. **Controls:** `geocodeCache.ts`, `haulbrokr-mobile/lib/geocode.ts`, `useJobCoordinates.ts`.
3. **Change:** Route mobile geocoding through `/api/maps/geocode` or add `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`; remove Nominatim as primary in production.
4. **Estimated time:** 4–8 hours engineering + QA.

### Reverse geocoding / ETA / Directions — remediation

1. **Why disabled:** No implementation in codebase.
2. **Controls:** New API routes + client hooks (not present).
3. **Change:** Add Google Geocoding reverse + Directions/Distance Matrix endpoints; wire mobile/web tracking UI.
4. **Estimated time:** 1–2 days per capability (engineering + QA).

---

## MARKETPLACE

| System | Status | Notes |
|---|---|---|
| Jobs | ✅ LIVE | Full CRUD/payment lifecycle in `routes/jobs.ts`. |
| Requests | ✅ LIVE | `routes/requests.ts` — open loads, bidding, award flow. |
| Facilities | ⚠️ PARTIAL | No `facilities` entity. Closest equivalent: **`dump_sites`** table + `GET /dump-sites` (`dump-sites.ts`). Requires seed data (`dump-sites.ts` seed script) — may be empty in prod. |
| Drivers | ✅ LIVE | `profiles.role = driver`, job assignment, GPS ping (`tracking.ts`). |
| Companies | ✅ LIVE | `profiles` + `organizations` with invite codes. |
| Dispatch | ✅ LIVE | `GET /dispatch/overview` — Digital Twin fleet view (`tracking.ts`); web page at `/dispatch`. |

### Facilities (dump sites) — remediation

1. **Why partial:** Facilities are modeled as dump sites, not a generic facility registry; table may be empty without seeding.
2. **Controls:** `lib/db/src/schema/dump-sites.ts`, `routes/dump-sites.ts`, seed script referenced in `seed-marketplace.ts`.
3. **Change:** Seed or import real dump-site/facility records into production Neon.
4. **Estimated time:** 2–4 hours (data import) or 1 day if building admin CRUD UI.

---

## PAYMENTS

| System | Status | Notes |
|---|---|---|
| Stripe | ✅ LIVE | Real Stripe SDK when env keys set (`stripeClient.ts`). Production startup **rejects** missing/invalid keys. |
| Stripe Connect | ✅ LIVE | Provider onboarding + payout readiness (`payoutStatus.ts`, `account.ts`). |
| Webhooks | ✅ LIVE | `POST /api/webhooks/stripe` — signature verification active (probed). Handler in `stripeWebhooks.ts`. |
| Payment Intents | ✅ LIVE | Charge + Connect transfer flow in `jobs.ts`. |
| Refunds | ❌ DISABLED | No refund API route or Stripe refund calls found in `artifacts/api-server/src/`. |
| Driver payouts | ✅ LIVE | `stripe.transfers.create` + retry scheduler (`payoutRetry.ts`, `payoutRetryScheduler.ts`). |
| PAYMENTS_MOCK_MODE OFF | ✅ LIVE | `validateProductionEnv.ts` fails startup if `PAYMENTS_MOCK_MODE` is true in production. `.env.example` default is dev-only. |

### Refunds — remediation

1. **Why disabled:** No refund endpoint or admin action implemented.
2. **Controls:** Would need new routes in `routes/jobs.ts` or `routes/admin.ts`.
3. **Change:** Implement Stripe `refunds.create` with admin authorization and job status guards.
4. **Estimated time:** 1–2 days (API + admin UI + tests).

---

## DOCUMENT STORAGE

| System | Status | Notes |
|---|---|---|
| Cloudflare R2 | ✅ LIVE | Required in production env. S3-compatible client in `objectStorage.ts` (`R2_*` vars). |
| W-9 | ✅ LIVE | `w9_submissions` table + `/account` W-9 routes (`account.ts`). |
| Insurance | ✅ LIVE | `insurance_submissions` + `/account` insurance routes. |
| POD (Proof of Delivery) | ✅ LIVE | `delivery_evidence` table — photo + site notes (`evidence.ts`). |
| Scale Tickets | ⚠️ PARTIAL | API supports `weightTons` on `tickets` table (`tickets.ts`). **Mobile create-ticket flow does not collect weight/photo** (`KNOWN_ISSUES.md`). |
| Load Tickets | ✅ LIVE | QR/HMAC ticket flow (`tickets.ts`, `TICKET_QR_SECRET`). |
| Photos | ✅ LIVE | Presigned R2 upload pipeline (`storage.ts`) + job evidence. |

### Scale Tickets — remediation

1. **Why partial:** Mobile logs loads without weight or scale-ticket photo capture.
2. **Controls:** `artifacts/haulbrokr-mobile/app/job/[id].tsx` ticket creation UI; `routes/tickets.ts`.
3. **Change:** Add weight + photo fields to mobile ticket creation; upload via storage pipeline.
4. **Estimated time:** 4–8 hours engineering + QA.

---

## EMAIL

| System | Status | Notes |
|---|---|---|
| Resend | ✅ LIVE | Required in production env (`RESEND_API_KEY`, `RESEND_FROM_EMAIL`). Client in `resendClient.ts`. |
| Welcome | ❌ DISABLED | No welcome/onboarding email on profile creation (`routes/profiles.ts`). |
| Dispatch | ❌ DISABLED | Dispatch is in-app activity only (`activityTable`); no dispatch email template/send found. |
| Invoice | ⚠️ PARTIAL | PDF invoice generation exists (`jobInvoice.ts`, download routes). **No automated invoice email send.** |
| Payment | ⚠️ PARTIAL | Emails sent for: compliance review (`admin.ts`), document reminders (`docReminders.ts`), stuck payout alerts (`payoutRetry.ts`). No payment-receipt email on successful charge. |

### Welcome email — remediation

1. **Why disabled:** Not implemented.
2. **Controls:** Add send in `routes/profiles.ts` POST handler using `getUncachableResendClient()`.
3. **Change:** Create welcome template; send after first profile creation.
4. **Estimated time:** 2–4 hours.

### Dispatch email — remediation

1. **Why disabled:** Notifications are in-app only.
2. **Controls:** Job award/assign handlers in `routes/jobs.ts` / bid award flow.
3. **Change:** Add Resend send on job award with provider/customer templates.
4. **Estimated time:** 4–8 hours.

### Invoice / payment receipt email — remediation

1. **Why partial:** PDF exists; email on completion/payment not wired.
2. **Controls:** `jobInvoice.ts`, job completion/payment handlers in `jobs.ts` / `stripeWebhooks.ts`.
3. **Change:** Attach or link invoice PDF via Resend on `paymentStatus = released`.
4. **Estimated time:** 4–8 hours.

---

## SMS

| System | Status | Notes |
|---|---|---|
| Twilio | ❌ DISABLED | **Not implemented.** Mobile has an "SMS Alerts" toggle (`account.tsx`) stored in local state only. Job screens use native `sms:` deep links, not Twilio. |

### Twilio — remediation

1. **Why disabled:** No Twilio SDK, env vars, or send routes in codebase.
2. **Controls:** Would need new `TWILIO_*` env vars + notification service.
3. **Change:** Integrate Twilio Programmable SMS; wire toggle to user preferences; send on job/dispatch events.
4. **Estimated time:** 2–3 days (integration + compliance + QA).

---

## PUSH

| System | Status | Notes |
|---|---|---|
| Expo | ❌ DISABLED | `expo-notifications` **not** in mobile `package.json`. No push permission flow. |
| Registration | ⚠️ PARTIAL | API endpoint `POST /notifications/register` stores tokens in `device_tokens` (`notifications.ts`). **`registerPushToken()` is exported but never called** from the mobile app. |
| Delivery | ❌ DISABLED | No `expo-server-sdk` in api-server. Push tokens are stored but **never sent**. Notifications are in-app activity feed only. |

### Push notifications — remediation

1. **Why disabled:** Client SDK missing; server has no send path.
2. **Controls:** `artifacts/haulbrokr-mobile/hooks/useDriverTracking.ts` (`registerPushToken`), `routes/notifications.ts`, `lib/db/src/schema/device-tokens.ts`.
3. **Change:** Add `expo-notifications` to mobile; call `registerPushToken` on login; add `expo-server-sdk` send helper on API; trigger on job/bid/payment events.
4. **Estimated time:** 2–3 days (client + server + EAS credentials + QA).

---

## MOBILE

| System | Status | Notes |
|---|---|---|
| Live APIs | ✅ LIVE | All authenticated calls go to `https://${EXPO_PUBLIC_DOMAIN}/api` (`useLiveApi.ts`). |
| Live jobs | ✅ LIVE | `useLiveJobs`, `useLiveRequests`, payment mutations wired. |
| Live uploads | ✅ LIVE | Storage presign + finalize flow available to mobile clients. |
| Live maps | ⚠️ PARTIAL | Marketplace map uses live API; client-side geocoding is Nominatim; unauthenticated screens fall back to empty local `AppContext` state. |
| Live auth | ✅ LIVE | `@clerk/expo` with `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`. |

### Mobile live maps — remediation

1. **Why partial:** Nominatim geocoding + demo local state for unsigned/offline preview paths.
2. **Controls:** `haulbrokr-mobile/lib/geocode.ts`, `context/AppContext.tsx`, `app/team.tsx` ("Showing demo data" banner).
3. **Change:** Use server geocoding; gate demo banners behind explicit dev flag; require auth for map data.
4. **Estimated time:** 4–8 hours.

---

## ADMIN

| System | Status | Notes |
|---|---|---|
| Analytics | ✅ LIVE | Admin overview stats in `routes/admin.ts` (jobs, revenue, activity). |
| Compliance | ✅ LIVE | W-9/insurance/DOT review bundles (`adminComplianceBundle.ts`). |
| Payments | ✅ LIVE | Stuck payout retry, payout monitoring, Stripe status sync. |
| Marketplace | ✅ LIVE | Admin visibility into requests/jobs; web map at `/map`. |

---

## Additional Findings (Out of Checklist Scope)

| Item | Status | Notes |
|---|---|---|
| QuickBooks integration | ❌ MOCK | Explicitly simulated (`routes/quickbooks.ts` — "Simulated OAuth connect"). Do not market as live. |
| Truck map coordinates | ⚠️ PARTIAL | Live trucks use geocoded **owner company city** with deterministic offsets, not live GPS (`map.ts` lines 150–166). |
| E2E production certification | ❌ DISABLED | `KNOWN_ISSUES.md` — not certified in this environment. |
| CI default | ❌ MOCK | `.github/workflows/ci.yml` sets `PAYMENTS_MOCK_MODE: "true"` (CI only, not production). |

---

## Non-Live Systems — Remediation Summary

| System | Status | Why | Control file(s) | Required change | Est. time |
|---|---|---|---|---|---|
| Clerk live keys | ⚠️ PARTIAL | Test vs live unverified | Render/Vercel/EAS env | Swap to `pk_live_`/`sk_live_` | 1–2 h |
| Production real data | ⚠️ PARTIAL | DB not inspected | `audit-production-data.ts` | Run audit against Neon | 30 min+ |
| Demo DB rows | ⚠️ PARTIAL | Seed guard only | `seed-marketplace.ts` | Audit + delete `demo-seed-*` | 30 min–2 h |
| Google Maps (full stack) | ⚠️ PARTIAL | Optional/fallback paths | `geocodeCache.ts`, Vercel/EAS env | Set keys everywhere | 2–4 h |
| Geocoding (mobile) | ⚠️ PARTIAL | Nominatim on client | `lib/geocode.ts` | Use Google/server geocode | 4–8 h |
| Reverse geocoding | ❌ DISABLED | Not built | — | New API + client | 1–2 days |
| ETA | ❌ DISABLED | Not built | — | Distance Matrix API | 1–2 days |
| Directions | ❌ DISABLED | Not built | — | Directions API | 1–2 days |
| Facilities / dump sites | ⚠️ PARTIAL | May be empty | `dump-sites.ts` | Seed real facility data | 2–4 h |
| Refunds | ❌ DISABLED | Not built | — | Stripe refund routes | 1–2 days |
| Scale ticket mobile | ⚠️ PARTIAL | Incomplete UI | `app/job/[id].tsx` | Weight + photo capture | 4–8 h |
| Welcome email | ❌ DISABLED | Not built | `profiles.ts` | Resend on signup | 2–4 h |
| Dispatch email | ❌ DISABLED | In-app only | job award handlers | Resend template | 4–8 h |
| Invoice email | ⚠️ PARTIAL | PDF only | `jobInvoice.ts` | Email on release | 4–8 h |
| Payment receipt email | ⚠️ PARTIAL | Partial coverage | `jobs.ts`, webhooks | Receipt on charge | 4–8 h |
| Twilio SMS | ❌ DISABLED | Not built | — | Full Twilio integration | 2–3 days |
| Expo push client | ❌ DISABLED | No SDK | mobile `package.json` | Add expo-notifications | 1 day |
| Push token registration | ⚠️ PARTIAL | Never called | `useDriverTracking.ts` | Wire on app launch | 2–4 h |
| Push delivery | ❌ DISABLED | No sender | api-server | expo-server-sdk | 1–2 days |
| QuickBooks | ❌ MOCK | Simulated | `quickbooks.ts` | Real OAuth or hide feature | 3–5 days |

---

## Scorecard

### Counts (55 checklist items)

| Status | Count | % of total |
|---|---:|---:|
| ✅ LIVE | 34 | 61.8% |
| ⚠️ PARTIAL | 11 | 20.0% |
| ❌ DISABLED | 9 | 16.4% |
| ❌ DEMO | 0 | 0.0% |
| ❌ MOCK | 1* | 1.8% |

\* PAYMENTS_MOCK_MODE is **OFF** in production (counted as LIVE). The one MOCK item is QuickBooks (out of checklist scope but noted).

### Weighted Production Completion

Scoring: LIVE = 100%, PARTIAL = 50%, DISABLED/MOCK/DEMO = 0%.

```
(34 × 100 + 11 × 50 + 10 × 0) / 55 = 71.8%
```

### Overall Metrics

| Metric | Value |
|---|---:|
| **Overall Production Completion %** | **71.8%** |
| **Overall Live Services %** | **61.8%** (34/55 fully live) |
| **Overall Demo/Mock Services %** | **1.8%** (QuickBooks simulated; payment mock blocked in prod; marketplace demo data not served) |

---

## GO / NO-GO Recommendation

### **NO-GO** for full public production launch

**Rationale:**

1. **Push notifications non-functional** — tokens can be stored but nothing sends; mobile never registers tokens.
2. **SMS not implemented** — UI implies capability that does not exist.
3. **No refund path** — required for payment operations/compliance.
4. **Maps/ETA incomplete** — marketing claims (deck slides) exceed implemented APIs (no Directions/ETA).
5. **Email gaps** — no welcome, dispatch, or invoice emails; payment emails partial.
6. **Scale ticket mobile gap** — compliance workflow incomplete on primary driver surface.
7. **E2E not certified** — `POST_LAUNCH_CHECKLIST.md` not executed with live credentials (`KNOWN_ISSUES.md` blocker).

### Conditional GO (soft launch / limited beta)

Acceptable **only if** stakeholders explicitly accept:

- In-app notifications only (no push/SMS)
- Manual refund handling via Stripe dashboard
- Nominatim/geocode fallbacks for maps
- Incomplete scale-ticket mobile capture
- QuickBooks labeled "Coming soon"

**Minimum pre-launch actions even for beta:**

1. Confirm Clerk **live** keys (not test) on Render/Vercel/EAS.
2. Confirm Stripe **live** keys and webhook endpoint in Stripe dashboard.
3. Run `audit-production-data.ts` — zero demo-seed rows.
4. Run `node scripts/verify-deployment-readiness.mjs` with `VERIFY_LIVE_THIRD_PARTY=1`.
5. Execute auth → post request → bid → pay → upload → complete flow on staging, then production.
6. Rotate `STAFF_DEFAULT_PASSWORD` after `seed-staff-users.ts`.

---

## Verification Commands (for release engineer)

```bash
# Environment + endpoint readiness (requires filled .env or host dashboards)
node scripts/verify-deployment-readiness.mjs

# With live third-party credential checks
VERIFY_LIVE_THIRD_PARTY=1 node scripts/verify-deployment-readiness.mjs

# Production demo-data audit (requires production DATABASE_URL)
pnpm --filter @workspace/api-server exec tsx scripts/audit-production-data.ts
```

---

## Document Control

| Field | Value |
|---|---|
| Generated by | Production Release Engineer audit |
| Codebase ref | HaulBrokr monorepo (api-server, haulbrokr web, haulbrokr-mobile) |
| Production URLs | https://haulbrokr.com · https://haulbrokr-api.onrender.com |
| Related docs | `GO_LIVE_CHECKLIST.md`, `POST_LAUNCH_CHECKLIST.md`, `KNOWN_ISSUES.md`, `ENVIRONMENT_INVENTORY.md` |
