# Design Implementation Guide

## Smart Facility Network Implementation

### Completed Features
- Reused the existing dump-site directory, request posting picker, mobile Site Locator, and mobile Job Map surfaces.
- Preserved HaulBrokr branding and existing screen structure while supplying richer facility data.
- Exposed role-specific facility payloads so drivers see directions, photos, gate/scale/unload instructions, hours, phone, current job notes, and safety warnings.
- Redacted customer pricing, broker margin, contract pricing, and broker notes from driver/customer facility views.

### API Changes
- The facility directory uses the existing `/api/dump-sites` resource.
- List responses are paginated and include smart facility status, materials, coordinates, and distance when requested.
- Map clients can use `/api/dump-sites/{id}/map-view` or the paginated search endpoint to render facility pins by type and current status.
- Broker tooling can use `/api/dump-sites/recommendations` for ranked options while preserving manual broker approval.

### Database Changes
- Existing `dump_sites` records now represent full smart facility profiles.
- Material acceptance/rejection and pricing are stored in separate tables to avoid duplicating facility logic.
- Customer preferences and analytics are stored separately so they can evolve independently from profile data.

### Remaining Production Blockers
- Design-owned admin screens are still needed for editing profile fields, uploading/importing facilities, and reviewing recommendations.
- Design-owned map filter controls for material/type/search/open-now should be specified before expanding the mobile map controls beyond the current chip pattern.
- Production facility photos require an upload/storage workflow decision before enabling direct admin management.

### Performance Notes
- The current map integration requests nearest facilities for the committed visible region and caps results at 100.
- Nationwide scale should add indexed database filtering and optional geospatial support before ingesting very large facility catalogs.
