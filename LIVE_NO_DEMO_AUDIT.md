# HaulBrokr Live / No-Demo Production Audit

**Audit date:** 2026-07-09  
**Branch:** `cursor/live-no-demo-audit-1acd`  
**Scope:** `artifacts/api-server`, `artifacts/haulbrokr`, `artifacts/haulbrokr-mobile`, `scripts`, `docs`, `.github/workflows`, env examples, migrations

---

## Executive summary

| Check | Result |
|-------|--------|
| Demo marketplace served to users | **PASS** — API returns live DB data or empty payload (`demoMode: false`) |
| Mock Stripe in production | **PASS (after fix)** — `NODE_ENV=production` now fails closed; startup validation rejects `PAYMENTS_MOCK_MODE` |
| Mobile uses production API domain | **PASS (after fix)** — `EXPO_PUBLIC_DOMAIN` required; localhost fallback removed |
| Web uses production API domain | **PASS** — Vercel rewrites `/api/*` → `https://haulbrokr-api.onrender.com/api/*` |
| Backend rejects missing prod env | **PASS (after fix)** — `validateProductionEnv()` now includes `GOOGLE_MAPS_API_KEY` |
| Exposed secrets in source | **PASS** — no live keys; only CI placeholders and `.env.example` templates |
| DumpBroker branding in user copy | **PASS (after fix)** — `DB-` invite prefix and `db:` QR tokens renamed to `HB-` / `hb:` |
| `pnpm typecheck` | **PASS** |
| `pnpm -r --if-present test` | **PASS** (441 tests) |
| `pnpm build` | **PASS** |

### Production decision: **GO** (codebase)

The repository is structurally production-ready: no user-facing demo routes, no synthetic marketplace fallback in the map API, and env/payment guardrails fail closed on Render/Vercel paths.

**Operator GO** still requires live credentials on Render/Vercel/EAS and manual E2E per `POST_LAUNCH_CHECKLIST.md` (Stripe webhooks, Clerk prod keys, R2, Resend, Google Maps billing). QuickBooks remains intentionally simulated — do not market live sync.

---

## Issues found (full inventory)

### Production blockers — fixed in this audit

| # | Issue | Classification | Resolution |
|---|-------|----------------|------------|
| 1 | `stripeClient.ts` used `REPLIT_DEPLOYMENT=1` for fail-closed mock rejection; Render production (`NODE_ENV=production`) could silently fall back to mock Stripe | Production blocker | Use `isProductionRuntime()` (`NODE_ENV === "production"`) and throw when mock would be used |
| 2 | `payment-method.tsx` defaulted `EXPO_PUBLIC_DOMAIN` to `localhost:8080` | Production blocker | Removed localhost fallback; show error if domain unset |
| 3 | `useLiveApi.ts` built API URL as `https://undefined/api` when domain missing | Production blocker | Centralized `lib/apiConfig.ts`; throws on invalid/missing domain |
| 4 | `GOOGLE_MAPS_API_KEY` not validated at API startup in production | Production blocker | Added to `validateProductionEnv.ts` and `render.yaml` |
| 5 | Stale DumpBroker invite prefix `DB-` and local QR token prefix `db:` in `AppContext.tsx` | Stale branding | Renamed to `HB-` and `hb:` (local-only demo path; signed-in users use server QR) |
| 6 | Ticket scan placeholder showed `db:1:lt1:...` | Stale branding | Replaced with neutral copy |

### User-facing demo / placeholder — acceptable or documented

| Path / item | Classification | Disposition |
|-------------|----------------|-------------|
| `artifacts/haulbrokr/src/pages/integrations.tsx` — QuickBooks "Coming Soon" | User-facing limitation | **Retained** — matches `KNOWN_ISSUES.md`; backend is simulated OAuth |
| `artifacts/haulbrokr/src/pages/landing.tsx` — "QuickBooks coming soon" in Enterprise tier | User-facing limitation | **Retained** — honest product copy |
| `artifacts/haulbrokr-mobile/app/team.tsx` — "Demo" pill when unsigned | Safe internal / preview | **Retained** — signed-in users always use live org API |
| `artifacts/haulbrokr-mobile/app/tracking/[id].tsx`, `invoice/[id].tsx` — fallback to local `AppContext` jobs when unsigned | Safe internal | **Retained** — signed-in flows use live API only |
| UI form `placeholder=` attributes (web + mobile) | Not demo data | **Retained** — standard form hints |
| `material_type` enum value `demolition` | Domain vocabulary | **Retained** — not demo content |
| `bin_orders` `temporary` service type | Domain vocabulary | **Retained** |

