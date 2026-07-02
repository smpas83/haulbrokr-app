## Dispatcher Command Center

### Dispatcher integration complete

- Replaced the authenticated `/dashboard` screen with a live dispatcher command center.
- Added the requested dispatcher navigation rail, large map area, right-side live activity and job progress panels, and bottom KPI strip.
- Kept the implementation on the existing design system: shared `Card`, `Button`, `Badge`, `Alert`, `ScrollArea`, `Separator`, and `Skeleton` primitives.
- Added live polling through the existing TanStack Query API-client hooks at a 15 second interval.
- Preserved existing dashboard notification deep-link behavior for bin-order activity rows.

### APIs consumed

- `GET /api/dashboard/stats` through `useGetDashboardStats`
- `GET /api/dashboard/activity` through `useGetDashboardActivity`
- `GET /api/trucks` through `useListTrucks`
- `GET /api/jobs` through `useListJobs`
- `GET /api/organizations/members` through `useListOrgMembers`
- `GET /api/account/status` through `useGetAccountStatus`
- `GET /api/profiles/me` through `useGetMyProfile`

### Remaining implementation gaps

- Live fleet GPS read API is not exposed yet. The map only renders truck and driver markers when coordinate fields are returned by existing API responses.
- ETA overlays are not exposed by the backend yet.
- Route history and route polylines are not exposed by the backend yet.
- Dispatch recommendations are not exposed by the backend yet.
- Driver online status is not exposed by the backend yet; the dashboard marks the KPI as unavailable instead of deriving a fake value.
- Global average rating is not exposed by the backend yet; job-level rating endpoints exist but there is no aggregate dashboard metric.
- Google Maps requires `VITE_GOOGLE_MAPS_API_KEY` or `VITE_GOOGLE_MAPS_BROWSER_KEY` at build/runtime to render the map layer.

### Performance notes

- Heavy map work is lazy-loaded by injecting the Google Maps script only when the dashboard map mounts and an API key is present.
- Dashboard, fleet, job, member, and activity data are polled through existing query caches to avoid duplicate business logic.
- Marker inputs are memoized from API responses to avoid unnecessary map updates.
- Map markers are clustered by coarse coordinate buckets after 40 live assets to reduce marker churn.
- Mobile and tablet fall back to a stacked command layout while preserving the same panels and keyboard-accessible links.
