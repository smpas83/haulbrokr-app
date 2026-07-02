# HaulBrokr Engineering Status

## Sprint 19 workflow integrations completed

- Request posting now accepts and returns optional `projectId`, facility identity, facility instructions, facility accepted materials, facility safety notes, facility operating hours, facility phone, facility pricing metadata, broker notes, and driver instructions.
- Request creation and updates validate `facilityId` against the existing dump-site directory and reject missing or inactive facilities before the request can progress.
- Bid award now copies request `projectId` plus all facility, broker, driver, and customer note metadata onto the created job.
- Completed jobs now enter `completionApproval: "pending"` automatically and create customer/provider activity and timeline events for review.
- Invoice PDF, direct charge, and Stripe Checkout initiation are blocked until completion is approved.
- Driver job API responses redact customer pricing, broker fee/margin, provider net, facility pricing metadata, and broker-only notes.
- The OpenAPI contract, generated React Query client, and generated Zod validation schemas were regenerated from the updated workflow fields.

## Remaining production blockers

- Production credentials must be supplied and verified for Stripe, Clerk, Google Maps, email, SMS, push notifications, and object storage.
- Facility coordinates, geofences, traffic, and live ETA require a maps provider key and real GPS ingestion from driver devices.
- Email/SMS/push workflow notifications still need provider-specific delivery adapters beyond the current in-app activity feed.
- Timeline rows do not yet persist actor role or GPS columns; GPS-aware timeline entries require a schema expansion and client payload updates.
- Material compatibility rules per facility are stored as metadata but need a structured material taxonomy before enforcing wrong-material rejection.

## Validation rules

- Invalid or inactive facilities are rejected on request create/update.
- Provider bidding remains blocked by compliance and payout readiness.
- Jobs cannot start until accepted.
- Driver job updates remain restricted to assigned drivers or the hauling company.
- Completion must be approved before invoices or payments can be initiated.
- Payment still guards against duplicate payment, failed payout retries, pending ACH verification, and missing provider payout readiness.

## Performance notes

- Workflow changes reuse existing API routes, generated clients, and tables instead of adding duplicate business logic.
- Facility validation performs a single lookup only when `facilityId` is supplied.
- Timeline and activity writes remain append-only and scoped to the related job ID for existing query patterns.

## Testing status

- `pnpm run typecheck` passed across shared libraries, API, web, mobile, and scripts.
- API tests passed: 26 files, 323 tests.
- Web tests passed: 5 files, 11 tests.
- Mobile tests passed: 9 files, 68 tests.
- Production workspace build passed for API, web, deck, promo, and sandbox artifacts.
- Mobile web build/runtime check passed; all 30 routes rendered successfully on first load.
- Mobile static deployment build is blocked by missing `REPLIT_INTERNAL_APP_DOMAIN`, `REPLIT_DEV_DOMAIN`, or `EXPO_PUBLIC_DOMAIN`.
- Deployment readiness is blocked by missing production environment variables for database, Stripe, Clerk proxy/mobile key, Resend, R2/storage, upload/QR/staff secrets, domain, and Google Maps.
- DB-backed integration tests are blocked by no reachable local Postgres at `127.0.0.1:5432`.
