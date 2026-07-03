# HaulBrokr Design Implementation Guide

Updated: July 3, 2026

## Implementation rule

Do not redesign screens. Do not invent layouts, substitute components, simplify
the design, or change branding decisions. When a design package is ambiguous,
mark a clearly labeled PLACEHOLDER and wait for the ChatGPT visual package.

## Package 5 — Fleet Owner Dashboard (completed)

### Route

- Providers visiting `/dashboard` render `FleetDashboard`.
- Fleet management CRUD remains at `/fleet`, `/fleet/new`, `/fleet/:id/edit`.

### Layout structure

1. **Header (72px)** — `FleetTopBar`: company name, fleet selector placeholder, search, notifications, date/time, weather placeholder, profile avatar.
2. **KPI Ribbon** — 8 `StatCard` components: fleet size, drivers online, available trucks, active jobs, completed today, today's revenue, fleet utilization %, compliance score.
3. **Live Fleet Map** — `MapContainer` with truck/job data from existing APIs.
4. **Fleet Grid** — responsive truck cards with driver, status, job, quick actions.
5. **Right panel (stacked on tablet/mobile)** — notifications (`ActivityFeed`), driver status, revenue, compliance, maintenance.
6. **Timeline Drawer** — bottom collapsible, grouped by truck, from job status-update API.

### Shared components reused

`PageHeader`, `StatCard`, `ActivityFeed`, `StatusBadge`, `ProgressBar`, `AppLoader`, `EmptyState`, `OfflineBanner`, `MapContainer`, `AsyncSection` — all in `src/components/shared/`.

### Loading states

Every async section supports loading (skeleton), retry, offline (`OfflineBanner`), error, and empty via `AsyncSection` and component-level handling.

### Security

- No broker profit, margins, or customer internal notes exposed.
- Role-based filtering preserved — providers see only their org trucks, drivers, and jobs.

## Validation workflow

For each concrete design package, run:

- `pnpm run typecheck`
- `pnpm --filter @workspace/haulbrokr test`
- `pnpm --filter @workspace/haulbrokr run build`

## Next gate

Admin Dashboard implementation waits for Fleet Dashboard review and approval.
