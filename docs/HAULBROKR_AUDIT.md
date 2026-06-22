# HaulBrokr — Codebase Audit & Launch Guide

Generated: June 2026. See also `MIGRATION_TO_CURSOR.md` and `DEVELOPER_HANDOFF.md`.

## Production Readiness Score: **58 / 100** (after Phase 1 fixes)

| Category | Score | Notes |
|----------|-------|-------|
| Core marketplace | 75 | Web + mobile bidding/completion flows improved |
| Auth | 85 | Clerk integrated; set `ADMIN_USER_IDS` in prod |
| Payments | 60 | Stripe env vars supported off Replit |
| Mobile | 55 | Fleet registration, open loads, dump sites API |
| API docs | 50 | ~35 routes still missing from OpenAPI |
| Database | 60 | Push-only schema — add migrations before scale |
| Security | 65 | Factoring auth fixed |
| Testing | 45 | CRUD routes need tests |
| Deployment | 40 | Verify healthchecks on target host |
| Store readiness | 60 | EAS + ASC configured |

---

## 1. Architecture

pnpm monorepo: `artifacts/` (api-server, haulbrokr web, haulbrokr-mobile, deck, promo, mockup-sandbox) + `lib/` (db, api-spec, api-zod, api-client-react).

**Stack:** Express 5, Drizzle/PostgreSQL, React 19/Vite, Expo SDK 54, Clerk, Stripe Connect, Resend.

**Contract pipeline:** `lib/api-spec/openapi.yaml` → Orval → Zod (server) + React Query (web). Mobile primarily uses `hooks/useLiveApi.ts`.

---

## 2. Database (26 tables)

Schema: `lib/db/src/schema/`. Apply with `pnpm --filter @workspace/db run push`.

Hub table: `profiles` (links `clerk_id` to roles). Marketplace: `requests` → `bids` → `jobs` → `tickets`, `delivery_evidence`, payments on `jobs`.

No versioned SQL migrations exist — use `drizzle-kit push` only.

---

## 3. API

Base path: `/api`. OpenAPI documents 88 operations; ~35 implemented routes are undocumented (tickets, storage, driver-docs, projects CRUD, factoring, quickbooks, bin-orders customer routes).

Health: `GET /api/healthz` (no auth).

---

## 4. Authentication

100% Clerk — no local auth tables. Web: session cookies + Clerk proxy at `/api/__clerk`. Mobile: Bearer JWT via `@clerk/expo`.

Middleware: `requireAuth` → `requireProfile` → `requirePermission` / `requireAdmin`.

Staff RBAC via `profiles.staff_role` + `ADMIN_USER_IDS` bootstrap.

---

## 5. Missing Features (remaining)

- QuickBooks real integration (simulated)
- FMCSA live API verification
- Mobile map tab / live GPS
- Procore, Sage 300, Relay Payments
- Full OpenAPI coverage + mobile codegen alignment
- Versioned DB migrations
- Mobile in-app card vault (use Checkout or web account)
- Launch promo video

---

## 6. Bugs Fixed in This Pass

- Factoring approval now requires `credit` staff permission
- Global Express error handler added
- Provider load board shows open/bidding requests
- Dump sites use live API on mobile
- Stripe/Resend support direct env vars off Replit

---

## 7. Technical Debt

- Hand-written `useLiveApi.ts` vs generated client drift
- Soft FKs on `organizations` / `profiles.organization_id`
- `bin_orders.customer_id` is text, not FK
- Replit object storage sidecar for uploads
- Consistent `haulbrokr` naming across packages, folders, and mobile bundle ID

---

## 8. Launch Plan

### Phase 0 — Environment (Week 1)

1. `pnpm install`
2. Provision PostgreSQL, Clerk app, Stripe (Connect), GCS/S3, Resend
3. Copy `.env.example` → `.env`
4. `pnpm --filter @workspace/db run push`
5. Set `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`

### Phase 1 — Backend (Weeks 2–3)

1. Deploy API (`node artifacts/api-server/dist/index.mjs`)
2. Set `ADMIN_USER_IDS`, verify `PAYMENTS_MOCK_MODE` is unset in prod
3. Health probe on `/api/healthz`
4. Add tests for profiles/trucks/requests/bids

### Phase 2 — Web (Week 3)

1. Build: `pnpm --filter @workspace/haulbrokr run build`
2. Deploy static `dist/` to CDN
3. `VITE_CLERK_PROXY_URL=/api/__clerk`

### Phase 3 — iOS (Weeks 4–6)

1. `EXPO_PUBLIC_DOMAIN` = production API host
2. `eas build --platform ios --profile production`
3. TestFlight → `eas submit --platform ios`

### Phase 4 — Android (Weeks 5–7)

1. Google Maps API key in `app.json`
2. `eas build --platform android --profile production`
3. Play Store submit

### Phase 5 — Mobile Web (Week 6)

1. `pnpm --filter @workspace/haulbrokr-mobile run build`
2. Serve at `/mobile/` or subdomain

### Phase 6 — QA (Week 7)

End-to-end: post load → bid → accept → assign → clock in/out → complete → charge → payout.

### Phase 7 — Launch (Week 8)

Enable live Stripe webhooks, monitoring, App Store + Play release.

---

## Environment Variables (quick reference)

| Variable | Required | Purpose |
|----------|----------|---------|
| `DATABASE_URL` | yes | PostgreSQL |
| `CLERK_SECRET_KEY` | yes | API auth |
| `CLERK_PUBLISHABLE_KEY` | yes | Clerk proxy |
| `STRIPE_SECRET_KEY` | prod | Payments off Replit |
| `STRIPE_PUBLISHABLE_KEY` | prod | Client Stripe.js |
| `RESEND_API_KEY` | optional | Review emails |
| `RESEND_FROM_EMAIL` | optional | Email from address |
| `UPLOAD_TOKEN_SECRET` | yes | Upload tokens |
| `TICKET_QR_SECRET` | yes | QR tickets |
| `ADMIN_USER_IDS` | prod | Admin bootstrap |
| `EXPO_PUBLIC_DOMAIN` | mobile | API host |
