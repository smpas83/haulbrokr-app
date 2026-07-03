# HaulBrokr Design Implementation Guide

**Audience:** Frontend engineers implementing ChatGPT-provided designs  
**Stack:** React 19 · Vite · Tailwind v4 · shadcn/ui (new-york) · wouter · TanStack Query

## Design System Location

| Layer | Path | Purpose |
|-------|------|---------|
| Theme tokens | `artifacts/haulbrokr/src/index.css` | HSL variables, landing utilities, reduced-motion |
| shadcn primitives | `artifacts/haulbrokr/src/components/ui/*` | Buttons, cards, dialogs, skeletons, empty states |
| Shared app components | `artifacts/haulbrokr/src/components/shared/*` | Cross-screen patterns |
| Status styling | `artifacts/haulbrokr/src/lib/status-styles.ts` | Domain status color maps |
| App shell | `artifacts/haulbrokr/src/components/layout.tsx` | Sidebar, mobile tabs, offline banner |
| shadcn config | `artifacts/haulbrokr/components.json` | Aliases, style preset |

## Shared Components (Use These — Do Not Duplicate)

### `AppLoader` — `components/shared/app-loader.tsx`
Full-screen loading for auth boundaries and lazy routes.

### `StatCard` — `components/shared/stat-card.tsx`
KPI tiles. Props: `title` or `label`, `value`, `icon`, `accent`, `sub`/`hint`, `variant="compact"` for admin.

### `StatusBadge` — `components/shared/status-badge.tsx`
Domain-aware status pills. Props: `status`, `domain` (`request` | `job` | `project` | `bin` | `factoring`).

### `PageHeader` — `components/shared/page-header.tsx`
Standard page title + description + optional action slot.

### `PageLoadingSkeleton` / `PageErrorState` / `PageEmptyState` / `OfflineBanner` — `components/shared/page-states.tsx`
Async screen states. Every new screen should use these.

### `ActivityFeed` — `components/shared/activity-feed.tsx`
Notification-style activity list from dashboard API. Handles deep links to jobs and bin orders.

### `ProgressBar` — `components/shared/progress-bar.tsx`
Accessible budget/progress bars (replaces inline `style={{ width }}`).

## Hooks

| Hook | Path | Use |
|------|------|-----|
| `useReverseGeocode` | `hooks/use-reverse-geocode.ts` | Browser GPS → address (bins, request-new) |
| `useOnlineStatus` | `hooks/use-online-status.ts` | Offline banner in layout |
| `useToast` | `hooks/use-toast.ts` | User feedback (canonical notification UX) |

## Landing Page Tokens

Defined in `index.css` `@layer utilities`:

- `.industrial-panel` — bordered panel with primary gradient overlay
- `.neon-orange` — primary glow shadow
- `.text-haulbrokr-glow` — headline text shadow

Landing page intentionally uses marketing hex values (`#ff6a00`, `#070707`) alongside these utilities. Do not refactor landing colors to CSS variables without an explicit design update.

## Layout Conventions

- **Border radius:** `rounded-none` (industrial aesthetic)
- **Cards:** `border-2 border-border`
- **Primary actions:** shadcn `Button` with `font-bold`
- **Page container:** `max-w-6xl mx-auto space-y-6`
- **Enter animation:** `animate-in fade-in duration-500`

## Screen Implementation Checklist

When implementing a new design spec:

1. Use `PageHeader` for title block
2. Wrap async content with `PageLoadingSkeleton` / `PageErrorState` / `PageEmptyState`
3. Use `StatusBadge` for any status pill — never copy `STATUS_COLORS` maps
4. Use `@/lib/apiFetch` or generated hooks — never duplicate fetch helpers
5. Use shadcn `Skeleton` for inline loading
6. Verify responsive at 375px, 768px, 1024px, 1280px
7. Verify keyboard focus and ARIA on interactive elements
8. Run `pnpm test && pnpm run typecheck && pnpm run build`

## Map Experience (Web)

The web app currently shows addresses with `MapPin` icons only. There is **no embedded map component**. Map polish (markers, routes, ETA, realtime refresh) applies to:

- **Mobile app:** `artifacts/haulbrokr-mobile`
- **Future web map:** blocked on product spec — do not invent map UI

## Notification Types (Activity Feed)

The dashboard activity API surfaces these event types with styled indicators:

| Type | Treatment | Deep Link |
|------|-----------|-----------|
| `bin_*` | Violet dot | `/bins?order=<id>` |
| `payment_failed`, `application_rejected` | Red | `/jobs/<id>` |
| `payment_requires_action`, `payout_delayed` | Amber | `/jobs/<id>` |
| `application_approved` | Green | — |
| Default dispatch/payment events | Primary | — |

Toast notifications via `useToast()` remain the primary real-time feedback channel.

## Do Not

- Add new backend endpoints or business workflows
- Redesign layouts without a spec
- Duplicate buttons, cards, badges, loaders, or status color maps
- Leave `console.log` or `TODO` comments in production code
- Wire Sonner unless design explicitly replaces Radix toast
