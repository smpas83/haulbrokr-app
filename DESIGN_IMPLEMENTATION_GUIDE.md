# HaulBrokr Design Implementation Guide

Generated: 2026-07-02

## Scope

This guide records engineering implementation constraints for the existing HaulBrokr design. It does not redefine UX, UI, branding, product flows, motion, or color decisions.

## Implementation Guardrails

- Preserve existing HaulBrokr branding, layout, copy hierarchy, and navigation unless a separate design owner provides changes.
- Keep customer, provider, driver, fleet, dispatcher, and admin flows aligned with existing route structure.
- Prefer generated API clients where available and keep mobile API behavior aligned with the OpenAPI contract.
- Use existing component primitives and theme tokens; do not introduce one-off visual systems.
- Treat missing vendor credentials as operational blockers, not UI reasons to crash.

## Workflow Coverage

- Customer: registration, job/request creation, bids, quote acceptance, job status, invoices, ratings, documents, company/team settings.
- Provider/Broker: load board, bids, fleet/trucks, compliance, payouts, invoice generation, factoring, wallet/profit views.
- Driver: mobile job list, field events, check-in, ticket/photo/POD evidence, document uploads, wallet.
- Fleet Owner: fleet/truck management, driver-facing mobile workflows, utilization/revenue surfaces.
- Admin: compliance, credit, payouts, bin orders, analytics, users, audit-friendly activity.

## Production Engineering Notes

- The mobile map tab remains hidden until live GPS and Google Maps production configuration are complete.
- Push notification UX should not be promised until a token store, provider, retry policy, and delivery history are implemented.
- Document AI states should remain staff-review states until OCR/provider confidence scoring exists.
- Stripe payment UI must use live/test Stripe publishable keys and should surface actionable errors from the API.
- Missing credentials should produce explicit setup messages or disabled operational paths, never runtime crashes in the client.

## Accessibility Checklist

- Preserve semantic labels on form fields and buttons.
- Keep keyboard focus visible and logical in dialogs, menus, forms, and admin tables.
- Avoid adding motion that ignores reduced-motion preferences.
- Keep error text adjacent to the field/action that caused it.
- Validate mobile controls with screen-reader labels when adding driver/fleet actions.

## Latest Verification

Pending current sprint verification.
