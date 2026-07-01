# HaulBrokr Engineering Status

Updated: 2026-07-01

## Current launch posture

HaulBrokr is structurally ready for a closed beta engineering pass, but not for an unrestricted public launch until live credentials, live workflow certification, and maps/notification gaps are accepted or resolved.

## Beta readiness checklist

| Area | Status | Notes |
|---|---|---|
| Customer registration | Ready for beta | Clerk-backed web/mobile auth is implemented; production domains still need live verification. |
| Request haul / quote / accept | Ready for beta | Web path is strongest; mobile live award/accept parity still needs follow-up hardening. |
| Driver accept / navigate / complete | Partial | Driver field ops are API-backed; GPS snapshots now attach to status updates when device permission is granted. |
| Customer tracking | Partial | Mobile tracking now polls job status updates for latest driver GPS and renders markers/polyline through the existing map abstraction. |
| Dispatcher assign / monitor | Partial | Assignment exists; dispatcher fleet map remains limited to existing job/location data. |
| Fleet owner payouts / utilization | Partial | Payout status exists; utilization analytics require beta validation with live jobs. |
| Admin payments / reviews / compliance | Ready for beta | Admin review, stuck payout, compliance, and credit paths are implemented and tested. |
| Notifications | Partial | In-app activity works; SMS and push are explicitly disabled until providers are wired. |
| AI document processing | Blocked | No AI/OCR provider is implemented; document review remains manual/admin-driven. |

## Integration status

| Integration | Status | Production requirement |
|---|---|---|
| Stripe | Configurable | Live keys, live webhook, Connect Express verification, and mock mode disabled. |
| Google Maps | Configurable | Mobile SDK key required; API route/ETA service is not yet a server-side Maps integration. |
| Clerk | Configurable | Live publishable/secret keys and production domains required. |
| Email | Configurable | Resend key and verified sender domain required. |
| SMS | Disabled | No SMS provider is wired; device `sms:` links are not a notification system. |
| Push notifications | Disabled | No Expo push notification pipeline is wired. |
| Cloud storage | Configurable | R2 bucket, keys, public URL, and object prefixes required. |

## Remaining production blockers

- Live staging checklist has not been certified end-to-end with real Clerk, Stripe, R2, Resend, and Maps credentials.
- SMS and push notification preferences should stay disabled or be clearly labeled until providers are implemented.
- Live GPS is snapshot-based through status updates, not continuous background tracking.
- Route ETA uses placeholder math in the mobile tracking UI; no Google Routes/Distance Matrix API proxy is implemented yet.
- Database deployment still relies on `drizzle-kit push`; versioned migrations remain a production safety gap.
- Lint is listed in the go-live checklist, but the repo does not yet define lint scripts.

## Design-system readiness

- Web now has shared app-level primitives for full-screen loading, button loading content, and page empty states.
- Mobile now has reusable `ScreenHeader` and `LoadingCenter` primitives for gradual extraction without changing visuals.
- Next safe refactors: centralize status badges/styles, extract page shells/stat cards, and migrate remaining inline mobile empty/loading states.

## Performance improvements

- Existing lazy route loading is preserved.
- Tracking now polls status updates at a bounded interval instead of running a client-side fake timer loop.
- No bundle-size reduction has been measured yet in this pass; add a bundle report script before making performance claims.

## Build and test status

Verification for the current revision is pending. Required checks:

- `pnpm run typecheck`
- `pnpm --filter @workspace/api-server run test`
- `pnpm --filter @workspace/haulbrokr run test`
- `pnpm --filter @workspace/haulbrokr-mobile run test`
- `pnpm --filter @workspace/api-server run build`
- `pnpm --filter @workspace/haulbrokr run build`
- `pnpm run verify:deployment`
