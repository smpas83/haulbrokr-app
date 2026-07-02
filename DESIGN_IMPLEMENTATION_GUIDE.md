# Design Implementation Guide

## Sprint 16: Real-time experience and microinteractions

### Animated interactions added

- Added reduced-motion-safe web motion tokens for page transitions, KPI value changes, activity-feed rows, live dots, route polyline sweep, and truck marker movement.
- Added shared web primitives for page transitions, loading skeleton grids, live refresh badges, empty states, error states, animated KPI values, and route progress previews.
- Wired the existing toast engine to live activity/status/payment changes for new dispatch, driver accepted, driver arrived, job completed, payment attention/received, fleet status changes, and ticket upload.
- Added live polling and visible background refresh feedback to dashboard, requests, request detail, jobs, job detail, bins, bin detail, and fleet screens.
- Added dashboard KPI and activity-feed animation while preserving current chart colors, card structure, and layout.
- Added job route animation, ETA-refresh indicator, animated driver status timeline, live tickets/evidence refresh, and payment/status-change toasts.
- Added fleet availability/compliance/revenue KPI cards, animated vehicle cards, and availability pulse treatment.
- Added mobile live polling for jobs, requests, dashboard activity, job status updates, tickets, and evidence.
- Added mobile skeleton loading, driver workload network/GPS state, animated load cards/timeline rows, upload-progress feedback, and shared notification refresh pill.

### Remaining implementation tasks

- Replace polling with WebSocket/SSE or push notifications when the backend exposes a real event stream.
- Feed route previews from actual driver GPS coordinates instead of status-derived progress.
- Add dispatcher-specific screens if product separates dispatcher from provider/fleet ownership.
- Extend shared empty/error/loading primitives across lower-traffic admin, account, company, factoring, and integrations subpanels.
- Add richer mobile reduced-motion handling with native accessibility preferences where Reanimated animations remain screen-local.

### Performance notes

- Live refresh uses 15-second React Query polling, `refetchOnWindowFocus`, and no background polling to avoid unnecessary network work.
- New web animations are CSS-only and respect `prefers-reduced-motion`.
- Heavy chart components remain unchanged and continue to render only on the dashboard route.
- Mobile changes reuse existing Reanimated primitives and keep polling centralized in `useLiveApi`.
- Animated lists key rows by stable ids to avoid remounting whole screens during refetches.
