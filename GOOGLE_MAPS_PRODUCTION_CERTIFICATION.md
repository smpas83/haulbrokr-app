# Google Maps Production Certification — HaulBrokr RC2

**Audit date:** 2026-07-05  
**Release engineer:** Cloud Agent (RC2 Blocker 1)  
**Scope:** Google Maps only — no Stripe, Clerk, or notification changes

---

## Final Decision

### ⚠ GOOGLE MAPS CERTIFIED WITH OPERATOR ACTION

Core map rendering, geocoding, marketplace markers, and GPS tracking are production-ready **after operator configuration** (GCP keys, API enablement, Android SHA restrictions, Vercel/Render/EAS env vars). Several checklist items — **Directions, ETA, facility routing, and Google Distance Matrix** — are **not implemented** in code and remain product gaps, not configuration gaps.

---

## Summary Matrix

| Area | Status | Notes |
|------|--------|-------|
| Web live map (`/map`) | ✅ Working | Requires `VITE_GOOGLE_MAPS_API_KEY` on Vercel |
| Web reverse geocode | ✅ Working | Now via `POST /api/maps/reverse-geocode` (Google) |
| API forward geocode | ✅ Working | Requires `GOOGLE_MAPS_API_KEY` on Render |
| API reverse geocode | ✅ Working | Added in this certification pass |
| API marketplace map | ✅ Working | Server-side Google geocoding |
| API GPS tracking | ✅ Working | Custom DB timeline — not Google |
| Mobile Android maps | ⚠ Partial | Requires EAS `GOOGLE_MAPS_API_KEY` + Android SHA in GCP |
| Mobile iOS maps | ✅ Working | Apple Maps via `react-native-maps` (by design) |
| Mobile web maps | ⚠ Partial | Requires `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` or build-time key |
| Directions / polylines | ❌ Missing | Not implemented |
| ETA (computed arrival) | ❌ Missing | UI shows last GPS timestamp only |
| Distance (Google) | ⚠ Partial | Haversine only — no Distance Matrix / Routes API |
| Facility routing | ❌ Missing | Dump site directory only (`GET /api/dump-sites`) |
| Nominatim in production | ✅ Removed | All production paths now use Google or fail safely |

---

## Fixes Applied (This Pass)

| File | Cause | Fix Applied |
|------|-------|-------------|
| `artifacts/api-server/src/lib/geocodeCache.ts` | Nominatim fallback used in production when Google key missing | Nominatim disabled when `NODE_ENV=production`; added `reverseGeocodeAddressCached()` via Google Geocoding API |
| `artifacts/api-server/src/routes/map.ts` | No reverse geocode endpoint; clients called Nominatim directly | Added `POST /api/maps/reverse-geocode` |
| `artifacts/haulbrokr/src/hooks/useReverseGeocode.ts` | *(new)* | Shared hook calling API reverse geocode with Clerk Bearer token |
| `artifacts/haulbrokr/src/pages/request-new.tsx` | Direct Nominatim reverse geocode from browser | Uses `useReverseGeocode` hook → API |
| `artifacts/haulbrokr/src/pages/bins.tsx` | Direct Nominatim reverse geocode from browser | Uses `useReverseGeocode` hook → API |
| `artifacts/haulbrokr-mobile/lib/geocode.ts` | Nominatim forward geocode from mobile client | Removed Nominatim; file now exports `distanceMiles()` only |
| `artifacts/haulbrokr-mobile/hooks/useJobCoordinates.ts` | Nominatim geocoding for fallback markers | Calls `POST /api/maps/geocode` with Clerk Bearer token |
| `artifacts/haulbrokr-mobile/hooks/useDriverTracking.ts` | GPS pings sent without Bearer token (auth failure risk) | Added Clerk `Authorization: Bearer` header |
| `artifacts/api-server/src/lib/validateProductionEnv.ts` | `GOOGLE_MAPS_API_KEY` not validated at API startup | Required on Render in production (`AIza…` prefix) |
| `ENVIRONMENT_INVENTORY.md` | Nominatim documented as fallback; `VITE_GOOGLE_MAPS_API_KEY` misplaced | Updated requirements — Google-only in production |
| `docs/DEPLOY-VERCEL-RENDER.md` | Missing Vercel maps key; Render maps key not listed | Added `VITE_GOOGLE_MAPS_API_KEY` (Vercel) and `GOOGLE_MAPS_API_KEY` (Render) |
| `.env.example` | Missing web maps key | Added `VITE_GOOGLE_MAPS_API_KEY` |
| `scripts/verify-deployment-readiness.mjs` | Missing web maps key in validation | Added `VITE_GOOGLE_MAPS_API_KEY` to required vars |
| `artifacts/haulbrokr/test/bins-deep-link.test.tsx` | Test broke after hook extracted | Mocked `useReverseGeocode` |
| `artifacts/api-server/src/lib/geocodeCache.test.ts` | *(new)* | Tests production Nominatim block + Google geocode paths |
| `artifacts/api-server/src/routes/map.test.ts` | No reverse geocode coverage | Added reverse geocode endpoint tests |

