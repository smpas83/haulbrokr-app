# HaulBrokr Known Issues

## Blockers

1. **Live production E2E workflows are not certified in this environment.**
   - Impact: Customer payment, Stripe Connect onboarding, webhook handling, Clerk production auth, R2 uploads, Resend emails, Google Maps keys, and deployed health checks require live or staging credentials that are not present in this workspace.
   - Required before production: run the full workflow checklist in `POST_LAUNCH_CHECKLIST.md` against staging, then production.

## Critical issues

- None verified after RC1 lockdown (mobile GPS auth, tracking API wiring, scale ticket capture, QuickBooks disclaimers).

## High-priority issues

1. **Live production E2E with Clerk/Stripe credentials must be run manually.**
   - Use `pnpm run verify:staging-e2e` for infrastructure checks.
   - Complete `POST_LAUNCH_CHECKLIST.md` with staging accounts.

2. **Push notification delivery requires Expo push credentials and device_tokens table migration.**
   - API: `POST /notifications/register` stores tokens (now uses Clerk Bearer auth).
   - `registerPushToken` requires `expo-notifications` wiring on device — not yet invoked from UI.
   - Run `pnpm --filter @workspace/db run push` before production deploy.

3. **QuickBooks integration remains simulated** — UI and API now label sync as preview/simulated; do not market as live OAuth.

## Resolved in staging-e2e branch

- Global API rate limiting (120 req/min per IP/profile)
- Live GPS tracking via `POST /jobs/:id/location` and `GET /jobs/:id/tracking`
- Digital Twin dispatch page at `/dispatch` with `GET /dispatch/overview`
- Functional AI Copilot at `/copilot/chat` and `/copilot/insights`
- Web invoice PDF download and job rating UI
- Mobile driver location ping hook

## Medium-priority issues

1. **Supervisor onboarding is mobile-supported but not available as a first-class web onboarding option.**
   - Evidence: backend accepts supervisor invite onboarding; web onboarding is limited to customer, provider, and driver.
   - Impact: foremen/supervisors should onboard through mobile or an assisted flow.

2. **Factoring approval is API-backed but not exposed as a dedicated admin tab.**
   - Evidence: provider factoring requests can be created; approval remains an admin/API operation rather than a complete staff UI workflow.
   - Impact: factoring needs staff runbook coverage until the admin surface is expanded.

3. **Upload token replay protection and rate limiting are in-memory.**
   - Evidence: upload token consumption and request limits are process-local.
   - Impact: acceptable for a single Render instance; use a shared store before horizontal scaling.
