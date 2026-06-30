# HaulBrokr Production Deployment Guide

## Deployment order

1. Provision Neon Postgres and set `DATABASE_URL` with `sslmode=require`.
2. Run database schema deployment: `pnpm --filter @workspace/db run push`.
3. Configure Render API environment variables from `ENVIRONMENT_INVENTORY.md`.
4. Deploy the Render API from `render.yaml`.
5. Verify API readiness: `curl https://haulbrokr-api.onrender.com/api/readyz`.
6. Configure Vercel web environment variables.
7. Deploy the Vercel web app.
8. Verify proxied readiness: `curl https://haulbrokr.com/api/readyz`.
9. Configure Clerk domains and redirect URLs.
10. Configure Stripe live or staging webhooks.
11. Configure Cloudflare R2 bucket, private prefix, and public prefix.
12. Configure Resend sender domain.
13. Configure Google Maps keys for mobile with platform restrictions.
14. Seed staff users with a strong `STAFF_DEFAULT_PASSWORD`, then rotate credentials.
15. Run `scripts/verify-production.sh`.

## Required production services

- Vercel for the React web app.
- Render for the Express API.
- Neon Postgres for the database.
- Clerk for auth.
- Stripe for payments and Connect.
- Cloudflare R2 for uploads.
- Resend for transactional email.
- Google Maps for mobile map functionality.

## Required checks before traffic

- `pnpm run typecheck`
- `pnpm run build`
- `pnpm -r --if-present run test`
- `pnpm -r --if-present run lint`
- `pnpm run verify:deployment`
- `scripts/verify-production.sh`
- Stripe webhook delivery test for payment and Connect events.
- Clerk sign-in/sign-up smoke test on production domains.
- R2 upload and private-object access smoke test.
- Staff admin login and RBAC smoke test.

## Rollback

1. Revert Vercel to the previous successful deployment.
2. Revert Render to the previous image/deploy.
3. Do not roll back database schema after production writes unless a tested down migration exists.
4. Disable new Stripe webhook endpoint versions only after confirming the previous API deployment can process events.
5. Record rollback reason, affected workflows, and verification results in the launch log.

## Reference

Use `DEPLOYMENT_CHECKLIST.md` for empty-account setup and `docs/DEPLOY-VERCEL-RENDER.md` for host-specific setup notes.