---

## VERIFY WEB

### Environment: `VITE_GOOGLE_MAPS_API_KEY`

| Check | Status | Details |
|-------|--------|---------|
| Map renders | ✅ | `artifacts/haulbrokr/src/pages/map.tsx` — loads Maps JavaScript API dynamically; hard error UI if key missing |
| Tiles load | ✅ | Standard Google map tiles via JS API |
| Markers render | ✅ | Loads/trucks from `GET /api/map/marketplace`; heat-zone circles |
| Directions render | ❌ | Not implemented — no Directions API / polylines |
| ETA works | ❌ | Not implemented — no route duration calculation |
| Distance works | ⚠ | Haversine radius filter on marketplace query params only |
| Reverse geocoding works | ✅ | `useReverseGeocode` → `POST /api/maps/reverse-geocode` |
| Facility routing works | ❌ | Dump sites listed in request form; no route optimization |
| Nominatim removed | ✅ | No Nominatim references in web production paths |

**Operator action:** Set `VITE_GOOGLE_MAPS_API_KEY` on Vercel (Production). Restrict key to HTTP referrers: `https://haulbrokr.com/*`, `https://www.haulbrokr.com/*`. Enable **Maps JavaScript API** in GCP.

**Missing key behavior:** Map page shows error placeholder: *"Set VITE_GOOGLE_MAPS_API_KEY on Vercel to enable the live map."* App does not crash.

---

## VERIFY MOBILE

### Environment: `GOOGLE_MAPS_API_KEY`

| Check | Status | Details |
|-------|--------|---------|
| Android Google Maps SDK | ⚠ | Key injected via `app.config.js` → `android.config.googleMaps.apiKey` at EAS build time |
| Production signing SHA | ❌ | Not in repo — operator must register EAS/Play SHA-1/SHA-256 in GCP |
| Marker rendering | ✅ | `app/(tabs)/map.tsx` — job/truck markers, surge circles |
| Route rendering | ❌ | No polylines / Directions |
| Current location | ✅ | `expo-location` foreground permissions; `showsUserLocation` |
| Permissions | ✅ | `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`; when-in-use only |
| iOS Apple Maps | ✅ | Default `react-native-maps` provider (Apple MapKit) — no Google key required |
| Client Nominatim | ✅ Removed | Mobile geocoding now via API |

**Operator actions:**

1. `eas secret:create --scope project --name GOOGLE_MAPS_API_KEY --value AIza...`
2. Enable **Maps SDK for Android** in GCP
3. Restrict Android key: package `com.haulbrokr.mobile` + production SHA-1/SHA-256 from `eas credentials -p android`
4. For Expo web builds of mobile app, also set `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` (Expo inlines `EXPO_PUBLIC_*` vars)
5. Reconcile iOS bundle ID: `app.json` has `haulbrokr` but Android/docs use `com.haulbrokr.mobile` — align before App Store / Clerk Apple Sign-In

**Blank map if key missing at build:** Android map tiles will not load; build does not fail.

---

## VERIFY API

All routes mount under `/api`.

### Map & Geocode — `artifacts/api-server/src/routes/map.ts`

