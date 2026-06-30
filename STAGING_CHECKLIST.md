# HaulBrokr Staging Checklist

Run this checklist with test credentials and Stripe test mode only. Record user IDs, job IDs, request IDs, and webhook event IDs for each pass/fail.

## Customer workflow

- [ ] Register customer account.
- [ ] Complete customer onboarding.
- [ ] Create job request with valid pickup, dump site, material, truck count, and schedule.
- [ ] Confirm request appears in customer request list.
- [ ] Confirm provider quote/bid appears.
- [ ] Select vendor quote.
- [ ] Confirm job is created from accepted quote.
- [ ] Pay with Stripe test card.
- [ ] Confirm payment status updates in job detail.
- [ ] Track assigned driver/truck view.
- [ ] Confirm ETA display is present and accurate enough for staging.
- [ ] Receive uploaded driver photos.
- [ ] Receive uploaded ticket/evidence.
- [ ] Approve completion.
- [ ] Leave customer review.

## Vendor workflow

- [ ] Register provider account.
- [ ] Complete provider onboarding.
- [ ] Submit compliance fields and documents.
- [ ] Complete Stripe Connect test onboarding.
- [ ] Confirm account/payout status.
- [ ] View available request.
- [ ] Submit quote/bid.
- [ ] Receive accepted dispatch/job.
- [ ] Accept job.
- [ ] Add or select fleet/driver.
- [ ] Assign driver.
- [ ] View payments and payout status.
- [ ] Confirm provider review flow.

## Driver workflow

- [ ] Log in on Expo app.
- [ ] Join provider org with invite code if needed.
- [ ] Confirm compliance-approved or pending state matches admin queue.
- [ ] View assigned job.
- [ ] Accept assigned job if applicable.
- [ ] Open navigation/map path.
- [ ] Check in.
- [ ] Log load.
- [ ] Upload pickup/load photos.
- [ ] Upload ticket or ticket evidence.
- [ ] Deliver load.
- [ ] Upload delivery proof.
- [ ] Complete job.
- [ ] Leave driver review where available.

## Admin workflow

- [ ] Open `/admin/login`.
- [ ] Sign in with seeded staff credentials.
- [ ] Confirm dashboard overview loads.
- [ ] Dispatch or monitor active job.
- [ ] Reassign driver.
- [ ] Track fleet/job status.
- [ ] Review compliance queue.
- [ ] Approve/reject compliance document.
- [ ] Review payment queue.
- [ ] Retry or inspect payout status.
- [ ] Confirm notifications/activity entries appear.
- [ ] Confirm audit-relevant staff actions are visible in admin views/logs.

## Payments

- [ ] Stripe Checkout test payment succeeds.
- [ ] Stripe Checkout cancelled return succeeds.
- [ ] Saved payment method path succeeds.
- [ ] Stripe Connect onboarding return succeeds.
- [ ] Webhook signature verification rejects unsigned requests.
- [ ] Webhook test event updates expected job/account state.
- [ ] `PAYMENTS_MOCK_MODE` is unset or `false`.

## Notifications

- [ ] Customer receives bid/job/payment activity.
- [ ] Provider receives dispatch/job/payment activity.
- [ ] Driver sees assigned job/activity in mobile feed.
- [ ] Email notification is delivered through Resend.
- [ ] In-app unread state clears after viewing notifications.

## Tracking

- [ ] Customer can open tracking view.
- [ ] Driver status updates are reflected on the job.
- [ ] ETA is visible.
- [ ] Known live GPS limitations are accepted or marked blocking before launch.

## Compliance

- [ ] Provider compliance submission creates admin queue item.
- [ ] Driver documents upload successfully.
- [ ] Rejection note appears to applicant.
- [ ] Approval unlocks expected workflow.
- [ ] Private compliance objects require authorization.

## Ratings

- [ ] Customer can review provider after completion.
- [ ] Provider/driver review flow appears when eligible.
- [ ] Duplicate or premature reviews are rejected.
- [ ] Ratings display in relevant job/profile surfaces.
