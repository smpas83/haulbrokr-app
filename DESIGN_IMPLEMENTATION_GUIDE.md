# Design Implementation Guide

## Homepage migration complete

The public HaulBrokr homepage has been replaced with a premium enterprise landing page focused on the approved design language: matte black, carbon fiber, graphite, brushed steel, industrial lighting, restrained orange accents, cinematic truck photography, and spacious SaaS-style presentation.

The migration is limited to the signed-out `/` homepage route. Authenticated dashboards, onboarding, marketplace workflows, payments, dispatch logic, pricing, notifications, and backend behavior were not changed.

## Components used

- `Button` for primary and secondary calls to action.
- `Card`, `CardHeader`, `CardContent`, and `CardTitle` for metrics, feature cards, workflow panels, and map presentation.
- `Badge` for live marketplace status.
- `HoverCard`, `HoverCardTrigger`, and `HoverCardContent` for interactive map marker details.
- Existing Tailwind/tw-animate classes for fade and slide transitions.
- Existing design tokens from `src/index.css` for primary, background, foreground, border, card, muted, and ring colors.
- Existing public logo asset: `/haulbrokr-logo.png`.
- Existing truck hero asset: `/opengraph.jpg`.

## Remaining design packages

- Final production hero photography should be supplied as dedicated AVIF/WebP crops for desktop, tablet, and mobile. The current implementation reuses the existing Open Graph truck image.
- Named web animation wrapper components (`FadeIn`, `SlideUp`, `PageTransition`, `LoadingTransition`) are not present in the web package. The page uses the existing Tailwind/tw-animate animation infrastructure instead.
- A public live-map data contract is not exposed for signed-out visitors. The homepage map is a presentation layer using existing marketplace concepts and does not call protected backend endpoints.

## Known issues

- The interactive map is a styled public preview, not a live unauthenticated map.
- App Store, Google Play, Social, Careers, and some footer links currently route to existing sign-up or support destinations until final public URLs are provided.
- The existing Open Graph truck image is a JPG and is reused in two lazy-loaded places; dedicated responsive WebP/AVIF assets would improve LCP and bandwidth.

## Performance notes

- The hero image is loaded eagerly with `fetchPriority="high"` because it is the LCP candidate.
- Secondary truck imagery is lazy-loaded.
- The authenticated shell remains code-split behind the existing `AuthShell` lazy import.
- Counter animation respects `prefers-reduced-motion`.
- No backend calls were added to the public homepage.