| Method | Path | Auth | Status | Description |
|--------|------|------|--------|-------------|
| `GET` | `/api/map/marketplace` | `requireProfile` | ✅ | Marketplace loads, trucks, heat zones |
| `GET` | `/api/map` | `requireProfile` | ✅ | Alias of marketplace |
| `GET` | `/api/maps` | `requireProfile` | ✅ | Alias of marketplace |
| `POST` | `/api/maps/geocode` | `requireProfile` | ✅ | Forward geocode `{ address }` → `{ latitude, longitude }` |
| `POST` | `/api/maps/reverse-geocode` | `requireProfile` | ✅ | Reverse geocode `{ lat, lng }` → `{ address }` |
| `POST` | `/api/maps/directions` | — | ❌ | **Not implemented** |
| `POST` | `/api/maps/distance` | — | ❌ | **Not implemented** (Haversine used client-side) |
| `POST` | `/api/maps/facility-route` | — | ❌ | **Not implemented** |
| `GET` | `/api/maps/eta` | — | ❌ | **Not implemented** |

**Query params** for marketplace: `lat`, `lng`, `radiusMiles` — server-side Haversine filter (not Google Distance Matrix).

### Tracking — `artifacts/api-server/src/routes/tracking.ts`

| Method | Path | Auth | Status | Description |
|--------|------|------|--------|-------------|
| `POST` | `/api/jobs/:id/location` | `requireProfile` (driver/provider) | ✅ | Record GPS ping as timeline note |
| `GET` | `/api/jobs/:id/tracking` | `requireProfile` | ✅ | Latest position + trail from timeline |
| `GET` | `/api/dispatch/overview` | `requireProfile` | ✅ | Digital Twin dispatch (CSS dots on web, not Google Maps) |

### Facility directory — `artifacts/api-server/src/routes/dump-sites.ts`

| Method | Path | Auth | Status | Description |
|--------|------|------|--------|-------------|
| `GET` | `/api/dump-sites` | Public | ✅ | Static DB directory with pre-seeded coordinates |
| `GET` | `/api/dump-sites/states` | Public | ✅ | States with dump sites |

**Note:** Dump sites are a directory, not turn-by-turn facility routing.

---

## VERIFY GOOGLE CLOUD REQUIREMENTS

| Google API | Required | Used By | Enabled in Code |
|------------|----------|---------|-----------------|
| **Maps JavaScript API** | Yes | Web `/map`, mobile web shim | ✅ |
| **Geocoding API** | Yes | API server geocode/reverse-geocode, marketplace | ✅ |
| **Maps SDK for Android** | Yes | Native Android maps | ✅ (via Expo config) |
| **Maps SDK for iOS** | No | iOS uses Apple Maps | N/A |
| **Directions API** | No | Not implemented | ❌ |
| **Distance Matrix API** | No | Not implemented | ❌ |
| **Routes API** | No | Not implemented | ❌ |

**Operator action:** In Google Cloud Console, enable Maps JavaScript API, Geocoding API, and Maps SDK for Android on the production project. Create separate restricted keys or one key with multiple restrictions as appropriate.

---

## VERIFY ENVIRONMENT

| Variable | Render | Vercel | EAS | Used By | Production Fail-Safe |
|----------|:------:|:------:|:---:|---------|---------------------|
| `GOOGLE_MAPS_API_KEY` | ✅ Required | — | ✅ Required | API geocoding; Android SDK; mobile web fallback | API startup fails if missing (`validateProductionEnv`) |
| `VITE_GOOGLE_MAPS_API_KEY` | — | ✅ Required | — | Web `/map` page | Map page shows error UI; app loads |
| `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` | — | — | ⚠ Optional | Mobile web bundle inlining | Mobile web map shows placeholder |
| `EXPO_PUBLIC_DOMAIN` | — | — | ✅ Required | Mobile API base URL | Mobile API calls fail |

---

## VERIFY PERFORMANCE

Measured from `pnpm run build` (2026-07-05):

| Metric | Value | Notes |
|--------|-------|-------|
| Web map route chunk | 9.32 kB (3.06 kB gzip) | Lazy-loaded — not in main bundle |
| Web reverse geocode chunk | 78.11 kB (23.60 kB gzip) | Includes Clerk auth dependency |
| Google Maps JS API | ~200+ kB (CDN) | Loaded dynamically on `/map` only — not bundled |
| Main auth shell | 531 kB (156 kB gzip) | Separate from map |
| Geocode latency (server) | Cached | In-memory cache + inflight dedup in `geocodeCache.ts` |
| Directions latency | N/A | Not implemented |
| Reverse geocode latency | ~1 Google API call | Cached by lat/lng key |
| Mobile map | Native SDK | No JS bundle cost on native |

