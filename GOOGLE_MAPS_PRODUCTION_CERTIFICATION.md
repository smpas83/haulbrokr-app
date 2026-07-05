# Google Maps Production Certification — HaulBrokr RC2

This document certifies that Google Maps Platform integration is production-ready for Release Candidate 2.

## Enabled Google Cloud APIs

| API | Purpose | Used by |
|---|---|---|
| **Maps JavaScript API** | Web marketplace live map | `artifacts/haulbrokr` (`VITE_GOOGLE_MAPS_API_KEY`) |
| **Maps SDK for Android** | Native Android map tiles | `artifacts/haulbrokr-mobile` (`GOOGLE_MAPS_API_KEY` via EAS) |
| **Maps SDK for iOS** | Native iOS map tiles | `artifacts/haulbrokr-mobile` (`GOOGLE_MAPS_API_KEY` via EAS) |
| **Geocoding API** | Address → coordinates | API server `geocodeCache.ts` |
| **Routes API** | Driving routes, polylines, traffic-aware ETA | API server `googleRoutes.ts` |
| **Distance Matrix API** | Batch driving distances for marketplace radius filter | API server `googleRoutes.ts` |

## Key restrictions (production)

| Key | Restriction |
|---|---|
| Server (`GOOGLE_MAPS_API_KEY` on Render) | IP-restrict to Render egress or use API-restricted key limited to Geocoding, Routes, Distance Matrix |
| Web (`VITE_GOOGLE_MAPS_API_KEY` on Vercel) | HTTP referrer: `https://haulbrokr.com/*`, `https://www.haulbrokr.com/*` |
| Mobile Android | Package name: `com.haulbrokr.mobile` |
| Mobile iOS | Bundle ID: `com.haulbrokr.mobile` |

## Production endpoints

| Endpoint | Description |
|---|---|
| `POST /api/maps/geocode` | Forward geocode (Google required in production) |
| `POST /api/maps/route` | Driving route with encoded polyline + traffic-aware ETA |
| `POST /api/maps/distance` | Batch driving distances from one origin |
| `GET /api/map/marketplace?lat=&lng=&radiusMiles=` | Marketplace with Google driving-distance radius filter |
| `GET /api/dump-sites/routes?pickupLat=&pickupLng=` | Pickup → facility routes ranked by drive distance |
| `GET /api/jobs/:id/tracking` | Live GPS trail + computed ETA to pickup/delivery |

## Fallback policy

| Environment | Behavior |
|---|---|
| **Production** | Google Maps Platform required. No Haversine or Nominatim fallback for routing, distance, or geocoding. `GOOGLE_MAPS_API_KEY` validated at API startup. |
| **Development** | Haversine straight-line estimate and Nominatim geocoding allowed when `GOOGLE_MAPS_API_KEY` is unset. |

## RC2 gap closure checklist

| # | Requirement | Status |
|---|---|---|
| 1 | Route polylines via Google Routes API | ✅ `POST /api/maps/route`, tracking map `Polyline` |
| 2 | Computed ETA (traffic-aware) | ✅ Routes API `duration` → tracking `eta.etaLabel` |
| 3 | Facility route calculation (pickup → facility) | ✅ `GET /api/dump-sites/routes` |
| 4 | Driving distance replaces Haversine when key exists | ✅ Distance Matrix in marketplace radius filter |
| 5 | Mobile nearby filter uses GPS when permitted | ✅ `map.tsx` prefers device GPS over map center |
| 6 | iOS bundle ID `com.haulbrokr.mobile` | ✅ `app.json` aligned with Android package |

## Smoke tests

Run after deploying with production keys:

```bash
# Geocode
curl -H "Authorization: Bearer $TOKEN" -X POST https://haulbrokr.com/api/maps/geocode \
  -H "Content-Type: application/json" -d '{"address":"Dallas, TX"}'

# Route + polyline + ETA
curl -H "Authorization: Bearer $TOKEN" -X POST https://haulbrokr.com/api/maps/route \
  -H "Content-Type: application/json" \
  -d '{"origin":{"latitude":32.7767,"longitude":-96.797},"destination":{"latitude":32.8998,"longitude":-97.0403}}'

# Facility routes from pickup
curl -H "Authorization: Bearer $TOKEN" \
  "https://haulbrokr.com/api/dump-sites/routes?pickupLat=32.7767&pickupLng=-96.797&state=TX&limit=3"

# Marketplace nearby filter (driving distance)
curl -H "Authorization: Bearer $TOKEN" \
  "https://haulbrokr.com/api/map/marketplace?lat=32.7767&lng=-96.797&radiusMiles=50"
```

Mobile manual checks:

1. Open Job Map → tap **Nearby** → grant location → confirm jobs filter from GPS position.
2. Open active job tracking → confirm **ETA** badge and route polyline on map.
3. Verify iOS build uses bundle ID `com.haulbrokr.mobile` in App Store Connect / EAS.

## Billing alerts

Enable Google Cloud budget alerts for Maps Platform. Monitor Routes API and Distance Matrix usage during marketplace peak load.