### Safe internal test / dev only — intentionally retained

| Path | Purpose |
|------|---------|
| `artifacts/api-server/src/lib/demoMarketplace.ts` | `buildDemoMarketplace()` for seeds/tests only; **never** called by `/api/map/marketplace` |
| `artifacts/api-server/src/lib/mockStripeClient.ts` | Dev/CI mock when `PAYMENTS_MOCK_MODE=true` and `NODE_ENV !== production` |
| `artifacts/api-server/scripts/seed-*.ts` | Operator seed scripts (Apple review, staff, marketplace) |
| `artifacts/api-server/scripts/audit-production-data.ts` | Read-only prod DB audit for synthetic rows |
| `docker-compose.yml` `PAYMENTS_MOCK_MODE=true` | Local compose only |
| `.github/workflows/ci.yml` placeholders + `PAYMENTS_MOCK_MODE=true` | CI test fixtures |
| `artifacts/mockup-sandbox/` | Design sandbox — **not deployed** to production |
| `artifacts/haulbrokr-deck/`, `artifacts/haulbrokr-promo/` | Marketing decks — **not deployed** |
| All `*.test.ts` / `vi.mock` / `mockStripe*` in test files | Automated test fixtures |
| `artifacts/haulbrokr/scripts/prerender.ts` localhost stubs | SSR build-time only |

### Non-production artifacts — flagged, not removed

| Artifact | Risk if deployed | Action |
|----------|------------------|--------|
| `artifacts/mockup-sandbox` | UI mockup registry | Do not deploy; not in Vercel/Render blueprints |
| `artifacts/haulbrokr-deck` | Slide deck with `haulbrokr.com/demo` CTA copy | Internal sales only |
| `artifacts/haulbrokr-promo` | Promo video scaffold | Internal marketing only |

### No demo routes exposed in production

Route audit (`artifacts/api-server/src/routes/index.ts` + `app.ts`):

- **No** `/demo`, `/mock`, or `/sandbox` HTTP handlers
- Map: `GET /api/map/marketplace` → live DB or `buildEmptyMarketplace()` (`demoMode: false`)
- QuickBooks: simulated connect/sync **stores DB rows** but does not call Intuit — documented limitation
- Admin compliance `PATCH /account/compliance/verify` — real staff-gated route (OpenAPI label says "admin/demo" historically; not a demo endpoint)
- Auth: Clerk on all marketplace/job/payment routes except health, automation (key-gated), map config, dump-sites, stripe webhooks

### Domain / API wiring

| Surface | Production target | Verified |
|---------|---------------------|----------|
| Web (`vercel.json`, `artifacts/haulbrokr/vercel.json`) | `haulbrokr.com` → API proxy `haulbrokr-api.onrender.com` | Yes |
| Mobile `EXPO_PUBLIC_DOMAIN` | `haulbrokr.com` (see `.env.example`, EAS secrets) | Yes — enforced in `_layout.tsx` |
| API CORS defaults | `haulbrokr.com`, `www.haulbrokr.com`, `haulbrokr.vercel.app` | Yes (`app.ts`) |
| Render blueprint | `haulbrokr-api` @ `NODE_ENV=production` | Yes (`render.yaml`) |

### Secrets scan

| Finding | Severity |
|---------|----------|
| No `sk_live_*`, `pk_live_*`, `whsec_*`, or `re_*` committed | OK |
| CI uses `sk_test_ci_placeholder` / `pk_test_ci_placeholder` | OK — test only |
| `docker-compose.yml` `sk_test_placeholder` defaults | OK — local dev |
| `mockStripeClient.ts` `pk_test_mock_haulbrokr_no_stripe_connected` | OK — unreachable in production after validation + fail-closed |
| No `curl-test-key`, `YOUR_REAL_PASSWORD`, or `dumpbroker` strings in source | OK |

