# HaulBrokr Design Implementation Guide

## Design constraints

- Do not redesign the UI, change branding, or introduce new product workflows in engineering-only integration work.
- Continue using the existing request, bid, job, driver, timeline, invoice, and payment screens.
- New design packages can bind to the expanded API fields without requiring backend workflow changes.

## Workflow data now available to design surfaces

- Request and job payloads include facility ID, facility name, coordinates, instructions, accepted materials, safety notes, operating hours, phone number, pricing metadata, customer notes, broker notes, and driver instructions.
- Driver-facing job payloads intentionally hide customer pricing, broker margin, provider net, facility pricing metadata, and broker-only notes.
- Completed jobs expose `completionApproval` so designs can distinguish pending review, approved, and flagged completion states.

## Screen integration guidance

- Request creation can continue using the existing facility picker and may submit the selected `facilityId` plus optional facility metadata.
- Job detail, driver job, dispatcher, customer tracking, timeline, notifications, analytics, and invoice views should read facility fields from the job payload.
- Driver views should render pickup/dropoff, facility name, facility phone, gate/scale/facility instructions, operating hours, accepted materials, safety notes, and driver instructions only.
- Broker/customer views may render pricing and broker notes according to existing role permissions.
- Payment and invoice actions should remain disabled until `completionApproval === "approved"`.

## Accessibility expectations

- Preserve semantic forms, labels, keyboard navigation, focus states, and reduced-motion behavior already present in the component system.
- Any future map, dispatcher, or timeline design package should include keyboard alternatives and text equivalents for status, ETA, route, and alert information.

## Known design handoff blockers

- Live map/ETA/traffic/geofence visuals need production Google Maps configuration and GPS data.
- Push/SMS/email notification designs need delivery-provider wiring.
- Structured facility material compatibility and compliance alert copy need final business rules.
