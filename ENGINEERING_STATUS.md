# HaulBrokr Engineering Status

Updated: July 3, 2026

## Current implementation state

HaulBrokr is a pnpm monorepo with a React/Vite web app, Expo mobile app, Express API server, and generated shared API libraries. The primary frontend implementation surface is `artifacts/haulbrokr`; mobile lives in `artifacts/haulbrokr-mobile`.

## Completed web surfaces

- Public landing, support, privacy, auth, onboarding, and dashboard routes.
- Marketplace request, bid, job, fleet, bin, project, company, account, payment, factoring, integrations, and admin surfaces.
- **Driver cockpit dashboard** (`/dashboard` when `role=driver`) — Package 2.
- **Driver load board** (`/jobs` when `role=driver`) — Package 2.
- **Driver job detail hub** (`/jobs/:id` when `role=driver`) — Package 3.
- Shared driver-facing UI components under `artifacts/haulbrokr/src/components/shared/`.
- shadcn/Radix UI primitives in `artifacts/haulbrokr/src/components/ui`.
- Dark-first Tailwind token foundation in `artifacts/haulbrokr/src/index.css`.
- Clerk, Stripe, TanStack Query, generated API client, and hand-written `apiFetch` integration paths.

## Package 3 — Driver Job Detail (July 3, 2026)

### Implemented

| Route | Driver experience |
|-------|-------------------|
| `/jobs/:id` | Single-screen operational hub: header, assignment card, live timeline, facility, documents, map, earnings, notes, activity, sticky quick actions |

### APIs consumed

- `GET /jobs/:id`, `GET/POST /jobs/:id/tickets`, `POST /tickets/:id/clock-in`
- `GET/POST /jobs/:id/evidence`, `GET/POST /jobs/:id/status-updates`
- `POST /jobs/:id/messages`, `GET /dump-sites`, `GET /organizations/members`, `GET /trucks`
- `GET /dashboard/activity` (filtered to current job)

### Redaction rules (verified in UI)

Drivers never see customer total, platform fees, broker margin, or internal `notes`. Earnings section shows driver pay only.

### Remaining placeholders

- Facility hours, gate/scale/unload instructions, open/busy/closed, wait time (no enriched facility API).
- Scale ticket and bill of lading document types (no dedicated API fields).
- Live GPS route, traffic, and current location on map.
- Bonus, waiting time, and fuel adjustment earnings lines (zeroed until payroll API).
- Mobile app not updated in this package — web only.

## Package 2 — Driver Dashboard + Jobs (July 3, 2026)

See `DESIGN_IMPLEMENTATION_GUIDE.md` for dashboard and load board inventory.

## Implementation posture

- No new screen implementation should proceed without an approved ChatGPT design package.
- New UI work should extend existing tokens and shared components before adding new primitives.
- API-connected frontend work should prefer generated client hooks where the OpenAPI contract exists.

## Known blockers and gaps

- Live production E2E workflows require staging or production credentials.
- Mobile live GPS tracking, push notifications, and durable offline recovery are not production-complete.
- Server-side payment field redaction for drivers is not implemented; redaction is UI-layer only.
- OpenAPI coverage is incomplete for ticket POST body (hand-written `apiFetch` used on detail uploads).

## Documentation status

- `DESIGN_IMPLEMENTATION_GUIDE.md` — Packages 2 and 3 implementation inventory.
- `BETA_TEST_REPORT.md` — verification baseline including Package 3.
- `docs/HAULBROKR_AUDIT.md` — architecture audit.

## Latest verification

See `BETA_TEST_REPORT.md` for Package 3 typecheck, test, and build results (July 3, 2026).

## Next implementation gate

Wait for the next approved ChatGPT design package (Package 4+).