### Migrations

No `migrations/` SQL directory. Schema is applied via `drizzle-kit push` (`lib/db`). Startup migrations in `startupMigrations.ts` run in production boot.

### Feature live-readiness

| Feature | Live-ready? | Notes |
|---------|-------------|-------|
| Map / geocoding | **Yes** (with `GOOGLE_MAPS_API_KEY`) | Empty map when no loads; no synthetic fallback |
| Auth (Clerk) | **Yes** | Web proxy + mobile bearer JWT |
| Jobs / marketplace / bids | **Yes** | Real Postgres |
| Payments (Stripe) | **Yes** | Env required; mock blocked in prod |
| Uploads (R2) | **Yes** | Env required |
| Notifications (Expo push) | **Yes** (API) | EAS push credentials needed for delivery |
| QuickBooks | **No** | Simulated — UI labels "coming soon" |
| FMCSA live verify | **Partial** | Staff manual verify; no live FMCSA API |

---

## Files changed in this audit

| File | Change |
|------|--------|
| `artifacts/api-server/src/lib/stripeClient.ts` | Fail-closed mock rejection uses `NODE_ENV=production` |
| `artifacts/api-server/src/lib/validateProductionEnv.ts` | Require `GOOGLE_MAPS_API_KEY` in production |
| `artifacts/api-server/src/lib/validateProductionEnv.test.ts` | Fixture includes maps key |
| `artifacts/haulbrokr-mobile/lib/apiConfig.ts` | **New** — shared domain/API base URL validation |
| `artifacts/haulbrokr-mobile/hooks/useLiveApi.ts` | Use `getApiBaseUrl()` |
| `artifacts/haulbrokr-mobile/hooks/usePushNotifications.ts` | Use `getApiBaseUrlOrNull()` |
| `artifacts/haulbrokr-mobile/lib/googleMapsKey.ts` | Use `getExpoPublicDomain()` |
| `artifacts/haulbrokr-mobile/app/_layout.tsx` | Block boot on missing/invalid `EXPO_PUBLIC_DOMAIN` |
| `artifacts/haulbrokr-mobile/app/payment-method.tsx` | Remove localhost default |
| `artifacts/haulbrokr-mobile/app/ticket/scan.tsx` | Neutral QR placeholder |
| `artifacts/haulbrokr-mobile/context/AppContext.tsx` | `HB-` invite prefix; `hb:` local QR prefix |
| `.env.example` | Document maps key production requirement |
| `render.yaml` | Add `GOOGLE_MAPS_API_KEY` env slot |
| `LIVE_NO_DEMO_AUDIT.md` | This report |

---

## What was removed

- Mobile payment screen **localhost:8080** fallback for card setup URL
- Implicit **undefined** API host in mobile fetch layer (now fails fast)
- **DumpBroker-era** `DB-` / `db:` prefixes in local-only mobile context helpers
- **Misleading** ticket scan placeholder showing legacy `db:` token format

Nothing was removed from CI test mocks, seed scripts, or `demoMarketplace.ts` test helpers.

---

## Verification commands (re-run)

```bash
pnpm typecheck
pnpm -r --if-present test
pnpm build
```

All passed on 2026-07-09.

---

## Pre-launch operator checklist (outside repo)

1. Render: set all vars in `validateProductionEnv.ts` including **`GOOGLE_MAPS_API_KEY`**; confirm **`PAYMENTS_MOCK_MODE` unset**
2. Vercel: `VITE_CLERK_PUBLISHABLE_KEY`, `VITE_CLERK_PROXY_URL`
3. EAS: `EXPO_PUBLIC_DOMAIN=haulbrokr.com`, `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...`
4. Run `pnpm run verify:deployment` with real `.env`
5. Complete `POST_LAUNCH_CHECKLIST.md` E2E on staging then production
6. Run `audit-production-data.ts` against prod DB to confirm no seeded demo rows

---

## Production GO / NO-GO

| Layer | Decision |
|-------|----------|
| **Codebase / repo** | **GO** |
| **Deployed production** | **GO** once operator checklist + E2E complete (not verifiable in this workspace without live secrets) |
