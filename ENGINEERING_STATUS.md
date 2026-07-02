# HaulBrokr Engineering Status

Updated: July 2, 2026

## Current implementation state

HaulBrokr is a pnpm monorepo with a React/Vite web app, Expo mobile app,
Express API server, and generated shared API libraries. The primary frontend
implementation surface is `artifacts/haulbrokr`; mobile lives in
`artifacts/haulbrokr-mobile`.

## Completed web surfaces

- Public landing, support, privacy, auth, onboarding, and dashboard routes.
- Marketplace request, bid, job, fleet, bin, project, company, account, payment,
  factoring, integrations, and admin surfaces.
- shadcn/Radix UI primitives in `artifacts/haulbrokr/src/components/ui`.
- Dark-first Tailwind token foundation in `artifacts/haulbrokr/src/index.css`.
- Clerk, Stripe, TanStack Query, generated API client, and hand-written
  `apiFetch` integration paths.

## Implementation posture

- No new screen implementation should proceed without an approved ChatGPT design
  package.
- New UI work should extend existing tokens and components before adding new
  primitives.
- API-connected frontend work should prefer generated client hooks where the
  OpenAPI contract exists.
- Production readiness remains gated by staging credentials and live workflow
  certification.

## Known blockers and gaps

- Live production E2E workflows require staging or production credentials for
  Clerk, Stripe, webhooks, object storage, email, maps, and deployed health
  checks.
- Mobile live GPS tracking, push notifications, and durable offline recovery are
  not production-complete.
- Supervisor onboarding is not exposed as a first-class web onboarding option.
- Factoring approval is API-backed but lacks a dedicated admin tab.
- QuickBooks integration is simulated and should not be marketed as live.
- OpenAPI coverage is incomplete, causing some frontend flows to rely on
  hand-written API calls.
- Versioned database migrations are not present.

## Documentation status

- `DESIGN_IMPLEMENTATION_GUIDE.md` records the frontend implementation rules.
- `BETA_TEST_REPORT.md` records the current beta verification baseline.
- `docs/HAULBROKR_AUDIT.md` remains the architecture audit and launch guide.
- `KNOWN_ISSUES.md` remains the source for prioritized technical blockers.

## Next implementation gate

Wait for the next ChatGPT-approved design package, then implement the specified
routes and states exactly as designed.
