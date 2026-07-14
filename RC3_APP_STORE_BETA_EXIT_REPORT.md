# RC3 — App Store & Beta Exit Report

**Branch:** `cursor/rc3-app-store-beta-exit-8652`  
**Date:** 2026-07-14  
**Prior recommendation (RC2):** LIMITED BETA  
**Final recommendation:** **LIMITED BETA**

---

## Files changed (high level)

### Schema / DB (`lib/db`)

- `src/schema/account-deletion.ts` — deletion requests + secure audit
- `src/schema/data-exports.ts` — export request lifecycle
- `src/schema/recurring-schedules.ts` — schedules + generation history
- `src/schema/requests.ts` — `review_required` status + `recurringScheduleId`
- `src/schema/dot-cdl.ts` — FMCSA source / lookup fields
- `src/schema/index.ts` — exports

### API (`artifacts/api-server`)

- `src/lib/deleteAccount.ts` (+ tests) — full deletion workflow
- `src/lib/dataExport.ts` (+ tests) — ZIP export to private R2
- `src/lib/recurringHauls.ts` (+ tests) — timezone-aware generation worker
- `src/lib/recurringHaulScheduler.ts` — in-process hourly scheduler
- `src/lib/fmcsa/*` — live QCMobile + manual review providers (+ contract tests)
- `src/routes/account-privacy.ts` (+ tests) — deletion + export APIs
- `src/routes/recurring.ts` — schedule CRUD / pause / resume / cancel
- `src/routes/workers.ts` — secured worker endpoints
- `src/routes/account.ts` — compliance submit uses FMCSA lookup
- `src/routes/organizations.ts` — ownership transfer
- `src/routes/health.ts` — `/readyz/details` FMCSA informational status
- `src/lib/startupMigrations.ts` — RC3 tables/enums on boot
- RC2 certification test suite brought forward

### Web / Mobile UI

- Web: Account → **Privacy & Account** (Delete Account + Export Account Data)
- Web: `/recurring` recurring haul configuration page
- Mobile: Account → Privacy & Account (Delete Account + Export Account Data)
- Privacy policy copy updated (web + mobile)

### Tooling / docs

- `pnpm certify:staging` → `scripts/certify-staging.mjs`
- `pnpm verify:rc2` (+ app-store / performance audits)
- `APP_STORE_REVIEW_GUIDE.md`
- `docs/FMCSA_OPERATOR_CHECKLIST.md`
- `.env.example`, `render.yaml`, OpenAPI paths

---

## Migrations added

Idempotent startup migrations (no separate SQL migration folder — matches repo pattern):

- Enums: `account_deletion_status`, `data_export_status`, `recurrence_type`, `recurring_schedule_status`, `recurring_holiday_behavior`, `recurring_generation_status`, `request_status.review_required`
- Tables: `account_deletion_requests`, `account_deletion_audit`, `data_export_requests`, `recurring_schedules`, `recurring_generation_runs`
- Columns: `requests.recurring_schedule_id`, `dot_cdl_compliance.fmcsa_source|fmcsa_lookup_fields|fmcsa_lookup_error`

Also continue to sync via `pnpm --filter @workspace/db run push` for Drizzle schema.

---

## APIs added

| Method   | Path                                                 | Purpose                                            |
| -------- | ---------------------------------------------------- | -------------------------------------------------- |
| GET      | `/api/account/deletion/preview`                      | What is deleted vs retained                        |
| GET/POST | `/api/account/deletion`                              | Status / confirm deletion (`DELETE` + recent auth) |
| POST     | `/api/account/deletion/resume`                       | Resume failed deletion                             |
| DELETE   | `/api/profiles/me`                                   | Legacy path (`X-Confirm-Delete: DELETE`)           |
| POST/GET | `/api/account/export`                                | Request / list exports                             |
| GET      | `/api/account/export/:id`                            | Export status                                      |
| GET      | `/api/account/export/:id/download`                   | Signed expiring URL                                |
| CRUD     | `/api/recurring-schedules`                           | Recurring haul config                              |
| POST     | `/api/recurring-schedules/:id/{pause,resume,cancel}` | Lifecycle                                          |
| POST     | `/api/organizations/transfer-ownership`              | Owner safety before deletion                       |
| POST     | `/api/workers/recurring-hauls`                       | Secured worker (`x-automation-key`)                |
| POST     | `/api/workers/expire-exports`                        | Export TTL cleanup                                 |
| GET      | `/api/workers/fmcsa-status`                          | Operator FMCSA health                              |
| GET      | `/api/readyz/details`                                | Non-blocking readiness incl. FMCSA                 |

