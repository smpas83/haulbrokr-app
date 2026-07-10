# HaulBrokr RC2 Stabilization Report

**Sprint:** RC2 Stabilization — Closed Beta Certification  
**Date:** 2026-07-04 (UTC)  
**RC2 Commit:** `a9cbe6a8aec88cade93866418a5003efb16747cf` (`master`)  
**Staging URLs:** https://haulbrokr.com · https://haulbrokr-api.onrender.com  
**Feature freeze:** Active — bug fixes, deployment fixes, and validation only.

---

## Executive Summary

RC2 partially unblocked Clerk-based marketplace workflows by provisioning five staging test accounts and validating customer, fleet, and driver onboarding on live production services. **Staff authentication, R2/CDN, Google Maps rendering, dump-site data seeding, Stripe, Resend, mobile EAS preview, and the full end-to-end job lifecycle remain unresolved.**

### Recommendation: **NO-GO** for Closed Beta

Five critical infrastructure items must be fixed by an operator with Render, Vercel, Neon, and Cloudflare access before inviting external beta users.

---

## Deliverables Index

| Deliverable | Location |
|-------------|----------|
| This report | `RC2_STABILIZATION_REPORT.md` |
| Screenshots (12 curated) | `docs/rc2-screenshots/` |
| Staff seed script (missing from RC1) | `scripts/seed-staff-easy.sh` |
| Full staging bootstrap | `scripts/rc2-bootstrap-staging.sh` |
| Clerk test user provisioner | `scripts/create-clerk-staging-users.mjs` |
| Infrastructure logs | See § Logs below |

---

## Priority 1 — Critical

### 1. Staff Authentication

| Test | Result | Evidence |
|------|--------|----------|
| `seed-staff` script exists | PASS | `artifacts/api-server/scripts/seed-staff-users.ts` |
| `seed-staff-easy.sh` wrapper | **FIXED** | Added `scripts/seed-staff-easy.sh` (was referenced but missing) |
| Run seed-staff on production DB | **BLOCKED** | `DATABASE_URL` not available in operator environment |
| Admin login (`ceo` / `HaulBrokr-Staff-2026!`) | **FAIL** | HTTP 401 — `POST /api/admin/login` |
| Admin login (`ceo` / `HaulBrokr-RC2-Staging!2026`) | **FAIL** | HTTP 401 |
| Dispatcher login (staff) | **FAIL** | No `dispatcher` staff role exists; dispatch uses provider Clerk accounts |
| Role-based permissions | **BLOCKED** | Cannot verify without successful staff session |

**Screenshot:** `docs/rc2-screenshots/01-staff-login.webp`, `02-staff-login-fail.webp`

**Root cause:** Production Neon `staff_users` table either has no rows or password hash does not match documented defaults. Requires operator to run:

```bash
DATABASE_URL='postgresql://...' STAFF_DEFAULT_PASSWORD='...' bash scripts/seed-staff-easy.sh
```

**Dispatcher note:** HaulBrokr does not have a separate "dispatcher" staff role. Dispatch workflows are performed by **provider (fleet owner)** accounts via `/dispatch` and Load Board. Map supervisor/foreman role is `supervisor` (customer org member).

---

### 2. R2 / Object Storage

| Test | Result | Evidence |
|------|--------|----------|
| `cdn.haulbrokr.com` DNS resolves | **FAIL** | `curl: (6) Could not resolve host` |
| Upload via API | **BLOCKED** | No `R2_*` credentials in operator environment |
| Download / signed URLs | **BLOCKED** | — |
| Image/document previews | **BLOCKED** | — |

**Root cause:** Custom R2 public domain `cdn.haulbrokr.com` has no DNS record. Operator must either:
1. Add Cloudflare CNAME for `cdn` → R2 public bucket custom domain, or
2. Update `R2_PUBLIC_URL` on Render to a working `*.r2.dev` public URL.

Unit tests for upload tokens pass in CI (`storage.test.ts`, `objectStorage.test.ts`) but live R2 was not exercised.

