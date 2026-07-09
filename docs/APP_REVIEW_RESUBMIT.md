# App Store Resubmit — July 9, 2026

Fixes Apple rejection of **HaulBrokr iOS 1.0 (11)** for:

| Guideline | Issue | Fix |
|-----------|-------|-----|
| **2.1(a)** Performance | Sign in with Apple failed | Complete Clerk transfer sign-up by auto-filling required username |
| **5.1.1(v)** Privacy | No account deletion | In-app **Delete Account** (mobile + web) + `DELETE /profiles/me` |

PR: https://github.com/smpas83/haulbrokr-app/pull/114  
Branch: `cursor/app-review-apple-auth-deletion-401a`

---

## Blocker before build (operator action)

GitHub Actions TestFlight fails because **`EXPO_TOKEN` is empty**.

1. Create an Expo access token: https://expo.dev/accounts/[account]/settings/access-tokens  
2. Add repo secret `EXPO_TOKEN` in GitHub → Settings → Secrets → Actions  
3. Then either:
   - Merge PR #114 to `master` (auto-triggers Mobile TestFlight), **or**
   - From a machine with Expo login:

```bash
cd artifacts/haulbrokr-mobile
pnpm exec eas build --platform ios --profile production --non-interactive
pnpm exec eas submit --platform ios --profile production --latest --non-interactive
```

Or use the helper:

```bash
./scripts/ship-ios-testflight.sh
```

---

## Pre-submit checklist

- [ ] Merge / ship PR #114
- [ ] Set GitHub secret `EXPO_TOKEN` (or run `eas` locally while logged in)
- [ ] Confirm EAS secrets include `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...`
- [ ] `pnpm --filter @workspace/api-server run seed-apple-review` against production DB
- [ ] Install new build from TestFlight (build ≥ 12)
- [ ] Verify Sign in with Apple (new Apple ID)
- [ ] Verify Account → Delete Account flow
- [ ] Record device video of sign-in → delete → confirm
- [ ] Paste Review Notes below into App Store Connect
- [ ] Reply to App Review with the recording attached / linked in Notes
- [ ] Resubmit version

---

## App Store Connect — Review Notes (paste)

```
HaulBrokr — App Review resubmission

Demo account (password sign-in):
  Username: Apple1demo
  Email:    apple-review@haulbrokr.com
  Password: Apple1demo

Guideline 2.1 — Sign in with Apple:
  Fixed. New Apple users now complete Clerk sign-up when a username is
  required. Please retry Sign in with Apple on this build.

Guideline 5.1.1 — Account deletion:
  Account → Delete Account (two confirmation steps).
  This permanently deletes the auth identity and personal data.
  Path: Sign in → Account tab → Delete Account → Continue → Delete Account.

Please see the attached device screen recording demonstrating:
  1) Sign in with the demo account (or Sign in with Apple)
  2) Navigate to Account → Delete Account
  3) Complete deletion through confirmation
```

---

## Reply to App Review (paste)

```
Hello App Review team,

Thank you for the feedback on submission 9bbb0fcf-5046-4e17-b665-0781e0978b6a.

We have fixed both issues in this build:

1) Guideline 2.1(a) — Sign in with Apple
   Root cause: new Apple users transferred into Clerk SignUp with a required
   username field that Apple does not provide, so the session never activated.
   The app now completes that requirement and activates the session.

2) Guideline 5.1.1(v) — Account deletion
   Users can permanently delete their account in-app:
   Account tab → Delete Account → confirm twice.
   This removes personal data and the Clerk authentication identity.

Demo credentials:
  Username: Apple1demo
  Password: Apple1demo

A device screen recording of sign-in and the full account deletion flow is
included in App Review Information / Notes.

Please let us know if you need anything else.
```

---

## Device test script (physical iPhone + TestFlight)

1. Install the new build; uninstall any older HaulBrokr first if needed.
2. **Sign in with Apple** with a fresh Apple ID (or Hide My Email) → should reach onboarding/home, not the red error.
3. Sign out.
4. Sign in with `Apple1demo` / `Apple1demo`.
5. Open **Account** tab → scroll to **Delete Account**.
6. Confirm twice → account deleted → returned to sign-in.
7. Screen-record steps 4–6 for App Review Notes.