---

## UI paths added

| Surface | Path                                                                   |
| ------- | ---------------------------------------------------------------------- |
| Web     | Account Settings → **Privacy & Account**                               |
| Web     | **/recurring** (nav: Recurring for customers)                          |
| Mobile  | Account → **Privacy & Account** → Delete Account / Export Account Data |

---

## Account deletion behavior

1. Preview lists deleted vs legally retained categories.
2. Requires confirmation phrase `DELETE` + recent auth (`session iat` &lt; 10m or `X-Reauth-Confirmed`).
3. Sole org owners with other members are **blocked** until ownership transfer.
4. Removes device tokens, personal submissions, bids, owned trucks, export archives, recurring schedules; cancels invite codes for sole-owner orgs.
5. Anonymizes profile row (preserves FK integrity for financial/job history).
6. Deletes Clerk identity (sessions/tokens revoked; no orphaned sign-in).
7. Writes secure audit event (hashed clerk id only).
8. Supports dry-run and resumable failed state.
9. Credentials never exposed to client.

---

## Data export behavior

1. Authenticated user requests export → status `requested` → `processing` → `ready` / `failed` / `expired`.
2. Bundle includes profile, memberships, trucks, job history, assignments, document metadata, invoices/payments, notification prefs, recurring jobs, user-visible audit events.
3. Redacts secrets, tokens, admin notes, Stripe IDs, other-org data.
4. ZIP (JSON + CSV) stored under private R2 prefix; download via signed URL (15 min).
5. 7-day expiry + cleanup worker; in-app notification when ready.
6. Authorization tests ensure export IDs from other profiles 404.

---

## Recurring execution behavior

1. Active schedules materialize future `requests` within horizon (default 14 days).
2. Supports daily / weekly / monthly / custom; IANA timezone-aware dates.
3. Idempotency key `recurring:{scheduleId}:{YYYY-MM-DD}` prevents duplicates.
4. Respects start/end, pause/resume/cancel, skip dates, holiday skip/next-business-day.
5. Copies template fields only — never driver assignment, tickets, POD, invoice, payment.
6. Invalid/missing locations → `review_required` (not silent fail).
7. Records `recurring_schedule_id` + generation history; retries failed runs; dead-letters to `error` after 5 consecutive failures.
8. Secured worker endpoint + in-process hourly scheduler; metrics without PII.

---

## FMCSA provider status

| Mode           | Status                                                                              |
| -------------- | ----------------------------------------------------------------------------------- |
| Live QCMobile  | Implemented behind `FMCSA_WEB_KEY`; timeouts, retries, cache, structured errors     |
| Manual review  | Default fallback; staff `PATCH /account/compliance/verify` preserved                |
| Auto-verify    | Only when live response is complete and positive — never on partial                 |
| Startup        | Missing/unavailable FMCSA does **not** block boot; `/readyz/details` reports health |
| Live exercise  | **EXTERNAL BLOCKER** — credential not configured in this environment                |
| Operator guide | `docs/FMCSA_OPERATOR_CHECKLIST.md`                                                  |

---

## Staging certification results

Command: `pnpm certify:staging` (against current production hosts; RC3 not yet deployed)

| Category                                                                                                     | Result                                                                         |
| ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| API healthz / readyz / web                                                                                   | **PASS**                                                                       |
| Auth gates for existing routes                                                                               | **PASS**                                                                       |
| RC3 routes (`/account/export`, `/account/deletion`, `/recurring-schedules`, `/workers/*`, `/readyz/details`) | **WARN** — HTTP 404 until RC3 API deploy                                       |
| Local api-server unit tests                                                                                  | **PASS** (419)                                                                 |
| Authenticated Clerk/Stripe/R2 E2E                                                                            | **WARN** — requires `STAGING_CLERK_SESSION_TOKEN` + staging secrets (operator) |
| FMCSA live                                                                                                   | **WARN / EXTERNAL BLOCKER** — `FMCSA_WEB_KEY` unset                            |
| Overall certify summary                                                                                      | **8 PASS / 30 WARN / 0 FAIL** (exit 0)                                         |

