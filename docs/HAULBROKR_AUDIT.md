# HaulBrokr — Codebase Audit & Launch Guide

Generated: June 2026. See also `MIGRATION_TO_CURSOR.md` and `DEVELOPER_HANDOFF.md`.

## Production Readiness Score: **74 / 100** (after production-readiness hardening)

| Category | Score | Notes |
|----------|-------|-------|
| Core marketplace | 80 | Web + mobile bidding/completion flows wired to live APIs |
| Auth | 90 | Clerk + staff sessions integrated; set `ADMIN_USER_IDS` in prod |
| Payments | 70 | Stripe env validation and off-session flows in place |
| Mobile | 65 | Driver workflow, uploads, notifications, and status tracking wired |
| API docs | 50 | ~35 routes still missing from OpenAPI |
| Database | 70 | Hot-path indexes added; add versioned migrations before scale |
| Security | 80 | CORS, staff login throttling, and scoped marketplace access hardened |
| Testing | 70 | API, web, and mobile suites pass locally |
| Deployment | 75 | Production checklist, rollback plan, and env map documented |
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

Hot-path indexes now cover requests, bids, jobs, activity, tickets, job status updates, evidence, messages, profiles, driver documents, and upload sessions. No versioned SQL migrations exist yet — use `drizzle-kit push` for launch, then add checked-in migrations before high-volume schema changes.

---

## 3. API

Base path: `/api`. OpenAPI documents 88 operations; ~35 implemented routes are undocumented (tickets, storage, driver-docs, projects CRUD, factoring, quickbooks, bin-orders customer routes).

Health: `GET /api/healthz` (no auth).

---

## 4. Authentication

100% Clerk — no local auth tables. Web: session cookies + Clerk proxy at `/api/__clerk`. Mobile: Bearer JWT via `@clerk/expo`.

Middleware: `requireAuth` → `requireProfile` → `requirePermission` / `requireAdmin`.

Staff RBAC via `profiles.staff_role`, staff password sessions, and `ADMIN_USER_IDS` bootstrap. Marketplace job access is scoped to job/org membership; staff use permission-scoped admin routes.

---

## 5. Missing Features (remaining)

- QuickBooks real integration (simulated)
- FMCSA live API verification
- Native GPS map tab / true coordinate streaming
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
- CORS is origin-allowlisted for production
- Staff login has failed-attempt throttling
- Staff password sessions can access the web admin route
- Bin-order admin API accepts staff sessions and Clerk admins
- Mobile tracking reflects backend status timeline updates
- Hot-path database indexes added

---

## 7. Technical Debt

- Hand-written `useLiveApi.ts` vs generated client drift
- Soft FKs on `organizations` / `profiles.organization_id`
- `bin_orders.customer_id` is text, not FK
- R2 upload tokens remain in-process; move consumed-token state to shared storage before horizontal scale
- Consistent `haulbrokr` naming across packages, folders, and mobile bundle ID

---

## 8. Launch Plan

### Phase 0 — Environment

1. `pnpm install`
2. Provision PostgreSQL, Clerk app, Stripe Connect, Cloudflare R2, and Resend
3. Copy `.env.example` → `.env`
4. `pnpm --filter @workspace/db run push`
5. Set `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`

### Phase 1 — Backend

1. Deploy API (`node artifacts/api-server/dist/index.mjs`)
2. Set `ADMIN_USER_IDS`, verify `PAYMENTS_MOCK_MODE` is unset in prod
3. Health probe on `/api/healthz`
4. Add tests for profiles/trucks/requests/bids

### Phase 2 — Web

1. Build: `pnpm --filter @workspace/haulbrokr run build`
2. Deploy static `dist/` to CDN
3. `VITE_CLERK_PROXY_URL=/api/__clerk`

### Phase 3 — iOS

1. `EXPO_PUBLIC_DOMAIN` = production API host
2. `eas build --platform ios --profile production`
3. TestFlight → `eas submit --platform ios`

### Phase 4 — Android

1. Google Maps API key in `app.json`
2. `eas build --platform android --profile production`
3. Play Store submit

### Phase 5 — Mobile Web

1. `pnpm --filter @workspace/haulbrokr-mobile run build`
2. Serve at `/mobile/` or subdomain

### Phase 6 — QA

End-to-end: post load → bid → accept → assign → clock in/out → complete → charge → payout.

### Phase 7 — Launch

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
| `RESEND_API_KEY` | prod | Review emails |
| `RESEND_FROM_EMAIL` | prod | Email from address |
| `UPLOAD_TOKEN_SECRET` | yes | Upload tokens |
| `TICKET_QR_SECRET` | yes | QR tickets |
| `ADMIN_USER_IDS` | prod | Admin bootstrap |
| `EXPO_PUBLIC_DOMAIN` | mobile | API host |
| `R2_ACCOUNT_ID` / `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` / `R2_BUCKET` / `R2_PUBLIC_URL` | prod | R2 uploads |
| `CORS_ALLOWED_ORIGINS` | prod | Browser origin allowlist |