---

### 3. Staging Test Accounts

**Provisioner:** `node scripts/create-clerk-staging-users.mjs` — **EXECUTED**

| Role | Username | Email | Clerk ID | Onboarding | Password |
|------|----------|-------|----------|------------|----------|
| Admin (Clerk) | `rc2admin` | rc2-admin@haulbrokr.com | `user_3G1lRSrQa1nnyo1WVmyZRxwSw8j` | Not completed | `HaulBrokr-RC2-Staging!2026` |
| Customer | `rc2customer` | rc2-customer@haulbrokr.com | `user_3G1lRSeEvztIwVZa0WX9Q3YC6KX` | **PASS** — RC2 Test Construction LLC | same |
| Fleet Manager / Dispatcher | `rc2fleet` | rc2-fleet@haulbrokr.com | `user_3G1lRWcqtNmsRJvaJLpHvKtLQ7l` | **PASS** — RC2 Test Hauling LLC | same |
| Driver | `rc2driver` | rc2-driver@haulbrokr.com | `user_3G1lRUxmdQp6IZVqvr1TizQ3xyT` | **PASS** — joined fleet via invite | same |
| Supervisor (foreman) | `rc2supervisor` | rc2-supervisor@haulbrokr.com | `user_3G1lRebE10gXTcngG7stcdAKvc8` | Not completed | same |

**Fleet invite code:** `QBCUZA` (RC2 Test Hauling LLC)

**Operator action still required:**
- Add `user_3G1lRSrQa1nnyo1WVmyZRxwSw8j` to `ADMIN_USER_IDS` on Render
- Complete rc2-supervisor onboarding with customer org invite code (after rc2-customer creates one)
- Re-seed staff admin accounts (see §1)

**Screenshots:** `03-customer-onboarding.webp` through `09-driver-dashboard.webp`, `07-fleet-invite-code.webp`

---

## Priority 2

### 4. Dump Sites & Facilities

| Test | Result | Evidence |
|------|--------|----------|
| `GET /api/dump-sites` | **FAIL (data)** | Returns `[]` (0 facilities) |
| `seed-dump-sites` script exists | PASS | `artifacts/api-server/src/seed/dump-sites.ts` (200+ nationwide sites) |
| Run seed on production DB | **BLOCKED** | No `DATABASE_URL` |
| UI: Browse Dump Sites in request form | **PASS** | Modal opens with state/facility filters |
| UI: Sites populate after state select | **FAIL** | No data to display (empty DB) |

**Screenshot:** `10-request-form.webp`, `11-dump-sites-modal.webp`

**Fix:** `DATABASE_URL='...' pnpm --filter @workspace/api-server run seed-dump-sites`

---

### 5. Google Maps

| Test | Result | Evidence |
|------|--------|----------|
| Map page loads (authenticated) | PASS | `/map` accessible when signed in |
| Google Maps script loads | **FAIL** | Error: `VITE_GOOGLE_MAPS_API_KEY is not set` |
| Find My Location | **BLOCKED** | Maps SDK not loaded |
| Load dump sites on map | **BLOCKED** | — |
| Load trucks on map | **BLOCKED** | Stats show 0 (no marketplace data) |
| Load jobs on map | **BLOCKED** | — |
| Markers / routes / ETA | **BLOCKED** | — |

**Screenshot:** `05-map-api-key-error.webp`, `12-driver-map-error.webp`

**Root cause:** `VITE_GOOGLE_MAPS_API_KEY` is not set in the **Vercel** project environment. This is a deployment configuration fix — add the key in Vercel dashboard and redeploy web.

---

### 6. Resend Email

| Email Type | Result | Message ID |
|------------|--------|------------|
| Welcome email | **BLOCKED** | No `RESEND_API_KEY` |
| Password reset | **BLOCKED** | Clerk handles; not verified |
| Invitation | **BLOCKED** | — |
| Job notifications | **BLOCKED** | — |

Resend client logic unit-tested in `payoutRetry.test.ts` — PASS in CI only.

---

