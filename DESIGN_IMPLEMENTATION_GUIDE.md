# HaulBrokr Design Implementation Guide

Implementation reference for engineers applying the ChatGPT visual design package. **Do not invent layouts, colors, or motion in code** — wire placeholders until design tokens arrive.

## Design System Location

```
artifacts/haulbrokr/src/components/shared/
├── PageHeader.tsx      — Page title, description, actions
├── StatCard.tsx        — KPI / metric tiles
├── ActivityFeed.tsx    — Timestamped event list
├── StatusBadge.tsx     — Compliance / workflow status
├── ProgressBar.tsx     — Percentage progress (wraps shadcn Progress)
├── AppLoader.tsx       — Full-screen / section spinner
├── EmptyState.tsx      — Zero-data states
├── OfflineBanner.tsx   — Network offline alert
├── MapContainer.tsx    — Map shell with layer placeholders
├── AsyncSection.tsx    — Skeleton / error / retry / empty wrapper
└── index.ts
```

Import:

```tsx
import { PageHeader, StatCard, ActivityFeed, AsyncSection } from "@/components/shared";
```

## Marketing Layout

```
artifacts/haulbrokr/src/components/marketing/MarketingLayout.tsx
```

Provides `MarketingHeader`, `MarketingFooter`, `MarketingPageHero`, and `MarketingLayout` wrapper for public pages.

## Token-Driven Styling

- Authenticated app: Tailwind + shadcn/Radix in `components/ui/`
- Marketing: existing landing tokens (`#ff6a00`, `#070707`, `industrial-panel`, `neon-orange`)
- Clerk appearance: configured in `AuthShell.tsx` (primary amber, square corners)

## Loading State Pattern

Every async screen should use `AsyncSection`:

```tsx
<AsyncSection
  title="Section title"
  isLoading={query.isLoading}
  isError={query.isError}
  isEmpty={!query.data?.length}
  onRetry={() => query.refetch()}
  emptyTitle="No items"
  emptyDescription="Description when empty."
>
  {/* content */}
</AsyncSection>
```

## Map Placeholders

`MapContainer` renders layer chips for:

- Live GPS, Markers, Routes, Traffic, Weather, Geofence, Clusters, ETA

Replace inner placeholder when Google Maps / Mapbox integration ships. **No backend changes required.**

## Admin Command Center Structure

`components/admin-command-center.tsx`:

1. Executive Header (`PageHeader`)
2. Marketplace KPI Ribbon (`StatCard` grid)
3. Marketplace Map (`MapContainer`)
4. Operations / Revenue / Compliance / Support panels
5. Marketplace Health panel
6. Activity Feed (from `/admin/jobs?limit=12`)
7. Timeline Drawer (`Sheet` — visual timeline PLACEHOLDER)
8. `AdminInsights` — charts and drill-down dialogs

## Public Website Routes

| Route | Page | Prerender |
|-------|------|-----------|
| `/` | `landing.tsx` | Yes |
| `/features` | `features.tsx` | Yes |
| `/industries` | `industries.tsx` | Yes |
| `/pricing` | `pricing.tsx` | Yes |
| `/about` | `about.tsx` | Yes |
| `/contact` | `contact.tsx` | Yes |
| `/support` | `support.tsx` | Yes |
| `/privacy` | `privacy.tsx` | Yes |
| `/terms` | `terms.tsx` | Yes |

## PLACEHOLDER Comments (awaiting ChatGPT visual package)

Search codebase for `PLACEHOLDER` to find:

- Map live layers and styling
- Admin timeline drawer visual design
- Pricing comparison table layout
- Contact form UI
- Premium motion / animation specs

## Accessibility Checklist

- Shared components use `role`, `aria-live`, `aria-busy`, `aria-label` where applicable
- Focus rings on interactive StatCards and ActivityFeed links
- Semantic headings via `PageHeader` (`h1`) and panel titles
- Reduced motion: respect `prefers-reduced-motion` when adding animations from design package

## Responsive Breakpoints

Tailwind defaults: `sm` 640px, `md` 768px, `lg` 1024px, `xl` 1280px.

Admin Command Center uses `lg:grid-cols-2` panels and `xl:grid-cols-6` KPI ribbon.

## Do Not

- Create duplicate API clients or backend routes
- Redesign layouts or invent brand colors
- Add new business logic beyond existing API contracts
