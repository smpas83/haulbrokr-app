# HaulBrokr Known Issues

## Blockers

1. **Live production E2E workflows are not certified in this environment.**
   - Impact: Customer payment, Stripe Connect onboarding, webhook handling, Clerk production auth, R2 uploads, Resend emails, Google Maps keys, and deployed health checks require live or staging credentials that are not present in this workspace.
   - Required before production: run the full workflow checklist in `POST_LAUNCH_CHECKLIST.md` against staging, then production.

## Critical issues

- None verified after the current hardening pass.

## High-priority issues

1. **Live production E2E with Clerk/Stripe credentials must be run manually.**
   - Use `pnpm run verify:staging-e2e` for infrastructure checks.
   - Complete `POST_LAUNCH_CHECKLIST.md` with staging accounts.

2. **Push notification delivery requires Expo push credentials in EAS.**
   - API: `POST /notifications/register` stores tokens; `device_tokens` table migrates on API boot.
   - Mobile: `expo-notifications` registers tokens on sign-in.
   - Operator: configure Expo push credentials in the EAS dashboard before store builds.

3. **QuickBooks integration remains simulated** — UI labels updated; do not market as live sync.

## Resolved in full-go-live-fixes branch

- Expo push notifications (API send + mobile registration)
- iOS bundle ID `com.haulbrokr.mobile` + EAS production submit track
- Mobile scale-ticket capture (weight + photo on create)
- Admin refund operations panel (Payouts tab) and factoring panel (Credit tab)
- Web supervisor onboarding role card
- Mobile team screen no longer falls back to demo data when signed in
- FMCSA compliance verify restricted to staff with `compliance` permission
- `device_tokens` startup migration + readyz health check

## Resolved in staging-e2e branch (prior)

- Global API rate limiting (120 req/min per IP/profile)
- Live GPS tracking via `POST /jobs/:id/location` and `GET /jobs/:id/tracking`
- Digital Twin dispatch page at `/dispatch` with `GET /dispatch/overview`
- Functional AI Copilot at `/copilot/chat` and `/copilot/insights`
- Web invoice PDF download and job rating UI
- Mobile driver location ping hook

## Medium-priority issues

1. **Upload token replay protection and rate limiting are in-memory.**
   - Evidence: upload token consumption and request limits are process-local.
   - Impact: acceptable for a single Render instance; use a shared store before horizontal scaling.
