# HaulBrokr RC2 Release Candidate Report

**Release:** RC2 — Google Maps Gap Closure  
**Date:** 2026-07-05  
**Scope:** Google Maps production readiness only (no Stripe, payments, SMS, push, or UI redesign changes)

## Summary

RC2 closes all remaining Google Maps production gaps. The API server now uses Google Routes API for polylines and traffic-aware ETA, Distance Matrix for driving-distance marketplace filtering, and a new facility-routing endpoint. Mobile nearby filtering prefers device GPS when permission is granted, live tracking renders route polylines with ETA, and the iOS bundle identifier is aligned to `com.haulbrokr.mobile`.

## Changes delivered

### API server

- Added `artifacts/api-server/src/lib/googleRoutes.ts` — Routes API, Distance Matrix, polyline decode, dev-only Haversine fallback.
- `POST /api/maps/route` — driving route with polyline and ETA.
- `POST /api/maps/distance` — batch driving distances.
- `GET /api/dump-sites/routes` — pickup → facility routes ranked by drive distance.
- `GET /api/jobs/:id/tracking` — includes computed ETA and route polyline.
- Marketplace radius filter uses Google driving distance when `GOOGLE_MAPS_API_KEY` is set.
- Production env validation requires `GOOGLE_MAPS_API_KEY` (no routing/geocode fallback in production).

### Mobile

- iOS `bundleIdentifier` set to `com.haulbrokr.mobile` (matches Android `com.haulbrokr.mobile`).
- iOS Google Maps SDK key injected via `app.config.js`.
- Nearby filter uses GPS coordinates when location permission is granted; otherwise geocodes selected city via API.
- `useMarketplaceMap({ lat, lng, radiusMiles })` wired for server-side driving-distance filter.
- Live tracking map renders route `Polyline` and ETA badge from server-computed ETA.

### Documentation

- `GOOGLE_MAPS_PRODUCTION_CERTIFICATION.md` — API enablement, key restrictions, smoke tests.
- `ENVIRONMENT_INVENTORY.md` — updated Maps env requirements.

## Verification

```bash
pnpm run typecheck
pnpm -r --if-present test
pnpm run build
```

## Production deployment notes

1. Enable **Routes API** and **Distance Matrix API** in Google Cloud Console (in addition to existing Geocoding / Maps JS / Maps SDK).
2. Set `GOOGLE_MAPS_API_KEY` on Render with API restrictions for server-side use.
3. Restrict mobile keys to bundle `com.haulbrokr.mobile` / package `com.haulbrokr.mobile`.
4. Rebuild iOS via EAS after bundle ID change — update App Store Connect and Apple Sign-In configuration if needed.

## Known limitations

- Facility route UI on the Site Locator screen remains list-based; routes are available via API (`useFacilityRoutes` hook) for job-context integration.
- Distance Matrix batching processes up to 25 destinations per request; large marketplace payloads may incur multiple API calls when filtering by radius.

## Sign-off criteria

- [x] Route polylines from Google Routes API
- [x] Traffic-aware ETA on live tracking
- [x] Pickup → facility route calculation
- [x] Driving distance replaces Haversine in production
- [x] Mobile nearby filter uses GPS when permitted
- [x] iOS bundle ID `com.haulbrokr.mobile`
- [x] Production fallback policy documented and enforced
