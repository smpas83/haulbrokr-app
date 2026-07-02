# HaulBrokr Engineering Status

Generated: 2026-07-02

## Production Readiness

Decision: **No-Go for nationwide closed beta until launch-critical credentials are configured and staging smoke tests pass with live test-mode providers.**

The codebase supports the core marketplace workflow across customer, provider, driver, fleet, and admin surfaces. Remaining production blockers are configuration, live vendor enablement, and vendor-backed workflows that cannot be completed without external credentials or business decisions.

## Completed Engineering Work

- API, web, mobile, database schema, OpenAPI-generated web client, and Expo app are present in the pnpm monorepo.
- Clerk authentication and staff RBAC are implemented, including admin bootstrap through `ADMIN_USER_IDS`.
- Core marketplace routes cover requests, bids, award flow, jobs, invoices, wallet, ratings, messages, bin orders, projects, trucks, evidence, tickets, and driver events.
- Stripe payment paths include payment intents, setup intents, ACH micro-deposit verification, Connect onboarding, webhooks, refunds, payouts, payout retry, and audit-oriented status fields.
- File upload security uses scoped upload tokens, size/content-type validation, single-use finalization, and private/public storage separation.
- In-app activity and Resend email notifications exist for operational events.
- Health and readiness endpoints exist at `/api/healthz` and `/api/readyz`.
- API responses now propagate `X-Request-Id` for support correlation.
- Automation readiness can be queried at `/api/automation/readiness` with `x-automation-key`.

## Remaining Production Blockers

- Production credentials must be set for Clerk, Stripe, Resend, R2, Google Maps, database, staff auth, upload tokens, ticket QR tokens, and mobile/web public env vars.
- Stripe live/test-mode Connect smoke test must be completed end to end: connected account, identity status, card/ACH capture, webhook, payout, refund, failed payment, dispute, and reconciliation.
- Google Maps mobile tab remains hidden because live GPS/location infrastructure is not connected to route/job data.
- Push notifications are not implemented; current production surface is in-app plus email.
- Document AI/OCR is not implemented; compliance and documents are manually reviewed by staff.
- QuickBooks is simulated and must remain disabled for production accounting sync until real OAuth and sync are implemented.
- Versioned SQL migrations are not present; schema is applied with Drizzle push.
- OpenAPI coverage still trails implemented routes, especially mobile/field operations and admin workflows.

## Credential Requirements

- `DATABASE_URL`
- `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`
- `VITE_CLERK_PUBLISHABLE_KEY`, `VITE_CLERK_PROXY_URL`
- `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`, `EXPO_PUBLIC_DOMAIN`
- `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`
- `RESEND_API_KEY`, `RESEND_FROM_EMAIL`
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_URL`
- `PRIVATE_OBJECT_DIR`, `PUBLIC_OBJECT_SEARCH_PATHS`
- `UPLOAD_TOKEN_SECRET`, `TICKET_QR_SECRET`, `STAFF_AUTH_SECRET`, `ADMIN_USER_IDS`
- `GOOGLE_MAPS_API_KEY`
- `AUTOMATION_KEY` for protected ops readiness/digest endpoints

## Latest Build and Test Results

Pending current sprint verification.

## Deployment Status

Deployable after green typecheck/build/tests and configured production credentials. Nationwide closed beta remains blocked until staging validates live provider integrations and the documented no-go items are resolved or explicitly deferred by the business.
