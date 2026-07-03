# HaulBrokr Engineering Status

## Completed in this production pass

- Added configurable broker pricing support with fixed and percentage margins, customer/fleet/driver/material modifiers, rush/weekend/holiday/night pricing, waiting charges, fuel surcharge, cancellation fee, and no-show fee.
- Added authenticated pricing breakdown APIs with role-based redaction: drivers and payees receive only their pay-side pricing.
- Persisted request and job pricing configuration so awarded jobs retain pricing rules through completion, invoicing, and payout settlement.
- Added multi-truck dispatch support for bulk assignment, remaining truck quantity, driver replacement, and split/partial ticket completion.
- Added immutable operations timeline milestones for job creation, driver assignment/replacement/acceptance, partial completion, invoice creation, and payment completion.
- Added dispatcher recommendation API that ranks eligible real drivers/trucks by availability, rating, capacity, truck type, current workload, and customer history.
- Expanded facility storage and APIs with coordinates, phone, hours, accepted materials, photos, weight limits, truck restrictions, tipping fees, material purchase prices, notes, and future wait-time/queue fields.
- Added marketplace analytics API for revenue by customer, driver, fleet, region, material, and truck; margin/profit; utilization; lifetime value; acceptance; completion; and repeat customer metrics.

## API additions

- `POST /api/pricing/breakdown`
- `GET /api/jobs/:id/pricing-breakdown`
- `GET /api/jobs/:id/dispatch-recommendations`
- `POST /api/jobs/:id/bulk-assign`
- `PATCH /api/jobs/:id/tickets/:ticketId/replace-driver`
- `POST /api/jobs/:id/tickets/:ticketId/complete`
- `GET /api/jobs/:id/timeline`
- `GET /api/facilities`
- `POST /api/facilities`
- `PATCH /api/facilities/:id`
- `GET /api/analytics/marketplace`

## Database additions

- `requests`: `broker_margin_type`, `broker_margin_value`, `pricing_rules`
- `jobs`: `broker_margin_type`, `broker_margin_value`, `pricing_rules`
- `dump_sites`: coordinates, hours, accepted materials, photos, restrictions, fees, purchase prices, notes, live wait-time, and queue estimate fields
- `job_status_update_type`: expanded production operation milestones

## Remaining blockers

- Live deadhead, ETA, traffic, and route efficiency require persisted live location/route samples before analytics can compute them honestly.
- SMS/push delivery still needs provider credential wiring and device-token storage.
- Versioned database migrations should replace `drizzle-kit push` before large-scale production rollout.

## Production readiness notes

- Pricing calculations keep the existing Stripe settlement model: customers pay gross, drivers/providers receive net pay, and broker margin remains on platform.
- New endpoints are additive and keep existing request/job/dump-site contracts backward compatible.
- Missing live traffic/location data returns `null` rather than placeholder values.
