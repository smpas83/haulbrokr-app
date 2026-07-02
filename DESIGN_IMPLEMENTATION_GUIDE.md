# Design Implementation Guide

This document describes the design implementation layer prepared for rapid visual redesign. The codebase is structured so a new design system can be applied by updating tokens and theme values — not by rewriting screens.

## Architecture Overview

```
lib/design-tokens/          ← Single source of truth (colors, spacing, typography, etc.)
├── src/
│   ├── colors.ts
│   ├── typography.ts
│   ├── spacing.ts
│   ├── borderRadius.ts
│   ├── shadows.ts
│   ├── elevation.ts
│   ├── animation.ts
│   ├── zIndex.ts
│   ├── breakpoints.ts
│   ├── semantic.ts         ← Status, type, map colors
│   ├── themes.ts           ← createTheme(), lightTheme, darkTheme
│   └── css.ts              ← CSS variable generator for web

artifacts/haulbrokr/        ← Web app
├── src/theme/              ← ThemeProvider (next-themes + token bridge)
├── src/components/design-system/
├── src/layouts/
├── src/components/maps/
├── src/animations/
└── src/index.css           ← Tailwind + CSS custom properties

artifacts/haulbrokr-mobile/ ← Mobile app
├── theme/                  ← ThemeProvider (system scheme + token bridge)
├── components/design-system/
├── layouts/
├── components/maps/
├── animations/
└── constants/colors.ts     ← Legacy shim → design-tokens
```

## How to Apply a New Design System

1. **Update `lib/design-tokens`** — Replace color values, spacing scale, typography, shadows, animation durations/easings.
2. **Web CSS** — Update `:root` / `.dark` variables in `artifacts/haulbrokr/src/index.css` to match token values (HSL format for Tailwind).
3. **Theme provider** — No changes needed; `ThemeProvider` reads from `createTheme()`.
4. **Components** — Design-system components consume tokens automatically. Screens that still use hardcoded values need incremental migration (see Remaining Duplication below).

---

## Token Inventory

| Category | Location | Keys |
|----------|----------|------|
| Colors | `lib/design-tokens/src/colors.ts` | `background`, `foreground`, `primary`, `secondary`, `muted`, `accent`, `destructive`, `border`, `sidebar-*`, etc. |
| Typography | `lib/design-tokens/src/typography.ts` | `fontFamily`, `fontSize`, `fontWeight`, `lineHeight`, `letterSpacing` |
| Spacing | `lib/design-tokens/src/spacing.ts` | `0`–`32` (4px base) |
| Border radius | `lib/design-tokens/src/borderRadius.ts` | `none`, `sm`, `md`, `lg`, `xl`, `2xl`, `full` |
| Shadows | `lib/design-tokens/src/shadows.ts` | `none`, `xs`, `sm`, `md`, `lg`, `xl` |
| Elevation | `lib/design-tokens/src/elevation.ts` | `0`–`5` |
| Animation | `lib/design-tokens/src/animation.ts` | `durations`, `easings`, `presets` |
| Z-index | `lib/design-tokens/src/zIndex.ts` | `base`, `dropdown`, `modal`, `toast`, `map`, `mapOverlay`, etc. |
| Breakpoints | `lib/design-tokens/src/breakpoints.ts` | `xs`, `sm`, `md`, `lg`, `xl`, `2xl` |
| Semantic | `lib/design-tokens/src/semantic.ts` | `statusColor`, `typeColor`, `accentColor`, `mapColor` |

### Web CSS Variables (extended)

Defined in `artifacts/haulbrokr/src/index.css` under `@theme inline`:

- `--spacing-*`, `--duration-*`, `--easing-*`, `--z-*`, `--shadow-*`

---

## Component Inventory

### Web (`artifacts/haulbrokr/src/components/design-system/`)

| Component | Wraps / Composes | Token usage |
|-----------|------------------|-------------|
| `PrimaryButton` | shadcn `Button` variant=default | Tailwind semantic classes |
| `SecondaryButton` | shadcn `Button` variant=secondary | Tailwind semantic classes |
| `IconButton` | shadcn `Button` variant=ghost, size=icon | Tailwind semantic classes |
| `Card` | shadcn `Card` | Tailwind semantic classes |
| `MetricCard` | `Card` + header/content | `text-muted-foreground`, etc. |
| `StatCard` | `Card` + icon slot | Primary accent variant |
| `GlassCard` | `Card` + backdrop blur | `bg-card/80` |
| `Panel` | div | `border-border`, `bg-card` |
| `Modal` | shadcn `Dialog` | Re-export |
| `Drawer` | shadcn `Drawer` | Re-export |
| `Dialog` | shadcn `Dialog` | Re-export |
| `Table` | shadcn `Table` | Re-export |
| `DataGrid` | `Table` + column config | Composed |
| `Badge` | shadcn `Badge` | Re-export |
| `StatusPill` | `Badge` + `statusColor` token | Semantic status colors |
| `Avatar` | shadcn `Avatar` | Re-export |
| `Notification` | Custom | Semantic destructive/default |
| `EmptyState` | shadcn `Empty` | Re-export |
| `Skeleton` | shadcn `Skeleton` | Re-export |
| `LoadingSpinner` | shadcn `Spinner` | Re-export |
| `MapContainer` | Placeholder div | Neutral until map design defined |

