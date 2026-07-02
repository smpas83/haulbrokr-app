# HaulBrokr Engineering Status

## Closed beta recommendation

HaulBrokr is conditionally ready for a controlled closed beta with customers, providers/fleet owners, invited drivers, and staff operators after production credentials and staging smoke tests are completed. Public launch is not recommended until live maps/GPS, SMS/push, accounting sync, stronger audit logging, and scale-oriented database/index work are complete.

## Completed and verified

- Request posting accepts facility and operational metadata, validates active facilities, and preserves that data through bid award into jobs.
- Bid award copies `projectId`, facility fields, broker notes, driver instructions, customer notes, schedule, material, truck type, and pricing metadata to jobs.
- Completed jobs move to `completionApproval: "pending"` and invoices, direct charge, and Stripe Checkout are blocked until approval.
- Driver job API responses redact customer pricing, broker margin, provider net, facility pricing metadata, and broker-only notes.
- Direct request status mutation is rejected; request status is now controlled by the award, job, and completion workflow.
- Unassigned drivers cannot post job timeline status updates.
- Unavailable third-party trucks are hidden from truck detail reads.
- Simulated QuickBooks connect/sync is blocked in production unless real OAuth credentials are configured.
- Express now trusts the first production proxy and limits JSON/form bodies to `256kb`.
- Web accessibility/performance hardening added: zoom is not disabled, reduced-motion is honored, loading states are announced, skip link and nav current state are present, mobile nav has an accessible label, and React Query uses safer defaults.
- Broken web logo references now point at the existing `logo.svg`.
- OpenAPI, React Query client types, and Zod schemas were regenerated after workflow contract changes.

## Remaining production blockers

- Production credentials must be supplied and verified for Neon/Postgres, Clerk, Stripe, Resend, Cloudflare R2/storage, staff secrets, upload/QR secrets, domain configuration, and Google Maps.
- DB-backed integration tests require a reachable Postgres instance.
- Mobile static deployment requires `REPLIT_INTERNAL_APP_DOMAIN`, `REPLIT_DEV_DOMAIN`, or `EXPO_PUBLIC_DOMAIN`.
- Live maps, traffic, GPS, ETA, geofences, and route updates require provider credentials plus real driver GPS ingestion.
- Email is limited to existing backend paths; SMS and push notification delivery adapters are not implemented.
- QuickBooks remains out of scope for beta unless live OAuth credentials and sync behavior are implemented.
- Timeline rows do not yet persist actor role or structured GPS columns.

## Validation rules

- Invalid, missing, or inactive facilities are rejected when supplied.
- Provider bidding remains blocked by compliance and payout readiness.
- Jobs cannot start until accepted.
- Assigned-driver checks gate driver evidence, job updates, and timeline status writes.
- Completion approval is required before invoice generation and payment initiation.
- Payment guards remain in place for duplicate payment, failed payout retries, pending ACH verification, missing customer payment method, and missing provider payout readiness.

## Risk assessment

- Closed beta risk is moderate and acceptable with staff-assisted onboarding and a limited user cohort.
- Highest beta risks are production credential setup, live payment/webhook configuration, driver/supervisor mobile UX clarity, and lack of live GPS/notification channels.
- Highest public-launch risks are accounting integration, audit logging, rate limiting across multiple instances, database indexes, and nationwide-scale dispatcher/map performance.

## Latest testing status

- `pnpm run typecheck`, full API tests, web tests, mobile tests, production workspace build, and mobile web runtime checks passed for this audit revision.
- Deployment readiness remains blocked by missing production environment variables.
- DB-backed integration tests remain blocked by no reachable local Postgres at `127.0.0.1:5432`.
- Mobile static deployment build remains blocked by missing deployment domain configuration.
- Manual localhost web auth verification is blocked by Clerk production keys restricted to `haulbrokr.com`; verify auth UI on the configured staging/production domain.
- Full command results are recorded in `BETA_TEST_REPORT.md`.
