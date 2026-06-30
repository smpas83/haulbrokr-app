# HaulBrokr Production Readiness Checklist

Use this checklist for the final launch gate. Do not launch until every automated command passes and every manual workflow is verified against production-like services.

## Automated verification

- `pnpm run typecheck`
- `pnpm run build`
- `pnpm -r --if-present run test`
- `pnpm -r --if-present run lint`
- `WEB_URL=https://haulbrokr.com API_DIRECT=https://haulbrokr-api.onrender.com scripts/verify-production.sh`

## Required environment variables

### Render API

- `NODE_ENV=production`
- `PORT=8080`
- `DATABASE_URL` (Neon pooled URL with `sslmode=require`)
- `CLERK_SECRET_KEY`
- `CLERK_PUBLISHABLE_KEY`
- `ADMIN_USER_IDS`
- `STRIPE_SECRET_KEY`
- `STRIPE_PUBLISHABLE_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET`
- `R2_PUBLIC_URL`
- `PRIVATE_OBJECT_DIR=/haulbrokr/private`
- `PUBLIC_OBJECT_SEARCH_PATHS=/haulbrokr/public`
- `UPLOAD_TOKEN_SECRET`
- `TICKET_QR_SECRET`
- `STAFF_AUTH_SECRET`
- `CORS_ALLOWED_ORIGINS=https://haulbrokr.com,https://www.haulbrokr.com`

### Vercel web

- `VITE_CLERK_PUBLISHABLE_KEY`
- `VITE_CLERK_PROXY_URL=/api/__clerk`

### EAS mobile

- `EXPO_PUBLIC_DOMAIN=haulbrokr.com`
- `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `GOOGLE_MAPS_API_KEY` restricted to `com.haulbrokr.mobile` and release signing certificates

## Database deployment order

1. Back up the production Neon branch.
2. Apply additive schema/index changes with `DATABASE_URL=... pnpm --filter @workspace/db run push`.
3. Confirm hot-path indexes exist for `requests`, `bids`, `jobs`, `activity`, `tickets`, `job_status_updates`, `delivery_evidence`, `job_messages`, `profiles`, `driver_documents`, and `upload_sessions`.
4. Deploy the Render API.
5. Deploy the Vercel web app.
6. Build and submit the Expo app with production EAS secrets.

## End-to-end workflow smoke tests

### Customer

- Create a job request.
- Receive bids.
- Select a vendor.
- Complete Checkout or saved-payment setup.
- Track the assigned truck from status updates.
- Receive delivery evidence.
- Approve completion.
- Pay/release funds.
- Leave a review.

### Vendor

- Receive awarded dispatch.
- Accept the job.
- Assign a driver/truck.
- Confirm payout account readiness.

### Driver

- See assigned load in mobile.
- Accept/start the load.
- Navigate/check in.
- Mark loading and loaded.
- Upload photos and ticket proof.
- Mark delivery.
- Upload delivery proof.
- Complete the job.

### Admin

- Log in via staff session.
- Dispatch/monitor active jobs.
- Review compliance, W-9, insurance, credit, payouts, and bin orders.
- Confirm notifications and audit/activity records are created.

## Security launch gate

- Clerk domains include `haulbrokr.com` and `www.haulbrokr.com`.
- `PAYMENTS_MOCK_MODE` is unset or `false`.
- Stripe webhook endpoint is live and signature secret matches Render.
- Staff seed passwords have been rotated per user.
- Staff login rate limiting is active.
- CORS only allows production origins plus explicit dev origins.
- R2 public prefixes contain only public assets.
- Google Maps key is platform-restricted.

## Rollback plan

1. Keep the previous Render deploy available in the dashboard.
2. Keep the previous Vercel deployment promoted until smoke tests pass.
3. If API smoke tests fail, roll Render back first.
4. If web routing or Clerk proxy fails, promote the previous Vercel deployment.
5. If schema push causes data issues, restore the Neon backup branch and point Render `DATABASE_URL` back to the restored branch.
6. Disable Stripe webhooks or switch endpoint back to the previous API URL if payment webhooks regress.

## Launch checklist

- Automated verification commands pass.
- Production smoke script passes through Vercel proxy and direct Render API.
- Customer, vendor, driver, and admin workflows pass on production-like accounts.
- Stripe test-mode payment and payout workflow passes before switching to live keys.
- Live Stripe keys and webhook secret are set.
- Staff access is confirmed for at least two launch operators.
- Support/contact email is verified in Resend.
- Mobile builds install and authenticate on iOS and Android.
