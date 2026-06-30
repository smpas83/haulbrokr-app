# HaulBrokr Post-Launch Checklist

## Customer workflow

- [ ] Register and log in.
- [ ] Create a job request.
- [ ] Request trucks.
- [ ] Receive provider quotes.
- [ ] Accept a quote.
- [ ] Pay through Stripe.
- [ ] Track assigned truck and ETA.
- [ ] Receive driver photos.
- [ ] Receive scale tickets.
- [ ] Approve completion.
- [ ] Leave a review.

## Vendor workflow

- [ ] Register provider account.
- [ ] Complete compliance.
- [ ] Complete Stripe Connect onboarding.
- [ ] Receive dispatch.
- [ ] Accept job.
- [ ] Assign driver.
- [ ] View payments.
- [ ] View payout status.

## Driver workflow

- [ ] Log in on Expo app.
- [ ] Confirm compliance-approved state.
- [ ] Accept assigned job.
- [ ] Open navigation/map flow.
- [ ] Check in.
- [ ] Load.
- [ ] Upload photos.
- [ ] Upload scale ticket evidence.
- [ ] Deliver.
- [ ] Upload delivery proof.
- [ ] Complete job.
- [ ] Leave review.

## Dispatcher/admin workflow

- [ ] Open dashboard.
- [ ] Dispatch job.
- [ ] Reassign driver.
- [ ] Track fleet.
- [ ] Review compliance queue.
- [ ] Review payment queue.
- [ ] Verify notifications.
- [ ] Review audit logs.

## Mobile verification

- [ ] Authentication.
- [ ] Realtime tracking behavior and limitations documented in `KNOWN_ISSUES.md`.
- [ ] Driver workflow.
- [ ] Photo uploads.
- [ ] Ticket uploads.
- [ ] Notifications behavior and limitations documented in `KNOWN_ISSUES.md`.
- [ ] Maps.
- [ ] Offline recovery behavior and limitations documented in `KNOWN_ISSUES.md`.
- [ ] Deep links.
- [ ] Camera permissions.
- [ ] Location permissions.
- [ ] Background location support if enabled.

## Production operations

- [ ] `/api/readyz` returns `{"status":"ok"}` on Render.
- [ ] `/api/readyz` returns `{"status":"ok"}` through Vercel proxy.
- [ ] Stripe webhook events are delivered and acknowledged.
- [ ] Clerk production domains work for sign-in and sign-up.
- [ ] R2 upload and private object retrieval work.
- [ ] Resend sends transactional email.
- [ ] Staff admin login is rate-limited and RBAC is enforced.
- [ ] Rollback path is documented for the release.
