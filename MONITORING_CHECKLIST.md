# HaulBrokr Monitoring Checklist

## Availability

- [ ] Render service uptime alert.
- [ ] Vercel web availability alert.
- [ ] `/api/healthz` liveness alert.
- [ ] `/api/readyz` readiness/database alert.
- [ ] DNS and SSL certificate expiry monitoring.

## Application errors

- [ ] API 5xx rate alert.
- [ ] Web client error monitoring.
- [ ] Mobile crash reporting.
- [ ] Stripe webhook failure alert.
- [ ] Resend delivery failure alert.
- [ ] R2 upload/finalize failure alert.
- [ ] Clerk auth failure spike alert.

## Business workflows

- [ ] New request created counter.
- [ ] Bid submitted counter.
- [ ] Job awarded counter.
- [ ] Payment succeeded/failed counters.
- [ ] Stripe Connect onboarding completed counter.
- [ ] Compliance approvals/rejections counter.
- [ ] Driver upload/evidence counter.
- [ ] Completion approval counter.

## Performance

- [ ] API p95 latency.
- [ ] Database query latency.
- [ ] Render CPU/memory.
- [ ] Vercel build and edge error rates.
- [ ] Bundle size trend.
- [ ] Mobile startup/crash trend.

## Security

- [ ] Staff login 401/429 spike alert.
- [ ] Admin access denied spike alert.
- [ ] Stripe signature failure spike alert.
- [ ] Upload authorization failure spike alert.
- [ ] Suspicious CORS origin logs reviewed.

## Operations

- [ ] Daily staging smoke.
- [ ] Daily production readiness smoke.
- [ ] Weekly restore/snapshot review.
- [ ] Weekly dependency and secret rotation review.
- [ ] Incident contacts verified.
