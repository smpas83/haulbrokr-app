# Sprint 12 Code Quality & Implementation Prep

Scope: appearance-preserving cleanup for the current HaulBrokr implementation so future design packages can focus on tokens, shared components, and composition.

## Removals completed

- Removed page-local `apiFetch` copies from `artifacts/haulbrokr/src/pages/bins.tsx`, `bin-detail.tsx`, and `job-detail.tsx`; all now use the generated API client where available or the shared `src/lib/apiFetch.ts`.
- Removed unused `useMutation` / `useQuery` imports and the dead `apiFetch()` helper from `artifacts/haulbrokr/src/pages/account.tsx`.
- Removed duplicate `STATUS_STYLE` / `STATUS_LABEL` maps from bin list/detail pages; both consume `src/lib/bin-orders.ts`.
- Removed duplicate `useReverseGeocode()` implementations from bin and request pages; both consume `src/hooks/use-reverse-geocode.ts`.
- Removed hardcoded landing-page hex utilities in favor of brand tokens in `src/index.css`.

## Component standardization

- Bin order list/create now uses generated hooks: `useListBinOrders`, `useCreateBinOrder`, and generated query keys.
- Bin catalog display now consumes server-owned `/api/bins` data through `useListBinCatalog` instead of page-owned catalog arrays.
- Bin cancel remains on shared `apiFetch` because `/bin-orders/:id/cancel` is not exposed by the generated OpenAPI client yet.
- Existing shared `Button` is used for the bin order close control instead of a raw icon-only button.

## CSS cleanup

- Added missing token definitions already referenced by UI primitives: `--button-outline`, `--badge-outline`, `--elevate-*`, `--primary-border`, `--secondary-border`, `--muted-border`, `--accent-border`, and `--destructive-border`.
- Added brand/chart token aliases for upcoming design package swaps: `--brand-bg`, `--brand-bg-elevated`, `--brand-orange`, `--brand-orange-hover`, and `--chart-1` through `--chart-5`.
- Added missing utilities referenced by existing markup: `.hover-elevate`, `.active-elevate-2`, `.neon-orange`, `.industrial-panel`, and `.text-haulbrokr-glow`.
- Replaced 404 page light-mode gray classes with semantic tokens.

## Performance changes

- Added Vite manual chunks for React, Clerk, Stripe, Recharts/D3, Radix, and the auth shell to improve cacheability and make bundle output easier to inspect.
- Added `loading="lazy"` and `decoding="async"` to job evidence and load-ticket photos.
- Added a five-minute stale time to the bin catalog query because catalog/pricing metadata is shared reference data.

## Accessibility changes

- Sidebar and mobile bottom navigation links now expose `aria-current="page"`.
- Mobile navigation trigger now has `aria-label="Open navigation menu"`.
- Bin size cards and service type toggles expose `aria-pressed`.
- Bin order close control has `aria-label="Close order form"`.
- Dump-site search clear control has `aria-label="Clear dump site search"`.
- Raw selectable controls touched in this pass received focus-visible ring styles.

## Remaining credential-dependent beta checklist

- Stripe: verify live `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`, Connect onboarding, webhook endpoint, and that `PAYMENTS_MOCK_MODE` is disabled in production.
- Clerk: verify production Clerk keys, allowed domains, proxy URL, and `ADMIN_USER_IDS`.
- Maps: provision and restrict `GOOGLE_MAPS_API_KEY`; map tab and live GPS tracking remain feature-gated/incomplete.
- Email: verify `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, and sender-domain DNS.
- SMS: no transactional SMS provider is implemented; provider selection and preference persistence remain product/backend work.
- Push: no OS push implementation or push-token registration exists yet.
- Storage: verify all R2 credentials, public URL/CDN, upload token secret, and production object access.

## Remaining non-credential cleanup candidates

- Extract repeated project/factoring/review status badges into shared status primitives.
- Decide whether unused shadcn components should be deleted or moved into a shared `@workspace/ui` package.
- Generate OpenAPI coverage for `/bin-orders/:id/cancel` and remaining handwritten API routes.
- Consider lazy-loading Stripe form components by account/payment tab once payment flows are covered by end-to-end tests.
