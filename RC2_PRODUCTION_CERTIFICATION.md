# HaulBrokr RC2 — Production Hardening Certification

**Certification date:** 2026-07-14  
**Branch:** `cursor/rc2-production-hardening-63c0`  
**Scope:** Eliminate production risk — no new product features  
**Automated gate:** `pnpm --filter @workspace/api-server test` + `node scripts/rc2-certify.mjs`

---

## Production readiness recommendation

### **LIMITED BETA**

RC2 automated hardening passes for implemented production workflows, security fixes landed, and failure paths degrade gracefully. Public launch is blocked by App Store account-deletion gaps, absence of recurring-haul execution, no live FMCSA API, and live Clerk/Stripe/R2 credential E2E that must still be run in staging.

| Option | Decision |
|--------|----------|
| NO GO | No — core marketplace, payments, field ops, and org isolation are certified in automation |
| **LIMITED BETA** | **Yes — recommended** |
| OPEN BETA | No — App Store deletion + live payment/webhook staging runs still open |
| PUBLIC LAUNCH | No — blockers below remain |

---

## Phase 1 — End-to-end workflow automation

| # | Workflow | Result | Evidence |
|---|----------|--------|----------|
| 1 | Carrier onboarding | **PASS** | `rc2-workflows.test.ts` — `POST /profiles` provider creates org + invite code |
| 2 | Customer onboarding | **PASS** | `rc2-workflows.test.ts` — customer org created |
| 3 | Driver onboarding | **PASS** | `rc2-workflows.test.ts` — join via invite code |
| 4 | Dispatcher workflow | **PASS** | Assign + `/dispatch/overview`; org isolation hardened |
| 5 | DOT/FMCSA verification | **WARN** | Staff-gated verify works; **no live FMCSA API** (manual review only) |
| 6 | Organization invitations | **PASS** | Invite codes + `POST /organizations/rotate-code` |
| 7 | Job creation | **PASS** | Bid award creates job (`award-flow` + RC2 workflows) |
| 8 | Job assignment | **PASS** | `POST /jobs/:id/assign` |
| 9 | Driver check-in | **PASS** | `POST /tickets/:id/clock-in` + driver-events |
| 10 | Driver check-out | **PASS** | `POST /tickets/:id/clock-out` |
| 11 | Photo uploads | **PASS** | Storage request-url + evidence; content-type allowlist added |
| 12 | Load ticket uploads | **PASS** | `POST /jobs/:id/tickets` |
| 13 | Scale ticket uploads | **PASS** | Driver-event pickup requires `scale_ticket` |
| 14 | Proof of delivery | **PASS** | Delivery event requires material + signature files |
| 15 | Invoice generation | **PASS** | `GET /jobs/:id/invoice` + `job-invoice.test.ts` |
| 16 | Stripe payment | **PASS** | Checkout/charge paths covered in `jobs.test.ts` + RC2 |
| 17 | Stripe webhook processing | **PASS** | Idempotent finalize; unsigned rejected |
| 18 | Notification delivery | **PASS** | Register + feed; push failures never throw |
| 19 | Recurring haul execution | **FAIL** | **Not implemented** — no scheduler/API |

**Phase 1 summary:** 16 PASS · 1 WARN · 1 FAIL · (dispatcher counted PASS after isolation fix)

Complementary real-DB gate: `company-flow.test.ts` (`pnpm --filter @workspace/api-server test:integration` when `DATABASE_URL` available).  
Staging infra smoke: `pnpm run verify:staging-e2e`.

---

## Phase 2 — Failure testing

| Scenario | Result | Behavior certified |
|----------|--------|-------------------|
| Stripe timeout | **PASS** | Verify-checkout returns 502; payment **not** marked failed (`jobs.test.ts`) |
| Stripe duplicate webhook | **PASS** | Second event → `already_finalized` / no corruption |
| FMCSA unavailable | **WARN** | No live client; cannot auto-verify on outage (manual staff only) |
| Supabase unavailable | **WARN** | N/A — Neon/Postgres via Drizzle; DB down → `/readyz` 503, `/healthz` 200 |
| Redis unavailable | **WARN** | Redis not used; in-memory rate limits (single-instance only — see blockers) |
| OpenAI unavailable | **PASS** | Copilot is rule-based; no LLM dependency |
| Push notification failure | **PASS** | Expo errors logged; never throw |
| SMS failure | **WARN** | No SMS backend — mobile toggle only |
| Email failure | **PASS** | Best-effort Resend; staff flows not aborted by push/email helpers |
| Slow internet | **WARN** | Server-side validation OK; client retry UX needs device verification |
| Offline mobile | **WARN** | No offline sync certified |
| GPS unavailable | **PASS** | Check-in without GPS → 422; no partial corrupt event |

**No process crashes observed in automated failure suite.**  
**No payment-state corruption on duplicate/timeout paths.**

---

## Phase 3 — Security

