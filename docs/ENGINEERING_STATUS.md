# HaulBrokr Engineering Status

Updated: 2026-07-01
Branch: `cursor/marketplace-engine-3455`
Latest commit: `b11dc27` (financial engine verified at `283f8aa`)

## Completed milestones

- Established an engineering status log for production-readiness tracking.
- Added a root lint gate for release-control files that were already referenced by the go-live checklist.
- Added the lint gate to GitHub Actions so release checks and CI are aligned.
- Formatted `pnpm-workspace.yaml` so the new lint gate starts green.
- Fixed regenerated `@workspace/api-zod` exports for `CreateDriverEventBody`.
- Added an API codegen freshness gate to CI so generated Zod schemas and React Query clients cannot drift silently.
- Added additive marketplace schema for commission rules, pricing rules, quote snapshots, audit logs, invoices, payment transactions, Stripe webhook events, refunds, and payout transfers.
- Implemented configurable commission resolution with global, customer, vendor, project, and emergency override support.
- Implemented dynamic pricing with configurable base rate, distance, truck/material/demand/availability/traffic/weather rules, surcharges, waiting time, and extra stops.
- Added backend marketplace APIs for quote creation, commission preview, and admin rule configuration.
- Extended Stripe payment paths to persist checkout session IDs, charge IDs, and payment/transfer ledger records.
- Snapshotted estimated commission, GMV, customer total, platform commission, and vendor payout when bids are awarded.
- Added marketplace read APIs for payment transactions, invoice records, refunds, fleet availability, notifications, trip timelines, and document status.
- Added Stripe refund execution with refund/ledger persistence and no card-data storage.
- Added Stripe webhook event persistence and duplicate-event skipping for idempotent webhook processing.
- Wired net-terms billing to persist invoice records.
- Added explicit financial-engine tables for commission settings, pricing events, marketplace transactions, vendor settlements, customer invoices, invoice items, payment history, refund history, and financial audit logs.
- Expanded commission settings to support material and region overrides.
- Expanded dynamic pricing to support hourly, distance, per-load, per-ton, truck shortage, bridge toll, permit fee, taxes, fees, and pass-through surcharges.
- Added financial quote, vendor settlement, customer billing summary, and admin financial dashboard APIs.
- Added immutable financial audit and marketplace transaction helpers for settlements, invoices, and payment history.

## Current work

- Marketplace Financial Engine backend is complete; next work is live-service certification and UI wiring after product design approval.

## Next sprint

1. Sprint 4 Live Operations: Google Maps, realtime GPS tracking, dispatcher command center, fleet map, driver trip tracking, customer live tracking, geofencing, and ETA updates.
2. Wire marketplace quote outputs into customer/provider UI after product design approves placement and copy.
3. Add financial dashboard, settlement, invoice, and quote UI wiring after product design approves placement and copy.
4. Move production database rollout from `drizzle-kit push` to generated, reviewed migrations.

## Build status

- Passing: `pnpm run build`

## Test status

- Passing: `pnpm run typecheck:libs`
- Passing: `pnpm --filter @workspace/api-server run typecheck`
- Passing: `pnpm run lint`
- Passing: `pnpm run check:api-codegen`
- Passing: `pnpm run typecheck`
- Passing: `PAYMENTS_MOCK_MODE=true pnpm --filter @workspace/api-server run test`
- Passing: `pnpm --filter @workspace/haulbrokr run test`
- Passing: `pnpm --filter @workspace/haulbrokr-mobile run test`

## Coverage

- Unit coverage added for commission resolution, marketplace amount math, dynamic pricing rules, and audit logging.
- Route-level coverage added for quote creation, financial quote creation, admin commission configuration, transaction reads, invoice reads, refunds, vendor settlements, billing summaries, financial dashboard APIs, fleet availability, notifications, trip timelines, document status, and webhook idempotency.
- Existing award-flow coverage now verifies job award financial snapshots.

## Known blockers

- Live third-party certification still requires real staging credentials for Clerk, Stripe Connect, R2, Resend, Google Maps, and production-like webhooks.
- Broad `prettier --check . --ignore-unknown` currently reports existing formatting drift across hundreds of files; the production gate is intentionally scoped until a dedicated formatting milestone is scheduled.
- Stripe live keys are required before live payment intents, ACH debits, refunds, receipts, and vendor payouts can be certified against real Connect accounts.
- Google Maps live GPS, push notifications, QuickBooks live sync, and offline field recovery remain documented launch gaps.
