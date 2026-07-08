# AUTH_FIX_REPORT.md

**Date:** 2026-07-07  
**App:** HaulBrokr iOS (`com.haulbrokr.mobile`)  
**Clerk instance:** Production (`pk_live_` / `sk_live_`)

---

## Executive Summary

Apple rejected the app because authentication failed in production iOS builds. Root causes were:

1. **OAuth redirect URI mismatch** — SSO used `AuthSession.makeRedirectUri()` without an explicit scheme/path, producing unstable URIs that did not match Clerk Native Applications.
2. **Email verification never activated sessions** — After `verifyEmailCode()` succeeded, the app showed "Verification incomplete" instead of calling `setActive({ session })` and navigating to onboarding.
3. **Apple/Google used browser OAuth only** — Production iOS builds need native Sign in with Apple (`@clerk/expo/apple`) and native Google (`@clerk/expo/google`) with proper entitlements and client IDs.
4. **No permanent Apple Review demo account** — Reviewers had no pre-verified account with seeded marketplace data.

All code-side fixes are implemented. Clerk Dashboard redirect URIs and Google client IDs must remain configured as documented below.

---

## Root Causes

| Issue | Root Cause | Impact |
|-------|-----------|--------|
| Clerk redirect | `makeRedirectUri()` called with no `scheme` or `path`; Clerk expects `haulbrokr://sso-callback` | Google/Apple OAuth callback never matched → SSO failed |
| Email verify | `verifyEmailCode` success did not call `setActive`; relied only on `signUp.finalize()` | Users received email codes but stayed on verify screen |
| Apple Sign In | Browser SSO instead of native `useSignInWithApple`; entitlement depended only on `usesAppleSignIn` | Unreliable Apple login on release builds |
| Google OAuth | Missing `EXPO_PUBLIC_CLERK_GOOGLE_*` env vars; browser SSO fallback only | Google login failed in production |
| Demo account | No seeded `apple-review@haulbrokr.com` user | Apple reviewers could not complete review |

---

## Files Changed

### Mobile (`artifacts/haulbrokr-mobile/`)

| File | Change |
|------|--------|
| `lib/clerkOAuth.ts` | **NEW** — Stable redirect URI helper, allowlist constants |
| `lib/clerkAuthLogging.ts` | **NEW** — Structured Clerk error logging |
| `app/sign-in.tsx` | Native Apple/Google flows, explicit `setActive`, resend code, redirect fix |
| `app.json` | `associatedDomains`, `expo-apple-authentication` plugin, `@clerk/expo` with `appleSignIn: true` |
| `app.config.js` | Injects Google client ID env vars into `extra` |
| `.env.example` | Documents `pk_live_` and Google OAuth env vars |
| `test/clerk-auth.test.ts` | **NEW** — Unit tests for redirect URI + error helpers |

### API Server (`artifacts/api-server/`)

| File | Change |
|------|--------|
| `scripts/seed-apple-review-account.ts` | **NEW** — Permanent Apple Review account + demo data |
| `package.json` | Added `seed-apple-review` script |

### Docs

| File | Change |
|------|--------|
| `DEPLOYMENT_CHECKLIST.md` | Clerk Native Applications + redirect URI checklist |
| `docs/DEPLOY-VERCEL-RENDER.md` | Google OAuth EAS secrets + seed-apple-review instructions |

---

## Redirect URIs

### Clerk Dashboard → Native Applications

Register **all** of the following:

```
haulbrokr://
haulbrokr://*
haulbrokr://sso-callback
https://haulbrokr.com/*
https://www.haulbrokr.com/*
```

### App Configuration

| Setting | Value |
|---------|-------|
| URL scheme | `haulbrokr` |
| OAuth callback path | `sso-callback` |
| Production redirect URI | `haulbrokr://sso-callback` |
| Bundle ID | `com.haulbrokr.mobile` |
| Associated domains | `applinks:haulbrokr.com`, `applinks:www.haulbrokr.com`, `webcredentials:haulbrokr.com`, `webcredentials:www.haulbrokr.com` |
| Expo Router origin | `https://haulbrokr.com` |

### Deep Links (non-OAuth)

