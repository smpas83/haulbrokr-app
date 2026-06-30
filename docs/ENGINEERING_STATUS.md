# HaulBrokr Engineering Status

Last updated: 2026-06-30

## Current Branch

`cursor/security-certification-fixes-5fcc`

## Latest Commit

`cf50e05` - feat: stripe connect marketplace

## Build Status

Passing for latest marketplace milestone.

- `pnpm run build`

## Test Status

Passing for latest marketplace milestone.

- `pnpm run typecheck`
- `pnpm -r --if-present run test`
- `pnpm -r --if-present run lint`

## Completed Features

- Production readiness promotion to `master`.
- Closed Beta certification report.
- Runtime API proxy dependency security fix (`http-proxy-middleware` upgraded to `^4.1.1`).
- Configurable commission engine:
  - Default 20% global commission.
  - Customer, vendor, and project override support.
  - Persisted commission calculations.
  - Commission audit history.
  - Admin commission configuration APIs.
- Stripe Connect marketplace hardening:
  - Persisted marketplace payment ledger.
  - Payment history API for customers and vendors.
  - Admin payment listing API for finance staff.
  - Ledger capture for off-session charge/transfer and hosted Checkout paths.
- Dynamic pricing engine:
  - Configurable demand, truck-shortage, night, weekend, holiday, emergency, weather, traffic, remote-site, waiting-time, and toll-road surcharges.
  - Percentage and fixed-amount surcharge modes.
  - Admin surcharge configuration APIs.
  - Persisted dynamic pricing calculations.
  - Award/completion calculations include active configured surcharges.

## In Progress

- Realtime marketplace maps.

## Next

1. Marketplace ratings.
2. Notification service.

## Known Blockers

- Real provider integration testing requires staging credentials that are not available in this environment.
- Production Google Maps workflows are not yet implemented end-to-end.
- Native mobile GPS/background/push behavior requires device QA.

## Outstanding Issues

- R2 upload/retrieval requires authenticated staging-user validation.
- Resend email coverage is partial and needs a dedicated notification service milestone.
