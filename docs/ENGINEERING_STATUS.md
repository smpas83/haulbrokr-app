# Engineering Status

## Completed

- Closed beta hardening: web global error boundary, profile-load error recovery, staff-gated integrations route, skip link/mobile nav accessibility labels, API request correlation IDs, explicit request body limits, mobile network error normalization, and mobile loading/error gates for job/tracking screens.
- Sprint 7 UI integrations: customer billing history in Account, provider wallet/payout history, driver earnings, dashboard notifications, job-detail ratings, admin financial metrics, mobile driver earnings, mobile navigation launch, and live-status-driven tracking.
- Sprint 6 database foundation: `stripe_connected_accounts`, `vendor_payouts`, `driver_wallet`, `driver_earnings`, `payment_history`, `refund_history`, `review_history`, `review_flags`, `review_stats`, `notification_queue`, `notification_delivery`, and `invoice_documents`.
- Stripe Connect account mirroring, payment audit trail, refund history, chargeback webhook audit handling, and payment reconciliation APIs.
- Vendor payout lifecycle APIs for pending, approved, paid, failed, cancelled, partial, and manual adjustment workflows.
- Driver earnings and wallet summaries for daily, weekly, monthly, and lifetime earnings.
- Ratings trust layer with review history, profile stats, review flagging, and admin moderation.
- Notification queue and delivery records for email, SMS, push, and in-app channels with retry tracking.
- Customer billing history and admin marketplace financial APIs for GMV, revenue, payouts, refunds, chargebacks, average job value, margin, and grouped revenue.

## In Progress

- Closed beta manual E2E validation still requires seeded users/credentials for customer, driver, dispatcher/provider, fleet owner, and admin roles.
- Customer booking live quote integration is blocked on an exposed pricing/quote API in this branch.
- Live map marker integration is blocked on geocoded job/truck location endpoints being present in the active integration branch.
- External provider credential wiring for production SMS and push delivery.
- Live Stripe production credential verification in the target deployment environment.
- Client integration for the new Sprint 6 backend endpoints.

## Next Sprint

- Freeze major feature development after beta hardening; continue only bug fixes, approved design implementation, accessibility/performance polish, deployment, and beta support.
- Continue UI integration only after approved API contracts exist for quote generation and live map coordinates.
- Keep remaining work focused on UI polish, accessibility, performance, bug fixing, production deployment, and closed beta support.
- Prepare closed beta operational runbooks for Stripe webhooks, refund handling, payout exceptions, and notification failures.

## Coverage

- Beta hardening tests cover the web error boundary, API request-id error correlation, web app tests, mobile app tests, and API server tests.
- UI type coverage includes web and mobile TypeScript checks for the new integrations.
- Unit and route tests cover job payments, Stripe webhooks, payout readiness, marketplace finance APIs, ratings/review moderation, and notification delivery retries.
- Type coverage includes API server, generated OpenAPI packages, web, mobile, scripts, and shared libraries through the monorepo typecheck.

## Known Blockers

- Seeded beta credentials are required to exercise protected role workflows end-to-end in browser automation.
- Pricing-engine quote API and live map coordinate APIs are not exposed in this active branch, so the UI does not invent duplicate quote or map business logic.
- Manual browser validation of protected Sprint 7 panels is blocked in Cursor Cloud by missing valid Clerk/staff credentials; unauthenticated root redirects to staff login as expected.
- Production Stripe, SMS, and push provider credentials are required for live external delivery and real-money verification.
- Direct driver payouts remain future-ready in the data model; money still settles to vendors today.
- UI integration is intentionally out of scope for this backend-only sprint.

## Beta Checklist

- [x] Global web crash recovery prevents blank pages.
- [x] Profile-load failures render retry UI instead of blank screens.
- [x] API errors include request correlation IDs.
- [x] Mobile network failures use consistent user-facing messages.
- [x] Mobile job/tracking deep links wait for live queries before showing not-found states.
- [x] Production build, typecheck, lint, web tests, mobile tests, and API tests are part of the release gate.
- [ ] Manual E2E validation with seeded Clerk/staff users for every role.
- [ ] Production credential smoke test for Stripe, Clerk, email, SMS, push, Google Maps, and Document Intelligence.
- [ ] Pricing/quote and live coordinate API contracts approved for final UI connection.

## Environment Requirements

- Web: `VITE_CLERK_PUBLISHABLE_KEY`, `PORT`, `BASE_PATH`.
- Mobile: `EXPO_PUBLIC_DOMAIN`, `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`, optional `GOOGLE_MAPS_API_KEY`.
- API: `DATABASE_URL`, Clerk keys, Stripe keys/webhook secret, `TICKET_QR_SECRET`, `ADMIN_USER_IDS`, CORS origins, storage credentials, Resend/email config, SMS/push provider credentials when enabled.
- Integration tests require a reachable Postgres database on the configured `DATABASE_URL`.

## Latest Commit

- Latest verified code commit before this status update: `363aecb`.

## Build Status

- Pending final closed-beta hardening verification run.

## Test Status

- Pending final closed-beta hardening verification run.
