# Design Implementation Guide

Last updated: 2026-07-03

## Customer Dashboard (Package 4)

This document tracks implementation status against the Customer Dashboard production spec. Visual decisions not yet specified are marked with `PLACEHOLDER` comments in code for ChatGPT's final design package.

### Layout Structure

```
┌─────────────────────────────────────────────────────────────┐
│ Top Header (72px) — company, search, notifications, time    │
├─────────────────────────────────────────────────────────────┤
│ KPI Ribbon — 8 StatCards (horizontal scroll on mobile)      │
├──────────────────────────────┬──────────────────────────────┤
│ Live Map (MapContainer)      │ Activity Feed                │
│                              │ Documents                    │
│ Active Jobs (card grid)      │ Facility Status              │
│                              │ Quick Actions                │
├──────────────────────────────┴──────────────────────────────┤
│ Bottom Timeline Drawer (collapsible, grouped by job)        │
└─────────────────────────────────────────────────────────────┘
```

### Responsive Behavior

| Breakpoint | Behavior |
|------------|----------|
| Desktop (≥1280px) | Resizable center + right panel; timeline at bottom |
| Laptop (1024–1279px) | Same as desktop with narrower panels |
| Tablet (<1024px) | Single column; operations panel opens as bottom drawer |
| Mobile | Single column; bottom tab bar from app Layout preserved |

### Component Reuse

| Spec Component | Implementation |
|----------------|----------------|
| PageHeader | `@/components/shared/PageHeader` |
| StatCard | `@/components/shared/StatCard` |
| StatusBadge | `@/components/shared/StatusBadge` |
| ActivityFeed | `@/components/shared/ActivityFeed` |
| ProgressBar | `@/components/shared/ProgressBar` |
| AppLoader | `@/components/shared/AppLoader` |
| EmptyState | `@/components/shared/EmptyState` |
| OfflineBanner | `@/components/shared/OfflineBanner` |
| MapContainer | `@/components/shared/MapContainer` |

### Data Redaction (Customer View)

Job cards use `redactJobForCustomer()` to strip:

- `ratePerHour`, `customerTotalAmount`, `providerNetAmount`, `platformFeeAmount`
- Driver pay fields (not exposed on Job type for customers)

### Placeholder Inventory

Search codebase for `PLACEHOLDER:` to find all items awaiting ChatGPT visual package:

- Map provider integration (MapContainer)
- Weather widget (CustomerTopBar)
- Tonnage KPI (CustomerKpis sub-label)
- Average ETA KPI
- Facility wait times (FacilityStatus)
- On-time delivery precision (customerJobView)

### Do Not Change Without Design Package

- Colors, typography scale, spacing tokens
- Animation timing and easing
- Map marker icons and route styling
- Glass/blur panel treatments
