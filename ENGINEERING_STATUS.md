# HaulBrokr Engineering Status

## Cursor Sprint 18 - Smart Facility Network

### Completed Features
- Expanded the existing `dump_sites` model into smart facility profiles with coordinates, hours, safety/PPE rules, scale and gate instructions, driver/broker notes, live status, capacity, photos, and open/closed/temporarily closed state.
- Added facility material rules for rock, sand, gravel, asphalt, concrete, dirt, clay, base, recycled asphalt/concrete, construction debris, green waste, mixed waste, clean fill, and contaminated soil.
- Added mutable facility pricing schedules for tipping fees, material purchase prices, minimums, per-ton/load rates, flat rates, cash/account/customer-contract prices, fuel surcharges, and environmental fees.
- Added customer facility preferences for preferred facilities, preferred materials, preferred routes, and backup facilities without automatic broker override.
- Added driver-safe, customer-safe, broker, map, analytics, pricing, search, recommendation, material catalog, and import-validation API views.
- Added smart facility markers to the existing mobile job map and enriched the existing Site Locator feed without redesigning the UI.

### API Changes
- `GET /api/dump-sites` now returns a paginated `{ items, total, limit, offset }` response and supports `search`, `city`, `state`, `zip`, `material`, `type`, `openNow`, `latitude`, `longitude`, `distanceMiles`, `limit`, and `offset`.
- Added `GET /api/dump-sites/materials`.
- Added `GET /api/dump-sites/recommendations`.
- Added `GET|PUT /api/dump-sites/preferences`.
- Added `POST /api/dump-sites/imports`.
- Added `GET /api/dump-sites/{id}`.
- Added `GET|POST /api/dump-sites/{id}/pricing`.
- Added `GET /api/dump-sites/{id}/analytics`.
- Added `GET /api/dump-sites/{id}/driver-view`, `/broker-view`, `/customer-view`, and `/map-view`.

### Database Changes
- Expanded `dump_sites` with facility profile, instruction, safety, live-status, capacity, coordinate, and note fields.
- Added `facility_materials` for accepted/rejected material rules and special instructions.
- Added `facility_pricing` for data-driven pricing updates.
- Added `customer_facility_preferences` for customer preference configuration.
- Added `facility_analytics` for facility performance and utilization metrics.

### Remaining Production Blockers
- Backfill and migrate existing production dump-site records with coordinates, operating hours, status, material rules, and pricing.
- Add database indexes after production cardinality is known for facility state/type/status, coordinates, and material/pricing joins.
- Connect live traffic, holiday-hours, maintenance, and wait-time integrations when provider APIs are selected.
- Add admin UI upload/commit flow after the import validation endpoint is connected to file parsing.

### Performance Notes
- Facility search applies database filters first, then computes distance and pagination in the API process for portability without PostGIS.
- Recommendation scoring is deterministic and keeps broker approval mandatory.
- Pricing is read from `facility_pricing`, so fee changes do not require application code changes.
