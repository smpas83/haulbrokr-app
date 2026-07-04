# SEO Strategy

## In scope

- Public marketing page (`/`)
- Public support/help page (`/support`)
- Public legal/privacy page (`/privacy`)

## Out of scope

- Authenticated product routes (`/dashboard`, `/requests/**`, `/fleet/**`, `/jobs/**`, `/account`, `/company`, `/bins/**`, `/projects/**`, `/factoring`, `/integrations`, `/admin`)
- Auth utility routes (`/sign-in`, `/sign-up`, `/onboarding`)
- Mobile app, pitch deck, and internal dev tooling artifacts

## Target audience

- Construction contractors posting haul requests
- Independent haulers / owner-operators
- Fleet owners managing dump-truck operations

## Primary keywords

- Hauling marketplace
- Dump truck marketplace
- Construction hauling app
- Find dump trucks / haulers
- Fleet dispatch and hauling jobs

## Notes

- Scope inferred from the deployed web artifact source at `artifacts/haulbrokr`.
- The website is a Vite + React app with Wouter client-side routing.
- Public `/`, `/support`, and `/privacy` routes are implemented through route-specific HTML shells plus a post-build prerender step, while authenticated product routes remain client-rendered.

## Dismissed categories

- (None yet)
