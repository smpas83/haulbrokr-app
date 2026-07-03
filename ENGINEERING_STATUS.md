# Engineering Status

Last updated: 2026-07-03

## Customer Dashboard (Package 4) — Complete

The customer-facing **Customer Dashboard** transforms `/dashboard` into a logistics command center when `profile.role === "customer"`. Provider and driver flows are unchanged on this branch.

### Implemented

| Area | Status | Notes |
|------|--------|-------|
| Customer command center layout | Done | Top bar, KPI ribbon, map, active jobs, right operations panel, bottom timeline |
| Top header (72px) | Done | Company name, account selector placeholder, search, notifications, weather placeholder, date/time, profile avatar |
| KPI ribbon (8 cards) | Done | Active Jobs, Trucks En Route, Completed Today, Tons Delivered, Open Invoices, Average ETA, Active Facilities, On-Time Delivery % |
| Live map | Structural | MapContainer placeholder using job/truck data from existing APIs |
| Active job cards | Done | Status, driver/carrier, truck, material, pickup, dropoff, ETA; pricing and driver pay hidden |
| Activity feed | Done | Reuses `GET /dashboard/activity` via shared ActivityFeed |
| Documents panel | Done | Aggregates tickets + evidence from `GET /jobs/:id/tickets` and `GET /jobs/:id/evidence` |
| Facility status | Done | Reuses `GET /dump-sites` |
| Operations timeline | Done | Collapsible bottom drawer; reuses `GET /jobs/:id/status-updates` |
| Quick actions | Done | Request Haul, Repeat Previous Job, View Quotes, Download Documents, Invoices, Support |
| Notifications | Done | Unread count derived from existing activity feed engine |
| Shared components | Done | PageHeader, StatCard, ActivityFeed, StatusBadge, ProgressBar, AppLoader, EmptyState, OfflineBanner, MapContainer, AsyncSection |
| Provider dashboard | Unchanged | StandardDashboard for `role === "provider"` |
| Lazy loading | Done | Map, timeline, documents, activity feed |
| Loading / retry / empty / offline | Done | AsyncSection + shared patterns |

### APIs Consumed (no new endpoints)

- `GET /dashboard/stats`
- `GET /dashboard/activity`
- `GET /jobs`
- `GET /jobs/:id/tickets`
- `GET /jobs/:id/evidence`
- `GET /jobs/:id/status-updates`
- `GET /dump-sites`
- `GET /requests` (repeat previous job)

### Performance

- React `memo` on layout sections, KPI cards, job cards, activity feed, map container
- Lazy-loaded map, timeline, and documents via `React.lazy` + `Suspense`
- TanStack Query caching with 30–60s stale time on document/timeline aggregation
- Resizable panels on desktop avoid full-page re-renders

### Accessibility

- Semantic landmarks: `header`, `aside`, `section`, `role="feed"`, `role="list"`
- ARIA labels on search, notifications, resize handle, activity feed
- Keyboard-focusable controls via shadcn Button/Link primitives
- `motion-reduce:` classes on animated sections
- Screen reader labels on loading states (`aria-busy`, `sr-only`)

### Remaining Placeholders (ChatGPT Visual Package)

- Interactive map (driver locations, routes, geofence, weather layer)
- Tonnage delivered aggregation API
- Average ETA aggregation API
- On-time delivery precision API
- Facility wait times
- Live weather widget
- Account switcher (multi-org UI)
- Global search wiring
- Premium glass panel styling, animations, and color refinements

### Key Files

```
artifacts/haulbrokr/src/pages/customer/CustomerDashboard.tsx
artifacts/haulbrokr/src/pages/dashboard.tsx
artifacts/haulbrokr/src/components/customer/
artifacts/haulbrokr/src/components/shared/
artifacts/haulbrokr/src/hooks/useCustomerDashboardData.ts
artifacts/haulbrokr/src/lib/customerJobView.ts
```

### Build Verification

Run from repo root:

```bash
pnpm run typecheck
pnpm --filter @workspace/haulbrokr test
pnpm --filter @workspace/haulbrokr run build
```

Note: `pnpm run lint` is not configured in this monorepo.
