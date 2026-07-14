# HaulBrokr — App Store Review Guide

Fill all `TODO_BEFORE_SUBMISSION` placeholders before submitting to App Review.

## Reviewer login

| Field                 | Value                                                                                           |
| --------------------- | ----------------------------------------------------------------------------------------------- |
| App                   | HaulBrokr (iOS)                                                                                 |
| Bundle ID             | `com.haulbrokr.mobile`                                                                          |
| Sign-in               | Email/password **and** Sign in with Apple                                                       |
| Demo account email    | `TODO_BEFORE_SUBMISSION` (seed via `pnpm --filter @workspace/api-server run seed-apple-review`) |
| Demo account password | `TODO_BEFORE_SUBMISSION`                                                                        |
| Notes                 | Demo account is a real Clerk user with a normal session — no security bypass                    |

### Account roles available for review

| Role               | Purpose                                               |
| ------------------ | ----------------------------------------------------- |
| Customer           | Post haul requests, award bids, pay invoices          |
| Provider (carrier) | Bid on loads, submit compliance docs, receive payouts |
| Driver             | Accept assigned loads, capture tickets/POD            |
| Supervisor         | Customer-side field oversight                         |

## Exact workflows to test

1. **Sign in** with the demo account (or Sign in with Apple).
2. Complete / view **Account** onboarding status.
3. **Customer:** open Requests → create a haul request → review bids.
4. **Provider:** open Load Board → place a bid (requires verified W-9 / insurance / DOT).
5. **Driver:** open My Loads → update status → capture scale ticket photo.
6. **Payments:** customer Checkout uses Stripe; review builds use test mode — no live charges.
7. **Privacy policy** and **Terms** from Account → Settings.
8. **Account data export** (below).
9. **Account deletion** (below) — use a disposable review account if testing deletion end-to-end.

## Account deletion path

**Mobile:** Account tab → Privacy & Account → **Delete Account** → confirm with `DELETE`.

**Web:** Account Settings → **Privacy & Account** → **Delete Account** → type `DELETE`.

Behavior:

- Recent authentication / explicit confirmation required
- Shows what will be deleted vs legally retained
- Sole organization owners must transfer ownership first (Company → transfer)
- Revokes Clerk sessions/identity; personal data removed or anonymized
- Financial / tax / dispute / safety records retained as required

## Data export path

**Mobile:** Account → **Export Account Data** → wait for status `ready` → download ZIP.

**Web:** Account → Privacy & Account → **Request Data Export** → **Download** when ready.

Exports include profile, memberships, trucks, job history, assignments, document metadata, invoices/payments, notification prefs, recurring jobs, and user-visible audit events. Secrets and other organizations’ data are excluded. Download URLs are signed and expire.

## Location permission

HaulBrokr requests **When In Use** location to show nearby jobs, calculate distances, and support live job tracking for drivers. Declining location still allows most marketplace flows; map distance features degrade gracefully.

## Camera / photo library permission

- **Camera:** scan scale tickets and capture job documentation / POD photos.
- **Photo library:** attach existing images to jobs and compliance documents.

Permissions are requested at the point of use (ticket capture / document upload), not on first launch.

## Push notifications

Push permission is requested after sign-in when registering an Expo push token — not during the first splash screen. Notifications cover bid awards, job updates, and payout events.

## Payment behavior

- Customers pay via Stripe Checkout / saved card (SetupIntent).
- Providers onboard payouts via Stripe Connect.
- App Review builds should use **Stripe test mode**.
- No real charges are required for review; incomplete Connect onboarding does not crash the app.

## FMCSA / manual review

Carrier DOT/FMCSA verification uses the live QCMobile API when `FMCSA_WEB_KEY` is configured. If live access is unavailable, carriers remain in **pending** status for **staff manual review**. The app never auto-verifies from a partial provider response.

## Sign in with Apple

Sign in with Apple is offered alongside other third-party login options. The Apple credential flow completes account creation through Clerk without collecting a separate password when Apple hides the email.

## Dead buttons / placeholders

Shipped HaulBrokr screens must not contain “coming soon” controls for core marketplace actions. If a secondary integration (e.g. QuickBooks) is simulated, UI copy discloses the limitation.

## Support contacts (fill before submission)

| Purpose                | Contact                                            |
| ---------------------- | -------------------------------------------------- |
| App Review / technical | `TODO_BEFORE_SUBMISSION`                           |
| Privacy requests       | privacy@haulbrokr.com                              |
| General support        | `TODO_BEFORE_SUBMISSION` (also info@haulbrokr.com) |
| Escalation phone       | `TODO_BEFORE_SUBMISSION`                           |

## Privacy & Terms URLs

- Privacy: https://haulbrokr.com/privacy
- Terms: in-app Terms screen + website support page
- In-app: Account → Privacy Policy / Terms of Service