| URI | Purpose |
|-----|---------|
| `haulbrokr://payment-return` | Stripe card setup |
| `haulbrokr://payouts-return` | Stripe Connect return |
| `haulbrokr://checkout-return` | Job checkout return |

---

## OAuth Configuration

### Google Login

| Item | Value / Action |
|------|----------------|
| Strategy (native iOS) | `google_one_tap` via `@clerk/expo/google` |
| Strategy (fallback) | `oauth_google` via `useSSO` + `haulbrokr://sso-callback` |
| EAS secrets required | `EXPO_PUBLIC_CLERK_GOOGLE_WEB_CLIENT_ID`, `EXPO_PUBLIC_CLERK_GOOGLE_IOS_CLIENT_ID`, `EXPO_PUBLIC_CLERK_GOOGLE_IOS_URL_SCHEME` |
| iOS URL scheme | Reversed client ID (e.g. `com.googleusercontent.apps.xxx`) — set via `EXPO_PUBLIC_CLERK_GOOGLE_IOS_URL_SCHEME` |
| Clerk Dashboard | Enable Google provider; add iOS bundle ID `com.haulbrokr.mobile` |
| Google Cloud Console | OAuth client for iOS with bundle ID `com.haulbrokr.mobile` |

### Sign in with Apple

| Item | Value / Action |
|------|----------------|
| Strategy (iOS) | Native `oauth_token_apple` via `@clerk/expo/apple` |
| Strategy (fallback) | `oauth_apple` browser SSO |
| Entitlement | `com.apple.developer.applesignin` (via `@clerk/expo` plugin + `expo-apple-authentication`) |
| Bundle ID | `com.haulbrokr.mobile` |
| Clerk Dashboard | Apple provider enabled; bundle ID `com.haulbrokr.mobile` |
| Apple Developer | Sign in with Apple capability on App ID; Service ID configured in Clerk |

---

## Apple Review Demo Account

| Field | Value |
|-------|-------|
| Email | `apple-review@haulbrokr.com` |
| Password | `Apple1demo` |
| Username | `Apple1demo` |
| Clerk user ID | `user_3GC8nZ5HdNKYoyK668GV8iK0stW` (created 2026-07-07) |
| Email verified | Yes (via Clerk API) |
| Never expires | Password/metadata re-applied by seed script; `public_metadata.permanent: true` |

### Seed Command (profile + marketplace data)

```bash
export CLERK_SECRET_KEY="sk_live_..."
export DATABASE_URL="postgresql://..."
pnpm --filter @workspace/api-server run seed-apple-review
```

Seeds when `DATABASE_URL` is available:

- Provider profile: **Apple Review Hauling Co**
- **Fleet:** 4 trucks
- **Jobs:** 5 jobs (active, in_progress, completed, accepted)
- **Dispatches:** Job activity + dispatch notifications
- **Analytics:** Dashboard stats via jobs/requests
- **Notifications:** 10 in-app activity items
- **Customers:** 3 demo customer profiles

> **Action required:** Run `seed-apple-review` against production Neon DB so reviewers skip onboarding and see populated data.

---

## Apple Login Status

| Check | Status |
|-------|--------|
| `usesAppleSignIn: true` in app.json | ✅ |
| `expo-apple-authentication` plugin | ✅ Added |
| `@clerk/expo` plugin `appleSignIn: true` | ✅ |
| Native `useSignInWithApple` on iOS | ✅ Implemented |
| Browser SSO fallback | ✅ Implemented |
| Entitlement injection via Clerk plugin | ✅ |
| Clerk Apple provider + bundle ID | ⚠️ Verify in Clerk Dashboard |

---

## Google Login Status

| Check | Status |
|-------|--------|
| Native `useSignInWithGoogle` on iOS | ✅ Implemented (when env vars set) |
| Browser SSO fallback with `haulbrokr://sso-callback` | ✅ Implemented |
| Google URL scheme in Info.plist | ✅ Via `@clerk/expo` plugin when `EXPO_PUBLIC_CLERK_GOOGLE_IOS_URL_SCHEME` set |
| EAS secrets for Google client IDs | ⚠️ Must be set before release build |
| Clerk Google provider enabled | ⚠️ Verify in Clerk Dashboard |

