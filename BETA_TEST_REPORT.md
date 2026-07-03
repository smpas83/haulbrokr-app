# Beta Test Report

Last updated: 2026-07-03

## Customer Dashboard (Package 4)

### Test Scope

- Customer dashboard routing (`role === "customer"` → CustomerDashboard)
- Job view redaction utilities
- Activity feed bin deep-link contract
- Typecheck, unit tests, production build

### Automated Test Results

Run after implementation:

```bash
pnpm run typecheck
pnpm --filter @workspace/haulbrokr test
pnpm --filter @workspace/haulbrokr run build
```

| Check | Status |
|-------|--------|
| `pnpm run typecheck` | Pass |
| `pnpm --filter @workspace/haulbrokr test` | Pass (18 tests) |
| `pnpm --filter @workspace/haulbrokr run build` | Pass |

### Manual QA Checklist (Customer)

- [ ] Customer login lands on command center at `/dashboard`
- [ ] KPI ribbon shows 8 metrics with loading skeletons
- [ ] Map placeholder displays active job count badges
- [ ] Active job cards hide pricing; View Details links to `/jobs/:id`
- [ ] Activity feed shows newest events first with deep-links
- [ ] Documents panel lists latest tickets/evidence when available
- [ ] Facility status lists nearest dump sites
- [ ] Timeline drawer expands and groups events by job
- [ ] Quick actions navigate to correct routes
- [ ] Operations panel opens as bottom drawer on tablet/mobile
- [ ] Offline banner appears when network disconnected
- [ ] Provider dashboard unchanged at `/dashboard`

### Known Limitations

- Map is a structural placeholder (no live geocoding on web)
- Tons delivered and average ETA use placeholder values
- Global search input is not yet wired to search API
- Notification bell shows unread count from activity types; no mark-as-read API

### Accessibility Spot Checks

- [ ] Tab through header controls (search, notifications, avatar)
- [ ] Screen reader announces activity feed updates (`aria-live="polite"`)
- [ ] Timeline drawer toggle exposes `aria-expanded`
- [ ] Reduced motion: no slide/fade animations when `prefers-reduced-motion`