**Lazy loading:** ✅ Web map is a separate Vite chunk (`map-CcKkXR1J.js`).

---

## TESTING

| Command | Result |
|---------|--------|
| `pnpm run typecheck` | ✅ Pass |
| `pnpm test` (api-server, haulbrokr, haulbrokr-mobile) | ✅ Pass — 417 tests |
| `pnpm run build` | ✅ Pass |

### Map-related tests

| File | Coverage |
|------|----------|
| `artifacts/api-server/src/routes/map.test.ts` | Marketplace, geocode, reverse-geocode |
| `artifacts/api-server/src/lib/geocodeCache.test.ts` | Production Nominatim block, Google geocode |
| `artifacts/haulbrokr-mobile/test/geocode.test.ts` | `distanceMiles()` Haversine |
| `artifacts/haulbrokr-mobile/test/check-web-runtime.test.ts` | Web route smoke for `/map`, `/tracking/preview` |

---

## Remaining Blockers

### Operator configuration (must complete before go-live)

1. **Set `VITE_GOOGLE_MAPS_API_KEY` on Vercel** — web live map will not render without it
2. **Set `GOOGLE_MAPS_API_KEY` on Render** — API now requires it at startup in production
3. **Set `GOOGLE_MAPS_API_KEY` in EAS secrets** — Android native maps
4. **Register Android production SHA-1/SHA-256** in Google Cloud Console (`eas credentials -p android`)
5. **Enable GCP APIs:** Maps JavaScript API, Geocoding API, Maps SDK for Android
6. **Restrict API keys** by referrer (web), IP (Render server), and Android package+SHA

### Product / engineering gaps (not fixed — out of RC2 maps-cert scope)

| Gap | Status | Impact |
|-----|--------|--------|
| Google Directions API | ❌ Not implemented | No route polylines on map or tracking screen |
| Google Distance Matrix / Routes API | ❌ Not implemented | Distance is Haversine straight-line only |
| Computed ETA | ❌ Not implemented | Tracking shows last update time, not arrival estimate |
| Facility route optimization | ❌ Not implemented | Dump sites are a static directory |
| Mobile "nearby" filter | ⚠ Bug | Compares to US center, not user GPS (`map.tsx` line ~256) |
| iOS bundle ID mismatch | ⚠ Config | `haulbrokr` vs `com.haulbrokr.mobile` |
| Marketplace truck positions | ⚠ Synthetic | Geocoded city center + offset, not live fleet GPS |
| OpenAPI spec for map routes | ⚠ Missing | Map endpoints not in generated client |

---

## Operator Runbook (Quick Start)

```bash
# 1. Google Cloud Console
#    - Enable: Maps JavaScript API, Geocoding API, Maps SDK for Android
#    - Create keys with appropriate restrictions

# 2. Render (API)
#    GOOGLE_MAPS_API_KEY=AIza...  (Geocoding API — restrict by Render egress IP)

# 3. Vercel (Web)
#    VITE_GOOGLE_MAPS_API_KEY=AIza...  (Maps JS — restrict by haulbrokr.com referrer)

# 4. EAS (Mobile)
cd artifacts/haulbrokr-mobile
eas secret:create --scope project --name GOOGLE_MAPS_API_KEY --value AIza...
eas credentials -p android   # copy SHA-1/SHA-256 to GCP Android key restriction
eas build --platform android --profile production

# 5. Validate
pnpm run verify:deployment   # checks env vars including both maps keys
VERIFY_LIVE_THIRD_PARTY=1 pnpm run verify:deployment  # live Google key check
```

---

## Certification Sign-Off

| Criterion | Result |
|-----------|--------|
| Nominatim removed from production | ✅ |
| Google Geocoding wired server-side | ✅ |
| Web/mobile clients use API for geocode | ✅ |
| Production env validation for maps key | ✅ |
| Tests and build pass | ✅ |
| Operator keys and GCP setup documented | ✅ |
| Directions / ETA / facility routing | ❌ Not in codebase |

**Decision: ⚠ GOOGLE MAPS CERTIFIED WITH OPERATOR ACTION**

Proceed to RC2 Blocker 2 only after operator completes GCP key setup and acknowledges Directions/ETA/facility routing are future work.