### Mobile (`artifacts/haulbrokr-mobile/components/design-system/`)

Same component names as web. Built with React Native `StyleSheet` + `useColors()` / `useAppTheme()`.

**Re-exports from existing components:** `StatCard`, `EmptyState` (legacy paths preserved).

### Map Components

| Component | Web | Mobile |
|-----------|-----|--------|
| `TruckMarker` | `src/components/maps/` | `components/maps/` (react-native-maps `Marker`) |
| `DriverMarker` | ✓ | ✓ |
| `JobMarker` | ✓ | ✓ |
| `RoutePolyline` | SVG placeholder | `Polyline` from react-native-maps |
| `ETAOverlay` | ✓ | ✓ |
| `FleetLayer` | ✓ | ✓ |
| `CustomerLayer` | ✓ | ✓ |

Map colors come from `mapColor` in `lib/design-tokens/src/semantic.ts`.

---

## Animation Wrappers

| Wrapper | Web (`src/animations/`) | Mobile (`animations/`) |
|---------|-------------------------|------------------------|
| `FadeIn` | Framer Motion | Reanimated `FadeIn` |
| `SlideUp` | Framer Motion | Reanimated |
| `ScaleIn` | Framer Motion | Reanimated |
| `HoverCard` | Framer Motion `whileHover` | Pass-through (no hover on native) |
| `LoadingTransition` | Framer Motion pulse | Reanimated fade |
| `PageTransition` | Framer Motion | Reanimated fade |

Timing values read from `animation.presets` in design-tokens. Override presets when the design system defines final motion.

---

## Layout System

### Shared primitives

- `Shell`, `ShellHeader`, `ShellMain`, `ShellSidebar`, `ShellContent`

### Role-specific layouts

| Layout | Web path | Mobile path | Notes |
|--------|----------|-------------|-------|
| Public website | `layouts/PublicLayout.tsx` | `layouts/PublicLayout.tsx` | Header + content |
| Customer dashboard | `layouts/CustomerDashboardLayout.tsx` | `layouts/CustomerDashboardLayout.tsx` | Web wraps existing `Layout` |
| Driver dashboard | `layouts/DriverDashboardLayout.tsx` | `layouts/DriverDashboardLayout.tsx` | Web wraps existing `Layout` |
| Dispatcher dashboard | `layouts/DispatcherDashboardLayout.tsx` | `layouts/DispatcherDashboardLayout.tsx` | Web wraps existing `Layout` |
| Fleet dashboard | `layouts/FleetDashboardLayout.tsx` | `layouts/FleetDashboardLayout.tsx` | Web wraps existing `Layout` |
| Admin dashboard | `layouts/AdminDashboardLayout.tsx` | `layouts/AdminDashboardLayout.tsx` | Web wraps existing `Layout` |
| Mobile | `layouts/MobileLayout.tsx` | `layouts/MobileLayout.tsx` | Bottom padding for tab bar (web) |

Web authenticated layouts delegate to the existing `components/layout.tsx` sidebar shell. Role-specific layouts are thin wrappers ready for design differentiation without breaking routes.

---

## Theme Provider

### Web

```tsx
import { ThemeProvider, useAppTheme } from "@/theme";

// Wrapped in App.tsx
<ThemeProvider>
  <App />
</ThemeProvider>
```

Uses `next-themes` with `attribute="class"`. `useAppTheme()` returns `{ theme, scheme, setScheme }`.

### Mobile

```tsx
import { ThemeProvider, useAppTheme } from "@/theme";

// Wrapped in app/_layout.tsx
<ThemeProvider>
  <AppProvider>...</AppProvider>
</ThemeProvider>
```

`useColors()` hook bridges to theme colors for backward compatibility.

---

## Refactoring Status

| Area | Status | Notes |
|------|--------|-------|
| Design tokens package | ✅ Complete | Cross-platform source of truth |
| Web ThemeProvider | ✅ Wired | `App.tsx` |
| Mobile ThemeProvider | ✅ Wired | `app/_layout.tsx` |
| Web design-system components | ✅ Created | 20 components |
| Mobile design-system components | ✅ Created | 20 components |
| Layout primitives + role layouts | ✅ Created | 7 layouts per platform |
| Map components | ✅ Created | Neutral styling |
| Animation wrappers | ✅ Created | Token-driven timing |
| Screen migration to design-system | ⏳ Pending | Screens still use shadcn/inline styles directly |
| Web map integration | ⏳ Pending | No live map on web yet |
| Mobile map refactor | ⏳ Pending | `map.tsx` still uses inline hex values |