### 7. Stripe Payments

| Test | Result | Evidence |
|------|--------|----------|
| Customer payment | **BLOCKED** | No `STRIPE_SECRET_KEY` |
| Vendor payout flow | **BLOCKED** | — |
| Refund | **BLOCKED** | — |
| Webhook signature enforcement | **PASS** | Unsigned POST → HTTP 400 |
| Webhook event processing | **BLOCKED** | — |
| Failed payment handling | **BLOCKED** | — |

Webhook security verified live. Full payment lifecycle not executed.

---

## Priority 3

### 8. EAS Preview Build

| Test | Result |
|------|--------|
| `eas build --profile preview` | **BLOCKED** — no `EXPO_TOKEN` / EAS credentials |
| iOS build | Not executed |
| Android APK | Not executed |

### 9. Mobile Device Testing

| Test | Result |
|------|--------|
| iPhone | **NOT EXECUTED** |
| Android | **NOT EXECUTED** |
| Login / Signup | **BLOCKED** |
| Jobs / Requests / Maps / GPS / Tracking | **BLOCKED** |
| Uploads / Camera | **BLOCKED** |
| Push notifications | **BLOCKED** |
| Wallet / Payments | **BLOCKED** |

Mobile unit tests: **70/70 PASS** (simulated environment only).

### 10. Complete End-to-End Workflow

| Step | Result | Notes |
|------|--------|-------|
| Customer creates request | **BLOCKED** | Form loads; dump sites empty; no full submission tested |
| Dispatcher assigns | **BLOCKED** | No active request/job |
| Driver accepts | **BLOCKED** | 0 active jobs |
| Driver navigates | **FAIL** | Maps API key missing |
| Driver checks in | **BLOCKED** | — |
| Driver uploads ticket | **BLOCKED** | R2 not verified |
| Customer signs | **BLOCKED** | — |
| Job completes | **BLOCKED** | — |
| Invoice generated | **BLOCKED** | — |
| Payment processed | **BLOCKED** | Stripe not tested |
| Notification sent | **BLOCKED** | Resend not tested |
| Dashboard updated | **PARTIAL** | Dashboards load with 0 jobs |

**Nothing simulated** — all attempted steps used live https://haulbrokr.com and production Clerk. Steps beyond onboarding were blocked by missing env configuration and empty seed data.

---

## Workflow PASS/FAIL Matrix

### Customer

| Workflow | Result |
|----------|--------|
| Register | PASS (Clerk user pre-created) |
| Login | PASS |
| Request Haul | PARTIAL (form loads; submission not completed) |
| View Dashboard | PASS |
| Receive Quote | BLOCKED |
| Accept Quote | BLOCKED |
| Track Job | BLOCKED |
| View Documents | BLOCKED |
| Receive Invoice | BLOCKED |
| Leave Rating | BLOCKED |

### Driver

| Workflow | Result |
|----------|--------|
| Login | PASS |
| Accept Job | BLOCKED (no jobs) |
| Navigate | FAIL (Maps key) |
| Upload Load Ticket | BLOCKED (R2) |
| Upload Scale Ticket | BLOCKED |
| Upload POD | BLOCKED |
| Upload Photos | BLOCKED |
| Complete Job | BLOCKED |
| Verify Earnings | BLOCKED |

### Dispatcher (Fleet Owner)

| Workflow | Result |
|----------|--------|
| Assign Driver | BLOCKED |
| Reassign Driver | BLOCKED |
| Monitor Job | BLOCKED |
| Review Timeline | BLOCKED |
| Close Job | BLOCKED |

### Fleet Owner

| Workflow | Result |
|----------|--------|
| View Fleet | PASS (empty state) |
| Assign Driver | BLOCKED |
| Review Revenue | BLOCKED |
| Review Compliance | BLOCKED |
| Review Payouts | BLOCKED |

### Admin

