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

**Package 4+** — wait for the next approved ChatGPT design package.

---

## Package 3 — Driver Job Detail (Production)

### Route

| Route | Entry | Driver component |
|-------|-------|------------------|
| `/jobs/:id` | `pages/job-detail.tsx` (role gate) | `pages/driver/DriverJobDetail.tsx` |

When `profile.role === "driver"`, the standard multi-role job detail page is bypassed in favor of the operational hub layout.

### Section order (vertical scroll)

1. **Header** — job number, status badge, driver pay, material, ETA, online/offline
2. **Primary Action Card** — assignment summary, navigate / call / message / facility, check-in
3. **Live Progress** — 11-step timeline from `resolveDriverProgress`
4. **Facility Information** — dump-site directory match + design placeholders for hours/instructions
5. **Documents** — load ticket, scale, BOL, POD, photos with upload/preview/replace
6. **Map** — lazy `MapContainer` with route placeholder
7. **Earnings** — driver pay breakdown only
8. **Job Notes** — driver/site/safety fields (broker notes redacted)
9. **Activity** — filtered `ActivityFeed` for this job
10. **Quick Actions** — sticky bottom bar on mobile

### APIs consumed

| Endpoint | Hook / usage |
|----------|----------------|
| `GET /jobs/:id` | `useGetJob` |
| `GET /jobs/:id/tickets` | `useListJobTickets` |
| `POST /jobs/:id/tickets` | `apiFetch` (photo body not in OpenAPI) |
| `POST /tickets/:id/clock-in` | `useClockInTicket` |
| `GET /jobs/:id/evidence` | `useListJobEvidence` |
| `POST /jobs/:id/evidence` | `useCreateJobEvidence` |
| `GET /jobs/:id/status-updates` | `useListJobStatusUpdates` |
| `POST /jobs/:id/status-updates` | `useCreateJobStatusUpdate` |
| `GET /jobs/:id/messages` | (message dispatcher via `useCreateJobMessage`) |
| `GET /dump-sites` | `useListDumpSites` |
| `GET /organizations/members` | `useListOrgMembers` (dispatcher phone) |
| `GET /trucks` | `useListTrucks` (assigned truck label) |
| `GET /dashboard/activity` | `useGetDashboardActivity` (filtered per job) |

### Utilities (`lib/driverJobView.ts`)

- `DRIVER_LIVE_PROGRESS_STEPS`, `resolveDriverProgress`, `liveProgressPercent`
- `matchDumpSiteForAddress`, `computeRemainingTime`
- `computeDriverEarningsBreakdown`, `buildDriverDocumentCards`
- `filterActivityForJob`

### Loading / empty / error

- Page load: `AppLoader`
- Sections: `Skeleton` while fetching
- Not found: `EmptyState`
- Offline / API error: `OfflineBanner` + retry
- Unassigned driver: alert in primary action card

### Accessibility

- Timeline uses `aria-current="step"` on active step
- Map uses `role="img"` + `aria-label`
- Sticky quick actions in `role="region"` with `aria-label`
- `motion-reduce:animate-none` on page enter animation

### Performance

- `MapContainer` lazy-loaded via `React.lazy` + `Suspense`
- Job-derived lists memoized with `useMemo`
- Activity filtered client-side to current job

### Placeholders (design package pending)

| UI element | Status |
|------------|--------|
| Facility hours / gate / scale / unload / safety | Placeholder copy |
| Facility open/busy/closed + wait time | Placeholder copy |
| Scale ticket / BOL document cards | Placeholder — no API fields |
| Live GPS / traffic on map | Placeholder in `MapContainer` |
| Bonus / waiting / fuel line items | `$0` until payroll API exists |
| Required PPE / special requirements detail | Placeholder copy |