---

## Remaining Duplicated Components

These existing components overlap with the new design-system layer. Migrate screens to design-system imports over time:

| Legacy | Design-system replacement |
|--------|---------------------------|
| `@/components/ui/button` | `@/components/design-system/PrimaryButton`, `SecondaryButton`, `IconButton` |
| `@/components/ui/card` | `@/components/design-system/Card` |
| `artifacts/haulbrokr-mobile/components/StatCard.tsx` | `@/components/design-system/StatCard` (re-export) |
| `artifacts/haulbrokr-mobile/components/EmptyState.tsx` | `@/components/design-system/EmptyState` (re-export) |
| `artifacts/haulbrokr-mobile/components/StatusBadge.tsx` | `@/components/design-system/StatusPill` |
| `artifacts/haulbrokr/src/components/layout.tsx` | Role layouts in `@/layouts/*` |

### Hardcoded values still in screens

| File | Issue |
|------|-------|
| `artifacts/haulbrokr/src/pages/dashboard.tsx` | `AMBER`, `NAVY` chart hex constants |
| `artifacts/haulbrokr/src/components/admin-insights.tsx` | Chart color arrays |
| `artifacts/haulbrokr-mobile/app/(tabs)/map.tsx` | `DARK_MAP_STYLE`, inline hex colors |
| `artifacts/haulbrokr-mobile/app/dump-sites.tsx` | Category color hex values |
| `artifacts/haulbrokr/src/AuthShell.tsx` | Clerk appearance HSL overrides |

---

## Screens Ready for Redesign

Screens are functionally complete and can receive new visuals by updating tokens + swapping to design-system components.

### Web (`artifacts/haulbrokr/src/pages/`)

| Screen | Route | Role | Priority (design package order) |
|--------|-------|------|--------------------------------|
| Landing | `/` | Public | 2 — Homepage |
| Dashboard | `/dashboard` | All | 4 — Customer Dashboard |
| Requests / Job Board | `/requests` | Customer/Provider | 3 — Dispatcher |
| Request detail | `/requests/:id` | Customer/Provider | 3 |
| New request | `/requests/new` | Customer | 4 |
| Fleet | `/fleet` | Provider | 6 — Fleet Dashboard |
| Fleet new | `/fleet/new` | Provider | 6 |
| Jobs | `/jobs` | All | 3/5 |
| Job detail | `/jobs/:id` | All | 3/5 |
| Projects | `/projects` | Customer | 4 |
| Project detail | `/projects/:id` | Customer | 4 |
| Company | `/company` | Customer/Provider | 4/5 |
| Bins | `/bins` | All | 4 |
| Bin detail | `/bins/:id` | All | 4 |
| Factoring | `/factoring` | Provider | 5 — Driver |
| Integrations | `/integrations` | Staff | 7 — Admin |
| Admin | `/admin` | Staff | 7 |
| Account | `/account` | All | — |
| Onboarding | `/onboarding` | New user | — |
| Auth (sign-in/up) | `/sign-in`, `/sign-up` | Public | — |

### Mobile (`artifacts/haulbrokr-mobile/app/`)

| Screen | Path | Role | Notes |
|--------|------|------|-------|
| Home tab | `(tabs)/index` | Customer | Dashboard |
| Jobs tab | `(tabs)/jobs` | Provider | Job board |
| Map tab | `(tabs)/map` | Provider | Hidden tab; map UI exists |
| Fleet | `fleet` | Provider | Fleet dashboard |
| Driver jobs | `driver-jobs` | Driver | Driver cockpit |
| Tracking | `tracking/[id]` | Customer | Live tracking |
| Admin compliance | `admin-compliance` | Staff | Admin |
| Admin credit | `admin-credit` | Staff | Admin |
| Admin payouts | `admin-payouts` | Staff | Admin |

---

## Verification Commands

```bash
# Typecheck (all packages)
pnpm run typecheck

# Web tests
pnpm --filter @workspace/haulbrokr run test

# Mobile tests
pnpm --filter @workspace/haulbrokr-mobile run test

# Production build (web + API; mobile excluded from root build)
pnpm run build

# Mobile build
pnpm --filter @workspace/haulbrokr-mobile run build
```

---

## Import Cheatsheet

```tsx
// Web
import { PrimaryButton, Card, StatusPill } from "@/components/design-system";
import { CustomerDashboardLayout } from "@/layouts";
import { TruckMarker, FleetLayer } from "@/components/maps";
import { FadeIn, PageTransition } from "@/animations";
import { useAppTheme } from "@/theme";

// Mobile
import { PrimaryButton, Card, StatusPill } from "@/components/design-system";
import { MobileLayout } from "@/layouts";
import { JobMarker, RoutePolyline } from "@/components/maps";
import { SlideUp } from "@/animations";
import { useAppTheme } from "@/theme";

// Shared tokens
import { spacing, colors, statusColor, createTheme } from "@workspace/design-tokens";
```
