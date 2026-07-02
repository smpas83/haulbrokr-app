# Design Implementation Guide

## Dispatcher Command Center

- The current package implements structure only; it does not redefine HaulBrokr colors, branding, typography, spacing, or motion.
- The command center uses the existing card, button, select, drawer, command, skeleton, badge, input, and resizable-panel primitives.
- `/dispatcher` contains the operational layout: collapsible left navigation, central live map shell, resizable right feed, bottom KPI bar, timeline drawer, search, and filters.

## Existing infrastructure reused

- Fleet: `useListTrucks`
- Dispatch/jobs: `useListJobs`, `useListRequests`
- Notifications/feed: `useGetDashboardActivity`
- Analytics/KPIs: `useGetDashboardStats`
- Timeline: `useListJobStatusUpdates`
- Driver status: `useListOrgMembers`
- Facilities: `useListDumpSites`, `useListDumpSiteStates`

## Visual placeholders awaiting final package

- Map styling is intentionally neutral and structural; final map tiles, route styling, traffic visuals, and recommendation marks should replace the shell treatment.
- Disabled filter controls mark backend gaps without introducing client-only business filtering.
- Search presentation uses the existing command palette style until final command-center specs arrive.
- Timeline and feed use current component spacing and borders only.

## Accessibility and motion

- Navigation toggles include ARIA labels and expanded state.
- Dispatcher filters, map, activity feed, timeline, and search have accessible labels.
- Interactive map job pins are keyboard-focusable buttons.
- Transition classes include reduced-motion guards where new transitions were added.

## Performance notes

- The operations map is lazy-loaded as a separate chunk.
- Derived operational datasets are memoized and bounded before rendering.
- Live data updates use generated hook polling so fetch behavior stays centralized.
