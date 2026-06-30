# HaulBrokr Release Notes

## Release candidate status

This release candidate focuses on production readiness, security hardening, deployment verification, and documentation. No UI redesign or major product feature work is included.

## Verification completed

- `pnpm run typecheck` passes across the workspace.
- `pnpm run build` passed at baseline before release hardening.
- `pnpm -r --if-present run test` passed at baseline before release hardening.
- `pnpm -r --if-present run lint` passed at baseline before release hardening.
- Targeted API tests for readiness and staff auth hardening pass.

## Production readiness changes

- Restricted credentialed API CORS to known production origins plus explicitly configured origins.
- Added security headers to the API and Vercel web deployments.
- Added `/api/readyz`, which verifies database connectivity for readiness probes.
- Updated Render, Docker, and post-deploy smoke verification to use `/api/readyz`.
- Added rate limiting for repeated failed staff admin login attempts.
- Fixed staff-cookie admin login navigation so `/admin` can run the existing staff access check without requiring a Clerk session first.
- Updated production environment and deployment documentation for CORS, readiness, and optional automation credentials.

## Remaining known issues

See `KNOWN_ISSUES.md` for the current blocker and non-blocker issue list.

## Recommendation

Ready for staging after deploying this branch to a staging environment with real Clerk, Stripe test-mode, R2, Resend, and Neon credentials. Not ready for production until the live external-service E2E checklist is executed and remaining known gaps are accepted or resolved.
