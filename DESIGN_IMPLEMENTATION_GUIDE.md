# HaulBrokr Design Implementation Guide

## Engineering boundary

Engineering implements production functionality using the existing design system, routes, APIs, and shared components. Product design, UX, branding, visual identity, layout, and motion decisions remain outside this implementation pass.

## Current guidance

- Do not redesign screens or introduce new visual patterns without a supplied design package.
- Use existing HaulBrokr components and generated API clients when adding UI surfaces for new backend capabilities.
- Keep driver-facing pricing views limited to driver pay; do not render customer price, broker margin, or broker profit for drivers.
- Use existing activity/timeline components for operations milestones before adding new UI primitives.
- For facilities, prefer existing list/detail patterns and map components once live coordinates are wired through clients.
- For dispatcher recommendations, expose ranking factors as operational data and keep final approval as the broker/dispatcher action.

## Backend features ready for UI integration

- Pricing breakdowns with redacted driver/payee views
- Multi-truck bulk dispatch and remaining quantity
- Driver replacement
- Split ticket completion
- Operations timeline API
- Facility metadata APIs
- Dispatcher recommendations
- Marketplace analytics API

## Accessibility expectations

- Preserve semantic HTML, keyboard focus order, ARIA labels, and reduced-motion behavior from the existing component library.
- New UI integrations should be verified with keyboard-only navigation and screen reader labels for dispatch, pricing, analytics, and facility forms.

## Security expectations

- Do not expose broker-only pricing fields to driver or provider screens.
- Keep staff-only facility and marketplace analytics actions behind existing role gates.
- Treat missing production credentials as recoverable setup states; never crash user-facing screens for absent optional providers.
