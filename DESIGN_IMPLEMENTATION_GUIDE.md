# HaulBrokr Design Implementation Guide

**Audience:** Frontend engineers implementing ChatGPT-owned design decisions.

## Principle

Do **not** invent layouts, branding, typography, or color decisions in code. Use the shared design system. When a visual decision is pending from the premium design package, leave a clearly marked `PLACEHOLDER` comment or UI label.

## Design System Location

```
artifacts/haulbrokr/src/
├── components/design/     # HaulBrokr-specific shared components
├── components/ui/         # shadcn/ui primitives (new-york, neutral)
├── index.css              # CSS tokens — "Industrial Luxury" dark-first theme
└── lib/design-tokens.ts   # Chart colors, status maps
```

## Required: PageHeader

Every authenticated page must use `PageHeader`:

```tsx
import { PageHeader } from "@/components/design";

<PageHeader
  eyebrow="Operations"           // optional section label
  title="Live Operations Map"
  description="Nationwide loads and fleet trucks."
  breadcrumb={[
    { label: "Active Jobs", href: "/jobs" },
    { label: "Job #42" },
  ]}
  toolbar={<FilterBar />}        // optional filters below header
  actions={<Button>Action</Button>}
  badge={<StatusChip />}         // optional status above title
/>
```

### Pages using PageHeader (100% of authenticated routes)

Dashboard, Requests, Request New/Detail, Jobs, Job Detail, Fleet, Fleet New, Map, Dispatch, Projects, Project Detail, Bins, Bin Detail, Company, Factoring, Integrations, Account, Notifications, Admin.

### Exempt pages (marketing/auth shells — custom hero headers)

Landing, Auth, Onboarding, Support, Privacy, 404, Mobile Payment.

## Global Search

- Component: `src/components/global-search.tsx`
- Trigger: Desktop top bar + mobile search bar + `⌘K` / `Ctrl+K`
- Data: Existing list APIs (requests, jobs, trucks, projects, bin orders, org members)
- PLACEHOLDER: Invoices (no list API in OpenAPI)

## Notification Center

- Page: `/notifications`
- Hook: `useNotifications()` wraps `useGetDashboardActivity`
- Read state: `localStorage` key `haulbrokr:notifications:lastReadAt`
- PLACEHOLDER: Web push via service worker + `/notifications/register`

## Map

- Component: `src/components/map/map-container.tsx`
- Types: `src/lib/map-types.ts`
- Loader: `src/lib/google-maps.ts`

### Active layers

- Load markers (circle)
- Fleet truck markers (arrow)
- Demand heat zones (circles)

### PLACEHOLDER layers (UI badges in map page toolbar)

Live GPS, Traffic, Weather, ETA, Facility Status, Geofence, Selected Vehicle, Driver Route, MarkerClusterer

## Empty & Loading States

Use shared components — do not duplicate:

- `EmptyState` — dashed border, icon, title, description, optional action
- `KpiSkeletonGrid` / `TableSkeleton` — loading placeholders
- `StatusChip` — status badges
- `SurfacePanel` / `GlassPanel` — card surfaces

## Settings Layout

Account page (`/account`) is the settings hub with role-gated tabs:

| Tab | Status |
|-----|--------|
| Status / Profile / W-9 / Insurance / Payout / DOT-CDL / Documents / Payment / Credit | Implemented |
| Notifications | Link to `/notifications` |
| Security | PLACEHOLDER — use Clerk account portal |
| Appearance | PLACEHOLDER — awaiting design tokens for theme toggle |
| Connected Accounts | Partial — Integrations page |
| Billing | Partial — Stripe in account tabs |
| API Keys | PLACEHOLDER |
| Support / Privacy / Terms | Public routes `/support`, `/privacy` |

## Accessibility Checklist

- Skip link in `layout.tsx` → `#main-content`
- Page titles via single `<h1>` in PageHeader
- Breadcrumb nav with `aria-label="Breadcrumb"`
- Map container: `role="application"` + descriptive `aria-label`
- Notification bell: dynamic `aria-label` with unread count
- Reduced motion: respect `prefers-reduced-motion` in CSS (existing)

## Do Not

- Create `Legacy*` or duplicate button/card/modal components
- Add custom page headers with raw `<h1>` on authenticated pages
- Build backend endpoints for polish work
- Make creative visual decisions — use PLACEHOLDER instead
