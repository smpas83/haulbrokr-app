# Threat Model

## Project Overview

HaulBrokr is a dump-truck hauling marketplace with a public web app, a mobile app, and an Express API backed by PostgreSQL. Customers post loads, providers and drivers manage jobs and payouts, staff review compliance and credit applications, and Stripe is used for payment collection and provider payouts. The production deployment is public; the mockup sandbox and deck/promo artifacts are not production surfaces.

## Assets

- **User accounts and sessions** -- Clerk identities, session tokens, and the local profile records that map those identities to marketplace roles. Compromise would let an attacker impersonate customers, providers, drivers, supervisors, or staff.
- **Marketplace business records** -- jobs, requests, bids, projects, organizations, tickets, evidence, and activity entries. These records drive dispatch, billing, and operational decisions; cross-tenant access would expose business-sensitive and sometimes personal data.
- **Payment and payout state** -- saved payment-method references, Stripe customer/account identifiers, payment status fields, invoice timing, payout retry state, and transfer linkage. Errors here can cause unauthorized charges, duplicate settlement, or stolen payouts.
- **Compliance and credit-review data** -- carrier compliance records, W-9 / insurance details, driver documents, and customer credit applications. These contain sensitive business and identity information and must not be exposed across tenants or to ordinary users.
- **Application secrets and third-party credentials** -- database connection strings, Clerk secrets, Stripe secret keys, Resend credentials, and object-storage credentials. Exposure would enable full backend compromise or financial abuse.
- **Uploaded documents and objects** -- driver documents, evidence files, and any object-storage paths returned to clients. Unauthorized read access could expose regulated or highly sensitive documents.

## Trust Boundaries

- **Browser/mobile client to API** -- all client input is untrusted. The API must enforce authentication, authorization, input validation, and state transitions server-side.
- **Clerk identity to local profile/role mapping** -- a valid Clerk user is not automatically authorized; backend code must safely resolve the user into the correct local profile, org context, and staff permissions.
- **Authenticated user to other authenticated users** -- customers, providers, drivers, supervisors, and staff all have different privileges. Shared organization membership must not become cross-tenant or cross-role access.
- **General marketplace users to staff/admin functions** -- staff-only reviews, payout controls, and role management are a separate privilege boundary from standard marketplace roles.
- **API to PostgreSQL** -- the API has direct read/write access to all marketplace data. Injection or broken authorization at the API layer would expose the full dataset.
- **API to Stripe and other external services** -- Stripe, object storage, Resend, and QuickBooks integrations are high-trust outbound boundaries. User-controlled inputs passed into redirects, uploads, or payment operations must be constrained.
- **Public internet to deployed service** -- the deployed app is public, so all unauthenticated or weakly authenticated routes are internet-reachable in production.
- **Production vs dev-only surfaces** -- `artifacts/mockup-sandbox`, slide/deck artifacts, test utilities, and Expo local-development behavior are not production unless proven reachable from the deployed service.

## Scan Anchors

- **Production entry points**: `artifacts/api-server/src/index.ts`, `artifacts/api-server/src/app.ts`, `artifacts/dumpbroker/src/main.tsx`, `artifacts/dumpbroker-mobile/app/_layout.tsx`.
- **Highest-risk backend areas**: `artifacts/api-server/src/routes/jobs.ts`, `routes/account.ts`, `routes/payouts.ts`, `routes/admin.ts`, `routes/storage.ts`, and `artifacts/api-server/src/lib/access.ts` / payout helpers.
- **Public surfaces**: `/api/healthz`, `/api/dump-sites*`, `/api/storage/public-objects/*`, the public web SPA, and any mobile/web sign-in flows.
- **Authenticated surfaces**: most `/api` marketplace routes guarded by `requireAuth` or `requireProfile`.
- **Admin surfaces**: `/api/admin/*` plus any code paths gated by `requireAdmin` or `requirePermission`.
- **Usually dev-only / ignore unless proven reachable**: `artifacts/mockup-sandbox`, deck/promo artifacts, tests, dist output, Expo Go-only flows.

## Threat Categories

### Spoofing

Authentication is delegated to Clerk, but the backend must treat the client as untrusted even after Clerk identifies a user. Every protected route must require a valid Clerk session and then bind actions to the correct local profile; no endpoint may trust client-supplied role, org, profile, or payment identifiers in place of server-side ownership checks.

### Tampering

Marketplace state transitions affect dispatch, billing, and payouts, so server routes must not let users modify records outside their authorized role or tenant. Payment amounts, payout readiness, completion state, staff-role changes, and organization membership changes must be derived or validated server-side rather than accepted from the client at face value.

### Information Disclosure

The API stores sensitive business, payment, and compliance data. Job details, driver documents, credit applications, compliance reviews, payout/account status, and uploaded objects must be scoped to the correct tenant and role, and logs/error responses must not leak secrets or internal details.

### Denial of Service

Public or broadly authenticated endpoints that trigger storage allocation, external API calls, or expensive queries can be abused if unbounded. File-upload URL issuance, payment/intake endpoints, and externally synced flows should enforce strict validation and avoid attacker-controlled loops or expensive fan-out work.

### Elevation of Privilege

This project has multiple privilege layers: ordinary authenticated users, organization managers/members, and internal staff. Admin/staff routes must enforce permission checks server-side, organization membership must not grant unrelated tenant access, and payment/storage endpoints must not let a lower-privileged user act on a higher-privileged account or another tenant’s records.

## Scan Calibration Notes

- Treat the documented internal staff permission map as intentional unless a finding shows an unintended privilege crossing from ordinary marketplace users or from a lower-trust staff role into a higher-trust function that the code/comments do not explicitly delegate.
- Treat normal merchant fraud risk from an authenticated customer supplying card details to Stripe as out of scope unless the server permits cross-account instrument binding, bypasses documented ownership checks, or contradicts an explicit backend approval requirement.
