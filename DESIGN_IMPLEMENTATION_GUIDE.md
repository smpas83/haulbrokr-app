# Design Implementation Guide

## Sprint 11 migration status

The design-system migration preserves the existing HaulBrokr visual appearance. Cursor owns engineering implementation only: screens should consume shared components, layouts, semantic tokens, and animation wrappers without introducing new product design choices.

## Migrated screens

| Surface | Routes | Status | Notes |
| --- | --- | --- | --- |
| Customer dashboard | `artifacts/haulbrokr/src/pages/dashboard.tsx` | Migrated | Uses `PrimaryButton`, `Card`, `StatCard`, `Notification`, `Skeleton`, `EmptyState`, `Panel`, `HoverCard`, and `PageTransition`. |
| Fleet/provider dashboard | `artifacts/haulbrokr/src/pages/dashboard.tsx`, `artifacts/haulbrokr/src/pages/fleet.tsx` | Migrated | Provider home and fleet management use shared cards, buttons, status pills, skeletons, empty state, and page transition. |
| Admin dashboard | `artifacts/haulbrokr/src/pages/admin.tsx`, `artifacts/haulbrokr/src/components/admin-insights.tsx` | Migrated | Admin shell uses `AdminDashboardLayout`; metrics, cards, status pills, skeletons, and spinners are shared. |
| Driver dashboard | Existing shared `/dashboard` shell | Partial | No dedicated web driver dashboard exists; role layout alias is wired. Driver field operations remain in `job-detail.tsx`. |
| Dispatcher dashboard | Existing provider workflow | Partial | No dispatcher role exists; provider/fleet flow currently owns dispatch-like behavior. Dispatcher layout alias is wired as a fallback. |

## Shared components adopted

Implemented in `artifacts/haulbrokr/src/components/design-system/`:

- `PrimaryButton`, `SecondaryButton`
- `Card`, `GlassCard`, `MetricCard`, `StatCard`, `Panel`
- `StatusPill`, `Notification`
- `LoadingSpinner`, `Skeleton`, `EmptyState`
- `MapContainer`, `TruckMarker`, `DriverMarker`, `JobMarker`, `RoutePolyline`, `ETAOverlay`, `FleetLayer`, `CustomerLayer`
- `FadeIn`, `SlideUp`, `HoverCard`, `PageTransition`, `LoadingTransition`
- `PublicLayout`, `CustomerDashboardLayout`, `DriverDashboardLayout`, `DispatcherDashboardLayout`, `FleetDashboardLayout`, `AdminDashboardLayout`, `MobileLayout`

## Token usage

Semantic token aliases now include:

- Color: `primary`, `secondary`, `surface/card`, `background`, `success`, `warning`, `danger/destructive`, `accent`
- Map: `map-route`, `map-marker`
- Charts: `chart-primary`, `chart-secondary`, `chart-success`, `chart-danger`, `chart-accent`, `chart-warning`

## Hardcoded values remaining

- Public marketing/auth screens still contain standalone presentation classes and Clerk appearance values.
- Non-dashboard workflow screens still have local status maps and page-level spacing/typography classes.
- Chart typography in Recharts still uses library defaults where token-driven CSS classes cannot be applied directly.
- Mobile app still uses its existing React Native token system; this pass did not rewrite mobile screens.

## Component adoption percentage

| Area | Adoption |
| --- | ---: |
| Dashboard route | 90% |
| Fleet route | 85% |
| Admin console | 80% |
| Admin insights | 80% |
| Overall web dashboard scope | 84% |

## Remaining migration targets

1. Migrate `requests`, `jobs`, `job-detail`, `company`, `projects`, `bins`, `factoring`, and account screens to the shared facade.
2. Replace remaining local status helpers with `StatusPill`.
3. Replace remaining page wrappers with role layout and animation wrappers.
4. Move mobile screens to matching mobile design-system components without changing the current React Native appearance.
5. Adopt map primitives when live map UI is introduced; no web map implementation exists today.
