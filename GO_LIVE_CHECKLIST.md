# HaulBrokr Go-Live Checklist

## Release gate

- [ ] Current release branch is merged and tagged.
- [ ] `pnpm run typecheck` passes.
- [ ] `pnpm run build` passes.
- [ ] `pnpm -r --if-present run test` passes.
- [ ] `pnpm -r --if-present run lint` passes.
- [ ] `node scripts/verify-deployment-readiness.mjs` passes with production env.
- [ ] `STAGING_CHECKLIST.md` is complete with no unaccepted blockers.
- [ ] `KNOWN_ISSUES.md` is reviewed and accepted by release owner.

## Production configuration

- [ ] Render API deployed from the final commit.
- [ ] Vercel web deployed from the final commit.
- [ ] Neon production database schema deployed.
- [ ] Clerk production domains configured.
- [ ] Stripe live keys configured.
- [ ] Stripe live webhook configured.
- [ ] R2 production bucket configured.
- [ ] Resend production sender domain verified.
- [ ] Google Maps production key restrictions configured.
- [ ] Staff users seeded and default password rotated.
- [ ] `PAYMENTS_MOCK_MODE` unset or `false`.

## Smoke checks

- [ ] `https://haulbrokr.com` loads.
- [ ] `https://haulbrokr.com/api/readyz` returns `{"status":"ok"}`.
- [ ] `https://haulbrokr-api.onrender.com/api/readyz` returns `{"status":"ok"}`.
- [ ] Customer sign-up works.
- [ ] Provider sign-up works.
- [ ] Admin staff login works.
- [ ] Stripe test/live penny transaction path is verified according to release policy.
- [ ] File upload path works.
- [ ] Resend email arrives.
- [ ] Mobile build can authenticate and reach API.

## Launch

- [ ] Freeze deployments during go-live window.
- [ ] Start monitoring dashboard.
- [ ] Announce internal launch start.
- [ ] Route DNS/custom domains if not already active.
- [ ] Run smoke checks again.
- [ ] Announce launch complete.