| Workflow | Result |
|----------|--------|
| Staff login | FAIL |
| Clerk admin (rc2-admin) | BLOCKED (not in ADMIN_USER_IDS) |
| Approve Users | BLOCKED |
| Review Compliance | BLOCKED |
| Review Marketplace | BLOCKED |
| Review Payments | BLOCKED |
| Review Analytics | BLOCKED |

---

## Automated Test Gates

| Command | Result |
|---------|--------|
| `pnpm run verify:staging-e2e` | **14/14 PASS** |
| `pnpm -r --if-present run test` | **410/410 PASS** |
| `pnpm run typecheck` | PASS (prior RC1 run) |
| `pnpm run build` | PASS (prior RC1 run) |

---

## Logs

### Staging E2E (2026-07-04)

```
PASS  Web homepage — HTTP 200
PASS  Web admin login — HTTP 200
PASS  API healthz — HTTP 200
PASS  API readyz — HTTP 200
PASS  API proxied readyz — HTTP 200
PASS  Profiles require auth — HTTP 401
PASS  Copilot require auth — HTTP 401
PASS  Dispatch requires auth — HTTP 401
PASS  Tracking requires auth — HTTP 401
PASS  Notifications require auth — HTTP 401
PASS  Dump sites public — HTTP 200
PASS  Admin access anonymous — HTTP 200
PASS  Stripe webhook rejects unsigned — HTTP 400
PASS  Rate limit headers present
--- Results: 14/14 passed ---
```

### Staff Login Attempt

```
POST https://haulbrokr.com/api/admin/login
{"username":"ceo","password":"HaulBrokr-Staff-2026!"}
→ 401 {"error":"Invalid username or password."}
```

### R2 CDN Probe

```
curl https://cdn.haulbrokr.com
→ curl: (6) Could not resolve host: cdn.haulbrokr.com
```

### Dump Sites API

```
GET https://haulbrokr.com/api/dump-sites
→ []  (0 records)
```

### Clerk User Provisioning

```
CREATED  admin        rc2-admin@haulbrokr.com       user_3G1lRSrQa1nnyo1WVmyZRxwSw8j
CREATED  customer     rc2-customer@haulbrokr.com    user_3G1lRSeEvztIwVZa0WX9Q3YC6KX
CREATED  fleet        rc2-fleet@haulbrokr.com       user_3G1lRWcqtNmsRJvaJLpHvKtLQ7l
CREATED  driver       rc2-driver@haulbrokr.com      user_3G1lRUxmdQp6IZVqvr1TizQ3xyT
CREATED  supervisor   rc2-supervisor@haulbrokr.com  user_3G1lRebE10gXTcngG7stcdAKvc8
```

---

## Remaining Bugs

| ID | Severity | Description | Owner | Status |
|----|----------|-------------|-------|--------|
| RC2-001 | **Critical** | Staff admin login fails — DB seed/password mismatch | Ops / Neon | OPEN |
| RC2-002 | **Critical** | `cdn.haulbrokr.com` DNS does not resolve | Cloudflare | OPEN |
| RC2-003 | **Critical** | `VITE_GOOGLE_MAPS_API_KEY` not set on Vercel | Vercel | OPEN |
| RC2-004 | **Critical** | Dump sites table empty in production DB | Ops / Neon | OPEN |
| RC2-005 | **Critical** | Full E2E job lifecycle not certified | QA | OPEN |
| RC2-006 | **High** | `rc2-admin` not in `ADMIN_USER_IDS` | Render | OPEN |
| RC2-007 | **High** | Stripe live payment flow untested | Ops | OPEN |
| RC2-008 | **High** | Resend transactional email untested | Ops | OPEN |
| RC2-009 | **High** | Mobile EAS preview not built/tested | Expo | OPEN |
| RC2-010 | **Medium** | Transient 404 on profile during onboarding | API | OPEN |
| RC2-011 | **Low** | Duplicate form field ID console warnings | Web | OPEN |

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Beta users cannot access admin panel | High | High | Run `seed-staff-easy.sh` immediately |
| Document/photo uploads fail in production | High | High | Fix R2 DNS or `R2_PUBLIC_URL` |
| Map and navigation unusable on web | **Confirmed** | High | Set `VITE_GOOGLE_MAPS_API_KEY` on Vercel |
| Haul requests cannot select dump facilities | High | Medium | Run `seed-dump-sites` |
| Payments fail silently | Unknown | Critical | Execute Stripe test-mode checklist with live keys |
| Email notifications never arrive | Unknown | High | Verify Resend with test send |
| Mobile app untested on devices | Confirmed | High | Build EAS preview, test iOS + Android |
| Using production Clerk for staging | Confirmed | Medium | Accept risk or create Clerk dev instance |

