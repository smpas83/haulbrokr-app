# HaulBrokr Design Implementation Guide

This guide records the frontend implementation contract for HaulBrokr. Product
vision, UX, UI, branding, visual identity, motion, layout, component design, and
creative direction come from ChatGPT-authored design packages. Engineering
implements those packages faithfully.

## Implementation rule

Do not redesign screens. Do not invent layouts, substitute components, simplify
the design, or change branding decisions. When a design package is ambiguous,
stop implementation for that surface, document the question, and wait for the
missing specification.

## Required design package inputs

Every frontend implementation package should include:

- Target routes, platforms, and user roles.
- Desktop, tablet, mobile, and landscape states where applicable.
- Component inventory and expected reuse from the existing design system.
- Empty, loading, error, offline, reconnecting, and permission-denied states.
- Accessibility requirements beyond the platform defaults.
- Motion behavior and reduced-motion expectations.
- API endpoints or existing data sources to use.
- Screenshots, Figma frames, or explicit visual specifications.

## Engineering standards

- Reuse shared components, tokens, layouts, and animation primitives.
- Keep styles token-driven; avoid inline styling, one-off colors, spacing, or
  typography.
- Prefer generated API clients when OpenAPI coverage exists.
- Do not duplicate backend logic or invent backend behavior.
- Preserve RBAC, authentication, authorization, input validation, auditability,
  and private financial data boundaries.
- Maintain semantic HTML, keyboard navigation, ARIA, focus order, screen-reader
  behavior, reduced motion, and color contrast.
- Profile meaningful UI work for bundle size, rendering cost, API behavior, and
  map performance.

## Map implementation standards

Maps are a signature HaulBrokr experience and should remain purpose-built for
dump trucking. Reuse existing APIs and map infrastructure for live truck
locations, pickup pins, dropoff facilities, routes, ETA, clustering, geofences,
driver tracking, customer tracking, fleet tracking, dark mode, and performance
work. Do not introduce speculative map data or backend workflows.

## Validation workflow

For each concrete design package, run the relevant verification set:

- `pnpm run typecheck`
- `pnpm --filter @workspace/api-server run test`
- `pnpm --filter @workspace/haulbrokr run test`
- `pnpm --filter @workspace/haulbrokr-mobile run test`
- `pnpm run build`

If a command is blocked by missing staging credentials or local environment
requirements, record the blocker in `BETA_TEST_REPORT.md`.

## Current open specification blocker

No concrete ChatGPT design package is attached to this implementation mission.
Frontend screen work should wait for the next approved package before changing
visual layout, branding, motion, or UX.