---

## Email Verification Status

| Check | Status |
|-------|--------|
| `verifyEmailCode()` on sign-up | ✅ |
| Explicit `setActive({ session: createdSessionId })` after verify | ✅ |
| `finalizeSignUp()` with `setActive` fallback | ✅ |
| Navigate to `/onboarding` after activation | ✅ |
| Resend verification code | ✅ Added |
| Clerk error logging on all auth failures | ✅ `[ClerkAuth:*]` console logs |
| Generic "Verification incomplete" removed | ✅ Replaced with specific errors |

---

## Release Test Results

### Automated (this fix session)

| Test | Result |
|------|--------|
| Mobile unit tests (`pnpm test`) | ✅ 74/74 passed |
| Redirect URI unit tests | ✅ `haulbrokr://sso-callback` |
| Expo config validation | ✅ scheme, bundle ID, associatedDomains, Apple plugin |
| Clerk production API | ✅ Instance type: `production` |
| Apple Review Clerk user created | ✅ Email verified |

### Manual iOS Release (required before App Store resubmit)

Run on a **physical device** with an EAS **production** build (not Expo Go, not simulator-only):

```bash
cd artifacts/haulbrokr-mobile
eas build --platform ios --profile production
# Install via TestFlight, then verify:
```

| Flow | Expected | Tested in agent |
|------|----------|-----------------|
| Sign up (email/password) | Email code → verify → onboarding | ⚠️ Needs TestFlight |
| Email verification | `setActive` → onboarding | ⚠️ Needs TestFlight |
| Onboarding → main app | Profile created → tabs | ⚠️ Needs TestFlight + DB seed |
| Login (password) | Session persists | ⚠️ Needs TestFlight |
| Logout → login | Clean sign-out, re-auth works | ⚠️ Needs TestFlight |
| Google Sign In | Native or SSO completes | ⚠️ Needs TestFlight + Google env |
| Sign in with Apple | Native Apple sheet completes | ⚠️ Needs TestFlight |
| Returning user | Auto session on relaunch | ⚠️ Needs TestFlight |
| Cold launch | Session restored from SecureStore | ⚠️ Needs TestFlight |
| Session persistence | Survives force-quit | ⚠️ Needs TestFlight |
| Apple Review account login | `apple-review@haulbrokr.com` works | ⚠️ Needs TestFlight + DB seed |

> Cloud agent environment cannot run EAS production iOS builds on physical hardware. Complete the TestFlight checklist above before resubmitting to App Store Connect.

---

## App Store Readiness

| Requirement | Status |
|-------------|--------|
| Auth redirect URIs aligned with Clerk production | ✅ Code fixed; verify Dashboard |
| Email verification completes sign-up | ✅ Code fixed |
| Native Apple Sign In on iOS release | ✅ Code fixed |
| Google OAuth production config | ⚠️ Set EAS Google secrets |
| Permanent demo account for Apple Review | ✅ Clerk user created; ⚠️ Run DB seed |
| Review notes with demo credentials | ⚠️ Add to App Store Connect |
| `pk_live_` in EAS production build | ⚠️ Verify EAS secret |
| TestFlight full auth regression | ⚠️ Pending |

### Pre-Submit Checklist

1. Clerk Dashboard → Native Applications → add all redirect URIs listed above
2. EAS secrets: `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...`, Google client IDs
3. `pnpm --filter @workspace/api-server run seed-apple-review` against production DB
4. `eas build --platform ios --profile production` → TestFlight
5. Test all auth flows on physical iPhone (release build)
6. App Store Connect → Review Notes:

   ```
   Demo account:
   Email: apple-review@haulbrokr.com
   Username: Apple1demo
   Password: Apple1demo
   ```

---

## Summary

Authentication failures were caused by redirect URI misconfiguration, missing `setActive` after email verification, and reliance on browser-only OAuth for Apple/Google. The mobile app now uses stable `haulbrokr://sso-callback` redirects, native Apple/Google sign-in on iOS, explicit session activation, and structured error logging. A permanent Apple Review Clerk account has been created in production. Run the DB seed script and complete TestFlight validation before resubmitting to the App Store.
