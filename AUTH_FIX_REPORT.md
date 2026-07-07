# Auth Fix Report

**Date:** 2026-07-07  
**Scope:** Apple App Review authentication blockers (iOS production release)

## Issues Reported by Apple

1. Email verification sends code but signup does not complete
2. Google login errors
3. Apple login errors
4. Redirect URL error: `haulbrokr://` not authorized
5. Demo account `Apple1demo / Apple1demo` does not work

## Root Causes & Fixes

### 1. Email verification incomplete after code entry

**Root cause:** After `signUp.verifications.verifyEmailCode()`, the app checked `signUp.status === "complete"` but did not always call `clerk.setActive({ session: createdSessionId })` before navigation. Clerk returned a complete signup with a session ID, but the client never activated it — showing "Verification incomplete."

**Fix:** `artifacts/haulbrokr-mobile/app/sign-in.tsx`

- Added `activateSession()` helper that calls `clerk.setActive({ session })` + `markClerkActiveSession()`.
- After successful email verification, immediately activate session when `createdSessionId` is present.
- Same pattern applied to client-trust MFA email verification path.

### 2. OAuth redirect URL not authorized (`haulbrokr://`)

**Root cause:** SSO used generic `AuthSession.makeRedirectUri()` which can resolve to Expo dev URLs (`exp://`) in some builds. Clerk production dashboard requires explicit `haulbrokr://` scheme.

**Fix:**

- `artifacts/haulbrokr-mobile/lib/authRedirects.ts` — `getClerkOAuthRedirectUri()` forces `haulbrokr://oauth-callback`.
- `app/sign-in.tsx` — SSO flows use explicit redirect helper.
- `app.json` — added `linking.prefixes`, iOS `associatedDomains`, Android `intentFilters`.
- `app.config.js` — documents Clerk redirect allowlist in `extra.clerkRedirectAllowlist`.

**Clerk dashboard redirect URLs to allow (production):**

```
haulbrokr://
haulbrokr://*
https://haulbrokr.com/*
https://www.haulbrokr.com/*
```

### 3. Google OAuth (iOS release)

**Configuration verified in repo:**

| Setting        | Value                                                            |
| -------------- | ---------------------------------------------------------------- |
| iOS bundle ID  | `com.haulbrokr.mobile`                                           |
| OAuth redirect | `haulbrokr://oauth-callback`                                     |
| Clerk plugin   | `@clerk/expo` in `app.json`                                      |
| Google pods    | `GoogleUtilities`, `RecaptchaInterop` in `expo-build-properties` |

**Action required in Clerk dashboard:** Enable Google OAuth provider for production instance and add redirect URIs above.

**Action required in Google Cloud Console:** iOS OAuth client must use bundle ID `com.haulbrokr.mobile`; authorized redirect URI must include Clerk's callback URL for the production Clerk instance.

### 4. Apple Sign In (iOS release)

**Configuration verified in repo:**

| Setting           | Value                                     |
| ----------------- | ----------------------------------------- |
| `usesAppleSignIn` | `true` in `app.json`                      |
| Bundle ID         | `com.haulbrokr.mobile`                    |
| Dependency        | `expo-apple-authentication`               |
| Redirect          | `haulbrokr://oauth-callback` via SSO flow |

**Action required in Clerk dashboard:** Enable Apple OAuth provider; configure Apple Services ID / redirect URI per Clerk docs for native iOS.

**Action required in Apple Developer:** Sign In with Apple capability enabled for `com.haulbrokr.mobile`.

### 5. Demo account

**Root cause:** Credentials `Apple1demo / Apple1demo` were invalid (wrong email format, weak/incorrect password).

**Fix:** Permanent Apple review account seeded via:

```bash
pnpm --filter @workspace/api-server run seed-apple-review
```

| Field    | Value                                     |
| -------- | ----------------------------------------- |
| Email    | `apple-review@haulbrokr.com`              |
| Password | `Apple1demo123!`                          |
| Username | `apple-review`                            |
| Role     | Provider (with demo fleet + open request) |

## Validation Script

Static iOS release auth checks:

```bash
pnpm --filter @workspace/api-server run validate:ios-auth
```

Checks bundle ID, Apple Sign In flag, deep link scheme, intent filters, OAuth redirect helper usage, and session activation after verification.

## Files Changed

- `artifacts/haulbrokr-mobile/app/sign-in.tsx`
- `artifacts/haulbrokr-mobile/lib/authRedirects.ts`
- `artifacts/haulbrokr-mobile/app.json`
- `artifacts/haulbrokr-mobile/app.config.js`
- `artifacts/haulbrokr-mobile/test/auth-redirects.test.ts`
- `artifacts/api-server/scripts/seed-apple-review.ts`
- `artifacts/api-server/scripts/validate-ios-auth-config.ts`
- `apps/haulbrokr/src/components/index.ts` (auth redirect constants)

## Remaining Risks

- Clerk/Google/Apple provider credentials must be correctly configured in production Clerk dashboard (cannot be verified in CI without live keys).
- `seed-apple-review` requires live `CLERK_SECRET_KEY` + `DATABASE_URL` to run against production.
- First-time SSO on a fresh install still depends on Clerk native application settings being enabled.

## Verification

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm --filter @workspace/api-server run validate:ios-auth
```
