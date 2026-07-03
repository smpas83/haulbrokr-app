# HaulBrokr Engineering Status

Updated: July 3, 2026

## Current implementation state

HaulBrokr is a pnpm monorepo with a React/Vite web app, Expo mobile app, Express API server, and generated shared API libraries. The primary frontend implementation surface is `artifacts/haulbrokr`; mobile lives in `artifacts/haulbrokr-mobile`.

## Completed web surfaces

- Public landing, support, privacy, auth, onboarding, and dashboard routes.
- Marketplace request, bid, job, fleet, bin, project, company, account, payment, factoring, integrations, and admin surfaces.
- **Driver cockpit dashboard** (`/dashboard` when `role=driver`) — Package 2.
- **Driver load board** (`/jobs` when `role=driver`) — Package 2.
- Shared driver-facing UI components under `artifacts/haulbrokr/src/components/shared/`.
- shadcn/Radix UI primitives in `artifacts/haulbrokr/src/components/ui`.
- Dark-first Tailwind token foundation in `artifacts/haulbrokr/src/index.css`.
- Clerk, Stripe, TanStack Query, generated API client, and hand-written `apiFetch` integration paths.

## Package 2 — Driver Dashboard + Jobs (July 3, 2026)

### Implemented

| Route | Driver experience |
|-------|-------------------|
| `/dashboard` | Driver cockpit: presence, shift stats, current job card, quick actions, earnings/compliance/notifications |
| `/jobs` | Load board with Available / Accepted / In Progress / Completed tabs and client-side filters |

### APIs consumed

- `GET /api/jobs` — org-scoped job list (`useListJobs`)
- `GET /api/jobs/:id/tickets` — driver assignment detection (`useDriverAssignedJobIds`)
- `POST /api/jobs/:id/tickets` — self-assign / accept available load
- `GET /api/dashboard/activity` — recent activity + notifications
- `GET /api/account/status` — compliance (CDL/DOT, W-9)
- `GET /api/profile/me` — role routing

### Redaction rules (verified in UI)

Drivers never see:

- `customerTotalAmount`
- `platformFeeAmount` / `platformFeeRate`
- `totalAmount` (customer bill)
- Internal broker `notes`

Driver pay is shown via `providerNetAmount` when present, otherwise `ratePerHour × estimatedHours`.

### Remaining placeholders

- **Distance filter / ETA**: no geocoding or live GPS on web driver board; distance shows `—`.
- **Route map**: `MapContainer` placeholder until live map wiring (see jobs map work).
- **Shift tracking**: local online/offline toggle only; no server-side shift API.
- **Dashboard stats API**: driver metrics computed client-side from jobs + tickets (no dedicated driver stats endpoint).
- **Driver Job Detail**: out of scope for Package 2.

## Implementation posture

- No new screen implementation should proceed without an approved ChatGPT design package.
- New UI work should extend existing tokens and shared components before adding new primitives.
- API-connected frontend work should prefer generated client hooks where the OpenAPI contract exists.

## Known blockers and gaps

- Live production E2E workflows require staging or production credentials.
- Mobile live GPS tracking, push notifications, and durable offline recovery are not production-complete.
- Server-side payment field redaction for drivers is not implemented; redaction is UI-layer only.
- OpenAPI coverage is incomplete for some ticket/evidence routes (hand-written `apiFetch` used).

## Documentation status

- `DESIGN_IMPLEMENTATION_GUIDE.md` — frontend implementation rules and Package 2 inventory.
- `BETA_TEST_REPORT.md` — verification baseline including Package 2 commands.
- `docs/HAULBROKR_AUDIT.md` — architecture audit.

## Latest verification

See `BETA_TEST_REPORT.md` for Package 2 typecheck, test, and build results (July 3, 2026).

## Next implementation gate

**Driver Job Detail** — wait for the next approved ChatGPT design package (Package 3).
