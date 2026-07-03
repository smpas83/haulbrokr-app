# Design Implementation Guide

Updated: July 3, 2026

This document records how approved ChatGPT design packages are implemented in the HaulBrokr web app (`artifacts/haulbrokr`).

## Rules

1. **Implementation only** — do not redesign layouts, branding, or visual hierarchy.
2. **Use shared components** from `src/components/shared/` — no duplicated UI primitives.
3. **No inline colors or hardcoded styles** — use Tailwind semantic tokens from `index.css`.
4. **Role-safe views** — driver surfaces must redact customer pricing and broker margin.
5. **Async sections** must use `AppLoader`, `EmptyState`, `OfflineBanner`, skeletons, and retry.

---

## Shared component inventory (web)

| Component | Path | Purpose |
|-----------|------|---------|
| `PageHeader` | `components/shared/PageHeader.tsx` | Title, description, actions |
| `StatCard` | `components/shared/StatCard.tsx` | Metric tiles |
| `ActivityFeed` | `components/shared/ActivityFeed.tsx` | Recent activity list with deep links |
| `StatusBadge` | `components/shared/StatusBadge.tsx` | Job/presence status pills |
| `ProgressBar` | `components/shared/ProgressBar.tsx` | Load progress indicator |
| `AppLoader` | `components/shared/AppLoader.tsx` | Full-section loading |
| `EmptyState` | `components/shared/EmptyState.tsx` | Zero-data states |
| `OfflineBanner` | `components/shared/OfflineBanner.tsx` | Offline + retry |
| `MapContainer` | `components/shared/MapContainer.tsx` | Map placeholder / lazy shell |

Re-export barrel: `components/shared/index.ts`

---

## Package 2 — Driver Dashboard + Jobs

### Routes

| Route | Entry | Driver component |
|-------|-------|------------------|
| `/dashboard` | `pages/dashboard.tsx` | `pages/driver/DriverDashboard.tsx` |
| `/jobs` | `pages/jobs.tsx` | `pages/driver/DriverJobsBoard.tsx` |

Customer and provider flows are unchanged (`StandardDashboard`, `StandardJobsPage`).

### Driver-specific components

| Component | Path |
|-----------|------|
| `DriverLoadCard` | `components/driver/DriverLoadCard.tsx` |
| Driver utilities | `lib/driverJobView.ts` |
| Online presence hook | `hooks/useDriverOnline.ts` |
| Assignment hook | `hooks/useDriverAssignedJobs.ts` |

### Layout / navigation (`components/layout.tsx`)

When `profile.role === "driver"`:

- Jobs nav label → **Load Board**
- Hides Job Board (`/requests`) and Bin Rental
- Keeps Dashboard, Jobs, Account

### Data flow

```
useGetMyProfile → role gate
useListJobs → org-scoped jobs
useDriverAssignedJobIds → parallel GET /jobs/:id/tickets
redactJobForDriver → strip broker/customer fields, expose driverPay
categorizeDriverJob → available | accepted | in_progress | completed
```

### Redaction (`lib/driverJobView.ts`)

Removed before render:

- `customerTotalAmount`, `platformFeeAmount`, `platformFeeRate`, `totalAmount`, `notes`

Displayed pay: `driverPay` from `providerNetAmount` or `ratePerHour × hours`.

### Filters (client-side)

Material, truck type, facility (delivery address), deadline window, pay range, status.

Distance filter deferred — no distance field on Job API.

### Loading / empty / error

- Initial load: `AppLoader`
- Section refresh: `Skeleton` rows
- Empty tabs: `EmptyState` with contextual copy
- Network/API failure: `OfflineBanner` + Retry button
- Sticky mobile refresh on load board

### Accessibility

- Semantic headings via `PageHeader`
- `aria-busy`, `aria-live` on loaders
- `aria-pressed` on online toggle
- `motion-reduce:animate-none` on spinners/transitions
- Keyboard-focusable buttons and links (shadcn primitives)

### Performance

- `DriverLoadCard` wrapped in `React.memo`
- `MapContainer` lazy-loaded on dashboard
- Assignment + section lists memoized with `useMemo`

### Placeholders (document, do not remove without design approval)

| UI element | Status |
|------------|--------|
| Map route preview | Placeholder |
| Distance on cards | `—` |
| Live ETA | Derived from `scheduledDate` only |
| Shift API | Local online toggle |

---

## Verification commands

```bash
pnpm run typecheck
pnpm --filter @workspace/haulbrokr test
pnpm --filter @workspace/haulbrokr run build
```

---

## Next package

**Driver Job Detail** — not started. Stop after Package 2 per design program.
