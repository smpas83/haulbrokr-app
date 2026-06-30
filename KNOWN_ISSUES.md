# HaulBrokr Known Issues

## Blockers

1. **Live production E2E workflows are not certified in this environment.**
   - Impact: Customer payment, Stripe Connect onboarding, webhook handling, Clerk production auth, R2 uploads, Resend emails, Google Maps keys, and deployed health checks require live or staging credentials that are not present in this workspace.
   - Required before production: run the full workflow checklist in `POST_LAUNCH_CHECKLIST.md` against staging, then production.

## Critical issues

- None verified after the current hardening pass.

## High-priority issues

1. **Mobile realtime GPS tracking is not implemented as a live location workflow.**
   - Evidence: the mobile map tab is hidden for launch and tracking uses simulated/display data rather than driver device location.
   - Impact: customer ETA and fleet tracking should be treated as staging-only/demo until live location infrastructure is completed.

2. **Mobile push notifications are not implemented.**
   - Evidence: mobile notifications are in-app activity polling, not OS push token registration or `expo-notifications`.
   - Impact: drivers may miss dispatches unless they are actively using the app.

3. **Offline recovery is limited to demo/local state paths.**
   - Evidence: no durable offline mutation queue or sync replay is wired for driver job events, tickets, or uploads.
   - Impact: field operations can lose work when connectivity drops during upload or status mutation.

4. **QuickBooks integration is simulated.**
   - Evidence: API/spec labels identify QuickBooks connect and sync as simulated.
   - Impact: accounting sync should not be marketed as a live production integration.

## Medium-priority issues

1. **Scale ticket capture is incomplete on mobile.**
   - Evidence: ticket rows display weight/photo data when present, but the mobile create-ticket flow only logs a load and does not collect weight or a scale-ticket photo.
   - Impact: scale-ticket compliance depends on later evidence upload or back-office entry.

2. **Supervisor onboarding is mobile-supported but not available as a first-class web onboarding option.**
   - Evidence: backend accepts supervisor invite onboarding; web onboarding is limited to customer, provider, and driver.
   - Impact: foremen/supervisors should onboard through mobile or an assisted flow.

3. **Factoring approval is API-backed but not exposed as a dedicated admin tab.**
   - Evidence: provider factoring requests can be created; approval remains an admin/API operation rather than a complete staff UI workflow.
   - Impact: factoring needs staff runbook coverage until the admin surface is expanded.

4. **Upload token replay protection and rate limiting are in-memory.**
   - Evidence: upload token consumption and request limits are process-local.
   - Impact: acceptable for a single Render instance; use a shared store before horizontal scaling.