| Control | Result | Notes |
|---------|--------|-------|
| Authentication | **PASS** | Clerk `requireAuth` / `requireProfile` on marketplace routes |
| Authorization | **PASS** | Role + staff permission checks; assign restricted to org managers |
| Organization isolation | **PASS** | **Fixed in RC2:** `/dispatch/overview` no longer leaks cross-org jobs to supervisors |
| Rate limiting | **PASS** | Global 120/min + upload 10/15min; 429 under burst |
| SQL injection | **PASS** | Drizzle parameterized access; audit found no `req.*` string SQL |
| XSS | **PASS** | JSON APIs + security headers (`nosniff`, `DENY` frame) |
| CSRF | **PASS** | Cookie staff auth + CORS allowlist; Stripe raw-body before JSON |
| File upload validation | **PASS** | **Hardened in RC2:** allowlist jpeg/png/webp/heic/gif/pdf; HMAC single-use tokens |
| Secret exposure | **PASS** | No live Stripe/Clerk secrets in source scan |
| Logging | **PASS** | pino redacts to method/url/status; errors generic to clients |

### Security fixes shipped in this RC2 branch

1. **Dispatch board org isolation** — query-time filter via `orgScopedActorIds` / staff-only global view (`tracking.ts`).
2. **Upload content-type allowlist** — reject HTML/JS/executables at `request-url` (`storage.ts`).

---

## Phase 4 — Performance

| Surface | Result | Notes |
|---------|--------|-------|
| API latency (health/ready) | **PASS** | healthz/readyz ~120–300ms against production in RC2 audit |
| Page load | **PASS** | Homepage ~138ms TTFB in RC2 audit (full Lighthouse still recommended) |
| Dashboard load | **WARN** | Auth-gated; staging session required for full render timing |
| Dispatch board | **PASS** | SQL-scoped active jobs (RC2 optimization); auth gate ~100ms |
| Maps | **WARN** | Marketplace endpoint auth-gated; runtime key loader present |
| FMCSA lookup | **WARN** | Manual staff path — not a network lookup |
| Stripe checkout | **WARN** | Needs authenticated staging penny test |
| Stripe webhook reject | **PASS** | Unsigned payload rejected (HTTP 400) |
| Supabase queries | **WARN** | N/A — Neon/Drizzle |

---

## Phase 5 — Mobile

| Check | Result |
|-------|--------|
| iPhone SE / 15 / 17 / iPad matrix | **WARN** — static audit only; run EAS/TestFlight device QA |
| Portrait | **PASS** — default orientation |
| Landscape | **WARN** — portrait-locked in `app.json` |
| Backgrounding | **WARN** — device verification required |
| Push notifications | **WARN** — code path PASS; Expo credentials operator-owned |
| Deep links | **PASS** — `haulbrokr` scheme + applinks domains |
| Location permissions | **PASS** — usage strings + plugin |
| Offline mode | **WARN** — not certified |

---

## Phase 6 — App Store

| Check | Result |
|-------|--------|
| No demo data in signed-in paths | **PASS** (prior live-no-demo audit + RC2 static scan) |
| No placeholder UI | **PASS** / **WARN** for QuickBooks “coming soon” (documented) |
| Privacy policy | **PASS** |
| Terms | **PASS** |
| Delete account | **FAIL** — email-only (`privacy@haulbrokr.com`); **no in-app deletion** |
| Export account | **FAIL** — no dedicated export UI/API |
| Notification permissions | **PASS** |
| Location permissions | **PASS** |
| Camera permissions | **PASS** |
| Photo permissions | **PASS** |

---

## Remaining blockers

1. **In-app Delete Account + data export** (App Store Guideline 5.1.1) — **FAIL**
2. **Recurring haul execution** — not implemented — **FAIL** for that workflow claim
3. **Live staging E2E with Clerk + Stripe + R2 + Resend** — operator run still required (`POST_LAUNCH_CHECKLIST.md`)
4. **Horizontal scale:** upload-token replay + rate limits are in-memory (single Render instance only)
5. **Live FMCSA API** — not built; DOT verify is staff-manual (**WARN**)
6. **SMS** — UI toggle without backend (**WARN**)
7. **Device matrix / landscape / offline** — not executed on hardware in this environment (**WARN**)

---

## How to re-run certification

```bash
# Automated RC2 suites + audits
node scripts/rc2-certify.mjs

# Or individually:
pnpm --filter @workspace/api-server test
node scripts/rc2-app-store-audit.mjs
node scripts/rc2-performance-audit.mjs
pnpm run verify:staging-e2e
```

RC2 test files:

- `artifacts/api-server/src/routes/rc2-workflows.test.ts`
- `artifacts/api-server/src/routes/rc2-failure-resilience.test.ts`
- `artifacts/api-server/src/routes/rc2-security-audit.test.ts`
- `artifacts/api-server/src/routes/rc2-dispatch-isolation.test.ts`

---

## Verdict

**LIMITED BETA** — safe for a controlled cohort with staff-operated compliance and single-instance API, after staging credential E2E.  
**Not ready for PUBLIC LAUNCH / OPEN BETA** until App Store deletion/export and live payment webhook certification complete. Recurring hauls must not be marketed.
