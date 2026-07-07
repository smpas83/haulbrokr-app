# HaulBrokr Deployment Checklist

Start from empty provider accounts and complete these steps in order.

## 1. Accounts and access

- [ ] Create or confirm GitHub repository access.
- [ ] Create Neon account and project.
- [ ] Create Stripe account and enable Connect.
- [ ] Create Clerk application.
- [ ] Create Cloudflare account and R2 bucket.
- [ ] Create Resend account and verify sending domain.
- [ ] Create Render account.
- [ ] Create Vercel account.
- [ ] Create Expo/EAS account and project access.
- [ ] Confirm DNS registrar access for `haulbrokr.com`.

## 2. Neon / Supabase-compatible Postgres

- [ ] Create Neon project, database, and role.
- [ ] Copy pooled `DATABASE_URL`.
- [ ] Confirm `DATABASE_URL` includes `sslmode=require`.
- [ ] Run `DATABASE_URL="..." pnpm --filter @workspace/db run push`.
- [ ] Run `STAFF_DEFAULT_PASSWORD="..." pnpm --filter @workspace/api-server run seed-staff`.
- [ ] Save database rollback constraints: do not roll back schema after production writes without a tested migration.

## 3. Clerk

- [ ] Configure application domains: `haulbrokr.com`, `www.haulbrokr.com`, staging domain.
- [ ] Configure sign-in and sign-up paths: `/sign-in`, `/sign-up`.
- [ ] Enable required social providers.
- [ ] Configure Apple Sign-In for `com.haulbrokr.mobile`.
- [ ] Enable **Native applications** in Clerk.
- [ ] Add redirect URIs: `haulbrokr://`, `haulbrokr://*`, `haulbrokr://sso-callback`, `https://haulbrokr.com/*`, `https://www.haulbrokr.com/*`.
- [ ] Copy `CLERK_SECRET_KEY`.
- [ ] Copy `CLERK_PUBLISHABLE_KEY`.
- [ ] Copy publishable key to Vercel as `VITE_CLERK_PUBLISHABLE_KEY`.
- [ ] Copy publishable key to EAS as `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`.
- [ ] Set `VITE_CLERK_PROXY_URL=/api/__clerk`.

## 4. Stripe

- [ ] Start in test mode.
- [ ] Enable Stripe Connect Express accounts.
- [ ] Copy `STRIPE_SECRET_KEY=sk_test_...`.
- [ ] Copy `STRIPE_PUBLISHABLE_KEY=pk_test_...`.
- [ ] Create webhook endpoint: `https://haulbrokr-api.onrender.com/api/webhooks/stripe`.
- [ ] Subscribe to `payment_intent.succeeded`, `payment_intent.payment_failed`, `checkout.session.completed`, `account.updated`.
- [ ] Copy `STRIPE_WEBHOOK_SECRET=whsec_...`.
- [ ] Confirm `PAYMENTS_MOCK_MODE` is unset or `false`.
- [ ] After staging passes, repeat with live keys for production.

## 5. Cloudflare R2

- [ ] Create R2 bucket.
- [ ] Create scoped R2 access key pair.
- [ ] Set `R2_ACCOUNT_ID`.
- [ ] Set `R2_ACCESS_KEY_ID`.
- [ ] Set `R2_SECRET_ACCESS_KEY`.
- [ ] Set `R2_BUCKET`.
- [ ] Configure public/custom domain and set `R2_PUBLIC_URL`.
- [ ] Set `PRIVATE_OBJECT_DIR=/haulbrokr/private`.
- [ ] Set `PUBLIC_OBJECT_SEARCH_PATHS=/haulbrokr/public`.
- [ ] Upload a test public object and confirm the public URL works.

## 6. Resend

- [ ] Add sending domain.
- [ ] Configure DNS records required by Resend.
- [ ] Verify domain status in Resend.
- [ ] Create API key and set `RESEND_API_KEY`.
- [ ] Set `RESEND_FROM_EMAIL=noreply@haulbrokr.com` or verified equivalent.
- [ ] Send one staging transactional email.

## 7. Google Maps

- [ ] Create Google Cloud project.
- [ ] Enable Maps SDKs required by Expo/mobile.
- [ ] Create `GOOGLE_MAPS_API_KEY`.
- [ ] Restrict key by Android package and iOS bundle where applicable.
- [ ] Add key to EAS secrets.
- [ ] Confirm map screen loads in a staging mobile build.

## 8. Render API

- [ ] Connect repository.
- [ ] Create Blueprint from `render.yaml`.
- [ ] Set all Render/API variables from `ENVIRONMENT_INVENTORY.md`.
- [ ] Confirm plan is always-on for staging/prod reliability.
- [ ] Deploy API.
- [ ] Confirm `https://haulbrokr-api.onrender.com/api/healthz`.
- [ ] Confirm `https://haulbrokr-api.onrender.com/api/readyz`.
- [ ] Confirm Stripe webhook endpoint returns 400 without signature and succeeds with Stripe test event.

## 9. Vercel web

- [ ] Import repository.
- [ ] Set root directory to `artifacts/haulbrokr` if deploying the app artifact directly.
- [ ] Set `VITE_CLERK_PUBLISHABLE_KEY`.
- [ ] Set `VITE_CLERK_PROXY_URL=/api/__clerk`.
- [ ] Confirm `/api/*` rewrite targets the Render API.
- [ ] Deploy web.
- [ ] Confirm `https://haulbrokr.com`.
- [ ] Confirm `https://haulbrokr.com/api/readyz`.
- [ ] Confirm `https://haulbrokr.com/admin/login`.

## 10. Expo / EAS

- [ ] Set `EXPO_PUBLIC_DOMAIN=haulbrokr.com`.
- [ ] Set `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`.
- [ ] Set `GOOGLE_MAPS_API_KEY`.
- [ ] Build iOS preview/staging.
- [ ] Build Android preview/staging.
- [ ] Verify camera, photo library, and location permission prompts.
- [ ] Verify deep links and Stripe return links.

## 11. DNS and SSL

- [ ] Add `haulbrokr.com` and `www.haulbrokr.com` to Vercel.
- [ ] Configure DNS records at registrar.
- [ ] Wait for Vercel SSL certificate issuance.
- [ ] Confirm HTTPS redirect.
- [ ] Confirm HSTS/security headers.
- [ ] Optionally configure `api.haulbrokr.com`; otherwise keep Vercel `/api` proxy.

## 12. Health checks and validation

- [ ] Run `node scripts/verify-deployment-readiness.mjs`.
- [ ] Run `WEB_URL=https://haulbrokr.com API_DIRECT=https://haulbrokr-api.onrender.com ./scripts/verify-production.sh`.
- [ ] Run full `STAGING_CHECKLIST.md`.
- [ ] Record all failures before go-live.
