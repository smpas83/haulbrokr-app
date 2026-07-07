# App Store Review Notes

**App:** HaulBrokr  
**Bundle ID:** `com.haulbrokr.mobile`  
**Date:** 2026-07-07

## Demo Account Credentials

Please use these credentials to sign in:

| Field        | Value                        |
| ------------ | ---------------------------- |
| **Email**    | `apple-review@haulbrokr.com` |
| **Password** | `Apple1demo123!`             |
| **Username** | `apple-review`               |

Sign in with **email + password** on the Sign In tab. This account is pre-seeded with a provider profile, fleet trucks, and an open load request so reviewers can explore the map, jobs, fleet, and account tabs.

> The previously suggested credentials (`Apple1demo` / `Apple1demo`) are retired. Use the email/password above.

## Authentication Fixes (This Build)

We resolved the authentication issues from the prior rejection:

1. **Email verification** — After entering the 6-digit code, the app now activates the Clerk session immediately and routes to onboarding or the main app. The "Verification incomplete" message no longer appears when Clerk returns a complete signup.

2. **Google & Apple Sign In** — OAuth flows now use the authorized native redirect URI `haulbrokr://oauth-callback`. The following redirect patterns are registered with Clerk:
   - `haulbrokr://`
   - `haulbrokr://*`
   - `https://haulbrokr.com/*`
   - `https://www.haulbrokr.com/*`

3. **Deep linking** — iOS associated domains and Android intent filters are configured for `haulbrokr://` and `https://haulbrokr.com`.

## How to Test

1. Launch the app → Sign In screen appears.
2. Enter email `apple-review@haulbrokr.com` and password `Apple1demo123!`.
3. If prompted for email verification on a new signup, enter the code — app should proceed automatically.
4. Alternatively, tap **Continue with Google** or **Continue with Apple** (requires network; uses native OAuth redirect).
5. After sign-in, explore tabs: Map (loads), Jobs, Fleet, Account.

## Support Contact

`support@haulbrokr.com`

## Notes for Reviewer

- Location permission is used to show nearby haul loads on the map.
- Camera/photo permission is used for job documentation and compliance uploads.
- Payments use Stripe hosted checkout; no real charges occur on the demo account unless a test card is entered.