---

## RC2 Fixes Delivered (This Sprint)

| Fix | Type | File |
|-----|------|------|
| Missing staff seed wrapper | Infrastructure script | `scripts/seed-staff-easy.sh` |
| RC2 staging bootstrap orchestrator | Infrastructure script | `scripts/rc2-bootstrap-staging.sh` |
| Clerk staging user provisioner | Infrastructure script | `scripts/create-clerk-staging-users.mjs` |
| Five Clerk QA accounts created | Live provisioning | Clerk API (see §3) |
| Customer/fleet/driver onboarding validated | Live validation | Browser tests |

**No application code or UI changes** — per RC2 scope (validation + infrastructure tooling only).

---

## Operator Runbook (Required Before GO)

Execute in order with production credentials:

```bash
# 1. Staff admin + dump sites + optional marketplace seed
DATABASE_URL='postgresql://...' \
STAFF_DEFAULT_PASSWORD='YourSecurePassword' \
bash scripts/rc2-bootstrap-staging.sh

# 2. Clerk users (already created; re-run if needed)
CLERK_SECRET_KEY='sk_...' node scripts/create-clerk-staging-users.mjs

# 3. Render dashboard
#    - Add user_3G1lRSrQa1nnyo1WVmyZRxwSw8j to ADMIN_USER_IDS
#    - Verify R2_PUBLIC_URL points to resolvable domain

# 4. Vercel dashboard
#    - Set VITE_GOOGLE_MAPS_API_KEY
#    - Redeploy web

# 5. Cloudflare
#    - Add DNS CNAME for cdn.haulbrokr.com → R2 public bucket

# 6. Validate
TARGET_ENV=staging VERIFY_LIVE_THIRD_PARTY=1 pnpm run verify:deployment
pnpm run verify:staging-e2e

# 7. Mobile
cd artifacts/haulbrokr-mobile
eas build --platform all --profile preview

# 8. Execute STAGING_CHECKLIST.md end-to-end with RC2 credentials
```

---

## Go / No-Go Recommendation

### **NO-GO** for Closed Beta

**Rationale:** Four confirmed production configuration failures block core beta workflows:
1. Staff admin authentication non-functional
2. R2 public CDN unreachable
3. Google Maps completely disabled on web
4. Zero dump-site records in database

Additionally, Stripe payments, Resend emails, R2 uploads, mobile device validation, and the complete job lifecycle were not certified with live services.

### Conditions for GO

All of the following must pass on a re-validation sprint:

- [ ] Staff login succeeds for `ceo` with documented password
- [ ] `cdn.haulbrokr.com` (or corrected URL) resolves and serves objects
- [ ] `/map` renders Google Maps with markers (authenticated)
- [ ] `/api/dump-sites` returns > 0 facilities
- [ ] Stripe test payment completes with webhook acknowledgment
- [ ] Resend delivers at least one transactional email (capture message ID)
- [ ] R2 upload + signed download verified for one document type
- [ ] Full E2E workflow completes without simulation
- [ ] EAS preview tested on iPhone and Android

### What Improved Since RC1

- Clerk staging accounts provisioned and documented
- Customer, fleet, and driver onboarding validated live
- Fleet invite code `QBCUZA` confirmed working for driver join
- Request form and dump-site UI confirmed functional (pending data seed)
- Missing `seed-staff-easy.sh` script restored

---

*Generated by HaulBrokr RC2 Stabilization Sprint — 2026-07-04*
