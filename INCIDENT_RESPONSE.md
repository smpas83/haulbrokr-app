# HaulBrokr Incident Response

## Severity levels

| Severity | Definition                                       | Examples                                                                |
| -------- | ------------------------------------------------ | ----------------------------------------------------------------------- |
| SEV1     | Marketplace unavailable or money movement broken | API down, DB unreachable, Stripe payments failing globally              |
| SEV2     | Major workflow degraded                          | provider dispatch broken, uploads failing, admin compliance unavailable |
| SEV3     | Limited user or non-critical workflow impact     | email delays, isolated UI error, reporting issue                        |
| SEV4     | Low-risk operational issue                       | documentation mismatch, cosmetic staging-only issue                     |

## Immediate response

1. Assign incident commander.
2. Open incident log with timestamp, severity, owner, and affected systems.
3. Confirm current deploy SHAs for web and API.
4. Check `/api/healthz` and `/api/readyz`.
5. Check Render, Vercel, Neon, Clerk, Stripe, R2, Resend, and Google status pages.
6. Decide: mitigate, rollback, or forward fix.

## Diagnostic checklist

- [ ] Web homepage status.
- [ ] API direct readiness.
- [ ] API proxied readiness.
- [ ] Database connectivity.
- [ ] Clerk sign-in.
- [ ] Stripe webhook delivery.
- [ ] Stripe Dashboard event errors.
- [ ] R2 upload and object access.
- [ ] Resend delivery logs.
- [ ] Admin access and staff login.
- [ ] Recent deploys and config changes.

## Communication

- [ ] Internal status update every 15 minutes for SEV1/SEV2.
- [ ] Customer-facing update if user impact is confirmed.
- [ ] Note affected roles: customer, provider, driver, admin.
- [ ] Note whether payments or personal data are affected.

## Mitigation options

- Roll back Vercel deployment.
- Roll back Render deployment.
- Disable traffic to broken webhook only after confirming Stripe retry behavior.
- Pause go-live or marketing traffic.
- Temporarily route manual dispatch/admin operations through staff process.

## Recovery

- [ ] Confirm smoke checks pass.
- [ ] Confirm affected workflow works end-to-end.
- [ ] Confirm no stuck payments, jobs, uploads, or compliance records.
- [ ] Close incident only after monitoring remains stable.

## Post-incident review

- [ ] Timeline.
- [ ] Root cause.
- [ ] Customer impact.
- [ ] Detection gap.
- [ ] Prevention action.
- [ ] Owner and due date for follow-up work.
