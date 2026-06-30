# HaulBrokr Rollback Checklist

## Decision gate

- [ ] Identify failed workflow or incident.
- [ ] Confirm severity and user impact.
- [ ] Decide whether rollback is safer than forward fix.
- [ ] Assign rollback lead and communications owner.

## Web rollback

- [ ] Revert Vercel to the previous known-good deployment.
- [ ] Confirm `https://haulbrokr.com` loads.
- [ ] Confirm `/api/readyz` still proxies to healthy API.
- [ ] Clear any stale feature/config assumptions from release notes.

## API rollback

- [ ] Revert Render to previous known-good deploy/image.
- [ ] Confirm `/api/healthz`.
- [ ] Confirm `/api/readyz`.
- [ ] Confirm Stripe webhook endpoint responds.
- [ ] Confirm staff admin login still works.

## Database rollback

- [ ] Do not roll back schema after production writes unless a tested down migration exists.
- [ ] If schema rollback is required, snapshot database first.
- [ ] Confirm app version and schema version compatibility.
- [ ] Verify no jobs/payments/uploads are orphaned.

## Third-party rollback

- [ ] Restore previous Stripe webhook endpoint if changed.
- [ ] Restore previous Clerk domain/redirect settings if changed.
- [ ] Restore previous R2 bucket/CORS settings if changed.
- [ ] Restore previous Resend sender settings if changed.
- [ ] Restore previous mobile build distribution only through App Store/TestFlight/Play controls.

## Verification

- [ ] Run `node scripts/verify-deployment-readiness.mjs`.
- [ ] Run customer smoke test.
- [ ] Run provider smoke test.
- [ ] Run admin smoke test.
- [ ] Document rollback reason, exact timestamps, commit SHAs, and residual risk.
