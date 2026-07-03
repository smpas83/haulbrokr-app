# HaulBrokr Engineering Status

Last updated: July 3, 2026 — Packages 6–10 final implementation sprint.

## Summary

| Area | Status | Notes |
|------|--------|-------|
| Shared design system (web) | Complete | 10 shared components in `artifacts/haulbrokr/src/components/shared/` |
| Admin Command Center | Complete | KPI ribbon, map placeholder, ops/revenue/compliance/support/health panels, activity feed, timeline drawer |
| Public website | Complete | Landing + 9 standalone pages, prerendered, lazy-loaded |
| Application polish (web) | In progress | Dashboard + Admin migrated; account/documents retain local StatusBadge |
| Performance | Improved | Lazy public routes, `auth-shell` manual chunk, memoized shared components |
| Mobile | Stable | Uses local StatCard/EmptyState; `useLiveApi` migration remains |
| Build | Green | typecheck, 399 tests, production build |
| Closed Beta | Ready pending live env QA | See blockers below |

## Completed Screens (Web)

### Authenticated
- Dashboard, Requests, Request Detail, New Request
- Jobs, Job Detail
- Fleet, Fleet New/Edit
- Account, Company, Bins, Bin Detail
- Projects, Project Detail
- Factoring, Integrations, Mobile Payment
- Onboarding, Admin Login, Admin Command Center

### Public
- `/` Landing
- `/features`, `/industries`, `/pricing`, `/about`, `/contact`
- `/support`, `/privacy`, `/terms`

## Shared Component Adoption

| Component | Location | Adopted by |
|-----------|----------|------------|
| PageHeader | `components/shared/PageHeader.tsx` | Dashboard, Admin Command Center |
| StatCard | `components/shared/StatCard.tsx` | Dashboard, Admin Command Center |
| ActivityFeed | `components/shared/ActivityFeed.tsx` | Dashboard, Admin Command Center |
| StatusBadge | `components/shared/StatusBadge.tsx` | Available; account/documents use local variants |
| ProgressBar | `components/shared/ProgressBar.tsx` | Available |
| AppLoader | `components/shared/AppLoader.tsx` | App, AuthShell |
| EmptyState | `components/shared/EmptyState.tsx` | Admin tabs |
| OfflineBanner | `components/shared/OfflineBanner.tsx` | AuthShell |
| MapContainer | `components/shared/MapContainer.tsx` | Admin Command Center |
| AsyncSection | `components/shared/AsyncSection.tsx` | Admin Command Center |

## Legacy Components Remaining

- `account.tsx` — local `StatusBadge` (compliance-specific labels)
- `components/documents.tsx` — local `StatusBadge` with expiry logic
- `components/admin-insights.tsx` — `DocStatusBadge`, inline `MetricCard`
- Mobile — `StatCard`, `EmptyState`, `StatusBadge` in `artifacts/haulbrokr-mobile/components/`

## API Coverage

- Web authenticated flows: generated `@workspace/api-client-react` hooks
- Admin analytics drill-downs: raw `apiFetch` to documented server routes (not yet in OpenAPI)
- Mobile: hand-written `useLiveApi.ts`
- Simulated: QuickBooks integration

## Production Blockers

1. Live staging/production E2E not certified in this workspace (see `KNOWN_ISSUES.md`)
2. Mobile live GPS and push notifications not implemented
3. Admin expanded endpoints not in OpenAPI/codegen
4. Factoring approval UI not exposed as admin tab

## Build & Test Status

```
pnpm run typecheck  — PASS
pnpm test (api-server) — 318 passed
pnpm test (haulbrokr) — 11 passed
pnpm test (haulbrokr-mobile) — 70 passed
pnpm run build — PASS (web prerender: 10 routes)
```

## Environment Requirements

See `ENVIRONMENT_INVENTORY.md` and `MIGRATION_TO_CURSOR.md` for full variable list. Minimum for closed beta:

- Clerk (web + API + mobile keys)
- Postgres `DATABASE_URL`
- Stripe keys + webhook secret
- Resend API key
- R2 object storage credentials
- `ADMIN_USER_IDS`, `STAFF_AUTH_SECRET`, upload/ticket secrets
