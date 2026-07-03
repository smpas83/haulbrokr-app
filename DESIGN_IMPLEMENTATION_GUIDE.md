# Design Implementation Guide

Last updated: 2026-07-03

## Package 1: Dispatcher Command Center

This guide documents the structural implementation of the Dispatcher Command Center for HaulBrokr. **No visual redesign was applied** — all creative decisions (colors, animations, branding, spacing refinements) are deferred to the ChatGPT visual package.

### Route

- **URL:** `/dispatcher`
- **Access:** Provider role only (dispatchers / fleet operators)
- **Layout:** Standalone full-viewport shell — does not use the standard app `Layout` sidebar

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ Top Bar (72px) — logo, search, status, avatar, time        │
├──────────┬──────────────────────────────┬───────────────────┤
│ Sidebar  │ Center Panel (~65%)          │ Right Panel       │
│ 72/280px │ • KPIs (8 cards)             │ • Activity Feed   │
│          │ • Live Map (placeholder)     │ • AI Recs         │
│          │ • Dispatch Queue             │ • Facility Status │
├──────────┴──────────────────────────────┴───────────────────┤
│ Bottom Drawer — Operations Timeline (collapsible)            │
└─────────────────────────────────────────────────────────────┘
```

### Shared Components

All dispatcher sections consume shared components from `@/components/shared`:

| Component | Purpose |
|-----------|---------|
| `PageHeader` | Page title + description + actions slot |
| `StatCard` | KPI metric card with icon, accent, loading skeleton |
| `ActivityFeed` | Live activity list with deep links |
| `StatusBadge` | Job/facility status pill |
| `ProgressBar` | Recommendation score / completion bars |
| `AppLoader` | Full-section loading spinner |
| `EmptyState` | Empty data states |
| `OfflineBanner` | Navigator offline detection |
| `MapContainer` | Map placeholder with job/truck overlay data |
| `AsyncSection` | Loading / error / empty / offline wrapper |

### API Integration (Existing Only)

| Section | API |
|---------|-----|
| KPIs | `GET /dashboard/stats`, `GET /trucks`, `GET /organization/members` |
| Activity Feed | `GET /dashboard/activity` |
| Dispatch Queue | `GET /jobs`, `GET /jobs/:id/tickets` |
| Map data | Jobs + trucks (no map tiles yet) |
| AI Recommendations | Org members + pending jobs (structural placeholder) |
| Facility Status | `GET /dump-sites` |
| Timeline | `GET /jobs/:id/status-updates` |

### Responsive Behavior

| Breakpoint | Behavior |
|------------|----------|
| Desktop (≥1280px) | Full three-column layout with resizable right panel |
| Laptop (<1280px) | Sidebar auto-collapses to 72px |
| Tablet (<1024px) | Right panel becomes slide-out drawer |
| Mobile (<768px) | Sidebar hidden; bottom drawer + drawer panel |

### Placeholder Markers

Search codebase for `PLACEHOLDER:` comments to find all deferred visual/API items:

- Map provider integration
- Weather widget
- Live driver presence
- Daily KPI aggregation
- AI recommendation engine
- Facility wait times
- Pinned jobs / recent searches

### Styling Rules

- Use existing theme tokens from `src/index.css` (`--primary`, `--sidebar`, `--card`, etc.)
- No inline styles in new components
- Cards: `rounded-none border-2 shadow-sm` (matches existing HaulBrokr industrial style)
- Glass/backdrop: `bg-card/80 backdrop-blur-sm` — structural only, awaiting premium polish

### Adding Visual Package

When ChatGPT delivers the visual package:

1. Replace `MapContainer` placeholder with map provider component
2. Apply animation tokens to `ActivityFeed` and timeline entries
3. Update KPI card styling via `StatCard` className props
4. Wire new APIs into `useDispatcherData.ts` without changing layout structure
5. Remove `PLACEHOLDER` comments as each item is completed