Secrets are never printed.

---

## Test counts and exact command outcomes

| Command                                    | Outcome                                                                                         |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| `pnpm typecheck`                           | **PASS**                                                                                        |
| `pnpm --filter @workspace/api-server test` | **PASS** — 42 files / **419** tests                                                             |
| `pnpm verify:rc2`                          | **PASS** — unitTests PASS, appStoreAudit PASS, performanceAudit PASS                            |
| `pnpm test`                                | **PASS** (aliases api-server test)                                                              |
| `pnpm build`                               | **PASS**                                                                                        |
| Touched-file Prettier check                | **PASS** after `prettier --write` on RC3 files                                                  |
| Repo-wide `pnpm lint`                      | Not claimed — pre-existing formatting elsewhere may still fail                                  |
| `pnpm certify:staging`                     | **PASS** infrastructure + local tests; remaining items WARN pending deploy/operator credentials |

New RC3-focused tests include: account deletion (owner block, dry-run, anonymize+Clerk), account-privacy routes (confirmation, isolation), recurring (daily/weekly/monthly/DST/duplicates/pause/cancel/expired/invalid/retry/holidays), FMCSA contract fixtures, data-export module surface.

---

## Remaining external configuration

1. Deploy RC3 API so new routes exist on Render.
2. Set staging/prod: `AUTOMATION_KEY` / `CRON_SECRET`, `FMCSA_WEB_KEY`, R2 vars.
3. Operator-run authenticated staging flows with `STAGING_CLERK_SESSION_TOKEN` (Clerk signup/login, org/carrier/customer/driver onboarding, R2 upload types, Stripe Connect/Checkout test mode, webhook → DB invoice update).
4. Fill `TODO_BEFORE_SUBMISSION` placeholders in `APP_STORE_REVIEW_GUIDE.md`.
5. Expo push credentials in EAS for notification delivery.

---

## App Store readiness

| Item                                    | Status                                     |
| --------------------------------------- | ------------------------------------------ |
| In-app Delete Account discoverability   | **Ready** (web + mobile)                   |
| In-app data export discoverability      | **Ready** (web + mobile)                   |
| Privacy / Terms links                   | **Ready**                                  |
| Location / camera / photo usage strings | **Ready** (`app.json`)                     |
| Push permission timing                  | **Ready** (post sign-in registration)      |
| Sign in with Apple                      | Present (existing); no bypass              |
| Reviewer guide                          | `APP_STORE_REVIEW_GUIDE.md` — contacts TBD |
| Dead / coming-soon core controls        | No new placeholders introduced             |

---

## Beta readiness

**LIMITED BETA** remains appropriate:

- Code-controlled RC3 blockers implemented and unit-tested
- Live staging E2E against Clerk/Stripe/R2 still operator-owned
- FMCSA live credential is an external blocker (manual fallback safe)
- RC3 routes must be deployed before store submission exercises deletion/export against staging

---

## Production readiness percentage

**~78%** (up from RC2 ~70% code-controlled baseline)

Gains: account deletion, data export, recurring execution, FMCSA abstraction, App Store discoverability, certification tooling.  
Remaining: live staging certification, FMCSA credential, reviewer contact fill-in, deploy + re-run `pnpm certify:staging`.

---

## Final recommendation

### **LIMITED BETA**

Not **OPEN BETA** / **PUBLIC LAUNCH** because:

- Critical staging workflows still require operator execution against real staging services
- Stripe test webhook → DB and R2 upload/download not certified with live credentials in this environment
- FMCSA live access not configured (manual fallback only)
- RC3 endpoints not yet deployed to the staging/production API host at certification time

After deploy + successful `pnpm certify:staging` authenticated PASS lines + FMCSA key (or accepted manual-only policy) + filled App Review contacts → re-evaluate for **OPEN BETA**.
