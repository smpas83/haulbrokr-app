# HaulBrokr Engineering Status

Updated: July 3, 2026

## Current implementation state

HaulBrokr is a pnpm monorepo with a React/Vite web app, Expo mobile app,
Express API server, and generated shared API libraries. The primary frontend
implementation surface is `artifacts/haulbrokr`; mobile lives in
`artifacts/haulbrokr-mobile`.

## Completed web surfaces

- Public landing, support, privacy, auth, onboarding, and dashboard routes.
- Marketplace request, bid, job, fleet, bin, project, company, account, payment,
  factoring, integrations, and admin surfaces.
- **Fleet Owner Command Center (Package 5)** — provider `/dashboard` routes to
  `FleetDashboard` with KPI ribbon, live fleet map placeholder, fleet grid,
  driver status, revenue, compliance, maintenance placeholders, timeline drawer,
  and notifications via existing activity feed.
- Shared dashboard components in `artifacts/haulbrokr/src/components/shared/`.
- shadcn/Radix UI primitives in `artifacts/haulbrokr/src/components/ui`.
- Dark-first Tailwind token foundation in `artifacts/haulbrokr/src/index.css`.
- Clerk, Stripe, TanStack Query, generated API client, and hand-written
  `apiFetch` integration paths.

## Fleet Dashboard — APIs consumed

| API | Hook | Usage |
|-----|------|-------|
| `GET /dashboard/stats` | `useGetDashboardStats` | Active jobs, completed loads, lifetime revenue |
| `GET /dashboard/activity` | `useGetDashboardActivity` | Notifications and activity feed |
| `GET /trucks` | `useListTrucks` | Fleet grid, KPIs, map markers |
| `GET /jobs` | `useListJobs` | Active jobs, truck assignment context |
| `GET /organizations/members` | `useListOrgMembers` | Driver status panel |
| `GET /wallet` | `useGetWallet` | Revenue panel, today's/weekly/monthly earnings |
| `GET /account/status` | `useGetAccountStatus` | Compliance gating |
| `GET /organizations/compliance-status` | `useGetOrganizationComplianceStatus` | Compliance score and panel |
| `GET /account/compliance` | `useGetCompliance` | DOT status |
| `GET /dump-sites` | `useListDumpSites` | Map facility context |
| `GET /jobs/:id/status-updates` | fetch (timeline) | Fleet timeline drawer |

## Performance improvements

- Lazy-loaded map, timeline, revenue, and compliance sections via `React.lazy` + `Suspense`.
- Memoized fleet components (`memo`) and KPI/revenue computations (`useMemo`).
- Timeline query uses 30s stale time to avoid unnecessary refetches.

## Accessibility improvements

- Semantic HTML: `header`, `section`, `article`, `aside`, `dl`, `time`, `role="feed"`.
- ARIA labels on KPI sections, fleet grid cards, timeline groups, and map.
- Keyboard-accessible collapsible timeline drawer and resizable panel handle.
- `motion-reduce:animate-none` on animated sections.
- Screen-reader labels on loading states and notification badges.

## Remaining placeholders

- Fleet selector (multi-fleet switching)
- Live weather widget
- Interactive map (markers, routes, clustering, traffic layer)
- Hours worked per truck
- Vehicle health telemetry
- License and medical expiration dates
- Average driver earnings
- Live ETA from tracking API
- Message driver / call driver actions
- Maintenance tracking (all fields)

## Known blockers and gaps

- Live production E2E workflows require staging or production credentials.
- Mobile live GPS tracking, push notifications, and durable offline recovery are
  not production-complete.
- Admin Dashboard (Package 6+) not started — awaiting Fleet Dashboard review.

## Documentation status

- `DESIGN_IMPLEMENTATION_GUIDE.md` records the frontend implementation rules.
- `BETA_TEST_REPORT.md` records the current beta verification baseline.
- `docs/HAULBROKR_AUDIT.md` remains the architecture audit and launch guide.

## Next implementation gate

Wait for Fleet Dashboard review and approval before beginning Admin Dashboard.
